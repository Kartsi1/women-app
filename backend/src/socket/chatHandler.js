const { getAuth } = require('firebase-admin/auth');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { sendPushNotification } = require('../services/notificationService');

/**
 * registerSocketHandlers — wires the io.use() Firebase-token auth middleware,
 * the core connection/disconnection lifecycle, and the 1:1 DM room + message
 * handlers (plan 02-04: join:dm, leave:dm, message:dm).
 *
 * City group chat (MSG-04, join:city / message:city) is out of scope for this
 * slice and will be added in plan 02-05.
 *
 * Security:
 *   T-02-01-01, T-02-01-02 — Firebase-token auth for every connection
 *   T-02-04-02 — message:dm gate: refuses write without an accepted Conversation
 *   T-02-04-03 — senderUid from socket.data.uid (never from client payload)
 *   T-02-04-04 — content capped at 2000 chars; push only when recipient NOT in room
 *
 * DM room name: `dm:{sortedUid1}_{sortedUid2}`
 *   Both peers derive the same room name since UIDs are sorted server-side.
 *   A client cannot fabricate a different room — the server always recomputes the name.
 */
function registerSocketHandlers(io) {
  // ── Auth middleware ──────────────────────────────────────────────────────────
  // Runs for every incoming connection before any event handler (T-02-01-01, T-02-01-02).
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Missing auth token'));
    }
    try {
      const decoded = await getAuth().verifyIdToken(token);
      // Mirror the REST requireVerified gate — defence-in-depth (T-02-01-02)
      if (!decoded.isVerified) {
        return next(new Error('User not verified'));
      }
      socket.data.uid = decoded.uid;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { uid } = socket.data;
    // Confirm authenticated handshake to the client
    socket.emit('connected', { uid });
    console.log('Authenticated socket connected:', socket.id, 'uid:', uid);

    // ── join:dm ──────────────────────────────────────────────────────────────
    // Client emits { otherUid } to request joining a DM room.
    // Gate: an accepted Conversation must exist for the sorted pair.
    // If not, emit join:error and refuse the join (T-02-04-02).
    socket.on('join:dm', async ({ otherUid } = {}) => {
      try {
        if (!otherUid) {
          return socket.emit('join:error', { error: 'otherUid is required' });
        }
        const sortedPair = [uid, otherUid].sort();
        const conversation = await Conversation.findOne({ participants: { $all: sortedPair } });
        if (!conversation) {
          return socket.emit('join:error', { error: 'No accepted conversation for this pair' });
        }
        const room = `dm:${sortedPair[0]}_${sortedPair[1]}`;
        socket.join(room);
        socket.emit('joined:dm', { room, conversationId: conversation._id });
      } catch (err) {
        console.error('[join:dm]', err);
        socket.emit('join:error', { error: 'Failed to join room' });
      }
    });

    // ── leave:dm ─────────────────────────────────────────────────────────────
    // Explicit mid-session leave (locked decision) — avoids zombie rooms.
    // Client emits { otherUid } when navigating away from a conversation.
    socket.on('leave:dm', ({ otherUid } = {}) => {
      if (!otherUid) return;
      const sortedPair = [uid, otherUid].sort();
      const room = `dm:${sortedPair[0]}_${sortedPair[1]}`;
      socket.leave(room);
    });

    // ── message:dm ───────────────────────────────────────────────────────────
    // MSG-02 gate + STORE-FIRST write + MSG-05 offline push.
    //
    // Security (T-02-04-02): refuses to write unless an accepted Conversation
    // exists for the sorted pair — this is the server-side gate. The client
    // cannot bypass it by emitting directly to a room without this check.
    //
    // STORE-FIRST (locked): Message.create() is called BEFORE io.to(room).emit().
    // A DB failure causes message:error; the recipient never sees a phantom message.
    //
    // senderUid (T-02-04-03): ALWAYS socket.data.uid — never from the payload.
    socket.on('message:dm', async ({ otherUid, content } = {}) => {
      try {
        if (!otherUid) {
          return socket.emit('message:error', { error: 'otherUid is required' });
        }

        // Content validation (T-02-04-04)
        if (!content || typeof content !== 'string' || !content.trim()) {
          return socket.emit('message:error', { error: 'content is required' });
        }
        if (content.trim().length > 2000) {
          return socket.emit('message:error', { error: 'content must not exceed 2000 characters' });
        }

        const sortedPair = [uid, otherUid].sort();

        // T-02-04-02: MSG-02 gate — must have an accepted Conversation
        const conversation = await Conversation.findOne({ participants: { $all: sortedPair } });
        if (!conversation) {
          return socket.emit('message:error', { error: 'No accepted conversation' });
        }

        const room = `dm:${sortedPair[0]}_${sortedPair[1]}`;

        // STORE-FIRST: write to MongoDB BEFORE emitting (locked decision)
        let savedMessage;
        try {
          savedMessage = await Message.create({
            conversationId: conversation._id,
            senderUid: uid, // T-02-04-03: from socket.data.uid, not from payload
            content: content.trim(),
            type: 'dm',
          });
        } catch (dbErr) {
          console.error('[message:dm] Message.create failed:', dbErr);
          return socket.emit('message:error', { error: 'Message not saved' });
        }

        // Update conversation preview
        const preview = savedMessage.content.length > 80
          ? savedMessage.content.slice(0, 80) + '…'
          : savedMessage.content;
        conversation.lastMessageAt = savedMessage.createdAt;
        conversation.lastMessagePreview = preview;
        await conversation.save();

        // Emit to the DM room (both sender and recipient receive message:new)
        io.to(room).emit('message:new', {
          _id: savedMessage._id,
          conversationId: conversation._id,
          senderUid: uid,
          content: savedMessage.content,
          createdAt: savedMessage.createdAt,
        });

        // MSG-05 offline push — only when the recipient is NOT in the room (T-02-04-04)
        const recipientUid = sortedPair.find((u) => u !== uid) || otherUid;
        const roomSockets = await io.in(room).fetchSockets();
        const recipientInRoom = roomSockets.some((s) => s.data.uid === recipientUid);

        if (!recipientInRoom) {
          const recipientUser = await User.findOne({ firebaseUid: recipientUid });
          await sendPushNotification(
            recipientUser?.expoPushToken,
            'New message',
            savedMessage.content.slice(0, 100),
            { type: 'dm_message', conversationId: conversation._id.toString() }
          );
        }
      } catch (err) {
        console.error('[message:dm]', err);
        socket.emit('message:error', { error: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id, 'uid:', uid);
    });
  });
}

module.exports = { registerSocketHandlers };
