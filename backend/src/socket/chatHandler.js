const { getAuth } = require('firebase-admin/auth');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { sendPushNotification } = require('../services/notificationService');

/**
 * registerSocketHandlers — wires the io.use() Firebase-token auth middleware,
 * the core connection/disconnection lifecycle, and the full suite of chat handlers:
 *   1:1 DM room  (plan 02-04): join:dm, leave:dm, message:dm
 *   City group   (plan 02-05): join:city, leave:city, message:city
 *
 * Security:
 *   T-02-01-01, T-02-01-02 — Firebase-token auth for every connection
 *   T-02-04-02 — message:dm gate: refuses write without an accepted Conversation
 *   T-02-04-03 — senderUid from socket.data.uid (never from client payload)
 *   T-02-04-04 — content capped at 2000 chars; push only when recipient NOT in room
 *   T-02-05-01 — citySlug derived server-side from the caller's User profile in
 *                 join:city and message:city; a client-supplied slug is NEVER read
 *   T-02-05-02 — senderUid and senderName come from socket.data, never from the client
 *   T-02-05-03 — push only to city members NOT currently in the room (skip-if-online);
 *                 content capped at 2000 chars; fan-out capped at 200 recipients
 *                 (per-message rate limiting + expo chunk batching deferred to Phase 3)
 *   T-02-05-04 — group messages carry type:'group' + citySlug; DM messages carry
 *                 type:'dm' + conversationId; scope isolation is structural
 *
 * DM room name: `dm:{sortedUid1}_{sortedUid2}`
 *   Both peers derive the same room name since UIDs are sorted server-side.
 *   A client cannot fabricate a different room — the server always recomputes the name.
 *
 * City room name: `city:{citySlug}`
 *   citySlug is ALWAYS derived from the authenticated user's own profile (socket.data)
 *   after join:city. A user can only ever join their own city room — this is the
 *   city-room authorization gate (T-02-05-01).
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

    // ── join:city ────────────────────────────────────────────────────────────
    // Client emits join:city (NO citySlug — the server derives it, T-02-05-01).
    // Loads citySlug from the authenticated user's profile and joins `city:{citySlug}`.
    // Caches citySlug + displayName on socket.data for use by message:city.
    // If the user has no homeCity set, emits join:error and returns.
    socket.on('join:city', async () => {
      try {
        // T-02-05-01: ALWAYS derive citySlug from the caller's own profile — never
        // from the client payload (the client sends no citySlug here).
        const user = await User.findOne({ firebaseUid: uid });
        if (!user || !user.citySlug) {
          return socket.emit('join:error', { error: 'No home city set' });
        }
        const { citySlug } = user;

        // Cache for use in message:city (avoids a profile lookup per message)
        socket.data.citySlug = citySlug;
        socket.data.displayName = user.displayName || '';

        const room = `city:${citySlug}`;
        socket.join(room);
        socket.emit('joined:city', { room, citySlug, homeCity: user.homeCity });
      } catch (err) {
        console.error('[join:city]', err);
        socket.emit('join:error', { error: 'Failed to join city room' });
      }
    });

    // ── leave:city ───────────────────────────────────────────────────────────
    // Explicit mid-session leave (locked decision) — avoids zombie rooms.
    // Client emits leave:city when navigating away from the city chat screen.
    // Uses the server-cached socket.data.citySlug (not any client-supplied value).
    socket.on('leave:city', () => {
      const citySlug = socket.data.citySlug;
      if (!citySlug) return;
      socket.leave(`city:${citySlug}`);
    });

    // ── message:city ─────────────────────────────────────────────────────────
    // MSG-04 city group message: STORE-FIRST write + MSG-05 offline push fan-out.
    //
    // Security (T-02-05-01): citySlug is taken EXCLUSIVELY from socket.data.citySlug
    // (set by join:city from the user's own profile). A client-supplied citySlug in
    // the payload is NEVER read — this is the city-room authorization gate.
    //
    // Security (T-02-05-02): senderUid from socket.data.uid; senderName from
    // socket.data.displayName (cached at join:city) — never from the client payload.
    //
    // STORE-FIRST (locked): Message.create() is called BEFORE io.to(room).emit().
    // A DB failure causes message:error; no phantom message is delivered.
    //
    // Push fan-out (T-02-05-03, RESEARCH Pitfall 7 skip-if-online):
    //   - Query all city members with an Expo token who are NOT currently in the room
    //   - Cap fan-out at 200 recipients (MVP assumption: small cities)
    //   - Push is non-blocking (.catch(console.error))
    //   - Per-message rate limiting + expo chunk batching deferred to Phase 3
    //     (documented per RESEARCH Pitfall 7)
    socket.on('message:city', async ({ content } = {}) => {
      try {
        // T-02-05-01: citySlug from socket.data — never from the client payload
        let citySlug = socket.data.citySlug;
        if (!citySlug) {
          // Re-derive from profile if not cached (e.g. socket reconnect mid-session)
          const user = await User.findOne({ firebaseUid: uid });
          citySlug = user?.citySlug;
          if (citySlug) {
            socket.data.citySlug = citySlug;
            socket.data.displayName = user.displayName || '';
          }
        }

        if (!citySlug) {
          return socket.emit('message:error', { error: 'No home city set' });
        }

        // Content validation (T-02-05-03)
        if (!content || typeof content !== 'string' || !content.trim()) {
          return socket.emit('message:error', { error: 'content is required' });
        }
        if (content.trim().length > 2000) {
          return socket.emit('message:error', { error: 'content must not exceed 2000 characters' });
        }

        const trimmedContent = content.trim();
        const room = `city:${citySlug}`;
        const senderName = socket.data.displayName || '';

        // STORE-FIRST: write to MongoDB BEFORE any emit (locked decision, T-02-05-04)
        let savedMessage;
        try {
          savedMessage = await Message.create({
            type: 'group',             // T-02-05-04: group discriminator
            citySlug,                  // T-02-05-01: server-derived, never from client
            senderUid: uid,            // T-02-05-02: from socket.data.uid
            senderName,                // T-02-05-02: from socket.data.displayName
            content: trimmedContent,
          });
        } catch (dbErr) {
          console.error('[message:city] Message.create failed:', dbErr);
          return socket.emit('message:error', { error: 'Message not saved' });
        }

        // Emit to the entire city room (all connected city members receive message:new)
        io.to(room).emit('message:new', {
          _id:       savedMessage._id,
          citySlug,                    // scope discriminator for the client (T-02-05-04)
          senderUid: uid,
          senderName,
          content:   savedMessage.content,
          createdAt: savedMessage.createdAt,
        });

        // MSG-05 offline push fan-out (T-02-05-03, RESEARCH Pitfall 7):
        // Build the set of UIDs currently connected to this city room.
        // Query city members with a push token who are NOT in the room and NOT the sender.
        // Cap at 200 to bound fan-out on large cities (rate limiting deferred to Phase 3).
        const roomSockets = await io.in(room).fetchSockets();
        const onlineUids = new Set(roomSockets.map((s) => s.data.uid).filter(Boolean));

        // Non-blocking: push failures must not abort the message flow
        User.find(
          {
            citySlug,
            expoPushToken: { $ne: null },
            firebaseUid: { $nin: [...onlineUids, uid] },
          },
          { firebaseUid: 1, expoPushToken: 1 }
        )
          .limit(200)
          .then((offlineMembers) => {
            return Promise.all(
              offlineMembers.map((member) =>
                sendPushNotification(
                  member.expoPushToken,
                  `New message in ${citySlug}`,
                  trimmedContent.slice(0, 100),
                  { type: 'city_message', citySlug }
                ).catch(console.error)
              )
            );
          })
          .catch(console.error);
      } catch (err) {
        console.error('[message:city]', err);
        socket.emit('message:error', { error: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id, 'uid:', uid);
    });
  });
}

module.exports = { registerSocketHandlers };
