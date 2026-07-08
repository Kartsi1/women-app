const User = require('../models/User');
const MessageRequest = require('../models/MessageRequest');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { sendPushNotification } = require('../services/notificationService');

/**
 * POST /api/message-requests
 *
 * Send a message request (with an intro) to another verified user (MSG-01).
 *
 * Body: { recipientUid: string, intro: string }
 *
 * Security (T-02-04-03): senderUid is ALWAYS taken from req.user.uid (the verified
 * Firebase token) — never from the body. recipientUid comes from the body but is
 * validated as a known, existing user.
 *
 * Rejection rules:
 *   400 — recipientUid missing, intro missing/empty/too long, self-request
 *   404 — recipient user does not exist in MongoDB
 *   409 — a pending or accepted MessageRequest already exists for this pair, OR an
 *         accepted Conversation already exists (no duplicate/spam requests)
 *   201 — message request created; push notification sent to recipient
 */
async function createMessageRequest(req, res) {
  try {
    const { recipientUid, intro } = req.body;
    const senderUid = req.user.uid; // T-02-04-03: from verified token

    if (!recipientUid || typeof recipientUid !== 'string') {
      return res.status(400).json({ error: 'recipientUid is required' });
    }

    // Self-request guard
    if (recipientUid === senderUid) {
      return res.status(400).json({ error: 'You cannot send a message request to yourself' });
    }

    // Intro validation
    if (!intro || typeof intro !== 'string' || !intro.trim()) {
      return res.status(400).json({ error: 'intro is required' });
    }
    if (intro.trim().length > 2000) {
      return res.status(400).json({ error: 'intro must not exceed 2000 characters' });
    }

    // Confirm recipient exists
    const recipient = await User.findOne({ firebaseUid: recipientUid });
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient user not found' });
    }

    // 409 guard: reject duplicate/again requests
    const existingRequest = await MessageRequest.findOne({
      $or: [
        { senderUid, recipientUid, status: { $in: ['pending', 'accepted'] } },
        { senderUid: recipientUid, recipientUid: senderUid, status: { $in: ['pending', 'accepted'] } },
      ],
    });
    if (existingRequest) {
      return res.status(409).json({ error: 'A message request already exists for this pair' });
    }

    // 409 guard: an accepted Conversation already exists (pair already connected)
    const sortedPair = [senderUid, recipientUid].sort();
    const existingConversation = await Conversation.findOne({ participants: { $all: sortedPair } });
    if (existingConversation) {
      return res.status(409).json({ error: 'You already have a conversation with this user' });
    }

    // Create the request
    const messageRequest = await MessageRequest.create({
      senderUid,
      recipientUid,
      intro: intro.trim(),
      // status defaults to 'pending'
    });

    // Push notification to the recipient
    await sendPushNotification(
      recipient.expoPushToken,
      'Message request',
      'Someone wants to message you',
      { type: 'message_request', requestId: messageRequest._id.toString() }
    );

    res.status(201).json({ data: messageRequest });
  } catch (err) {
    console.error('[createMessageRequest]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/message-requests/inbox
 *
 * Return pending message requests for the authenticated user (MSG-02).
 * Only pending requests are shown — accepted/declined are resolved.
 *
 * Success response: { data: MessageRequest[] }
 *   Each row includes: senderUid, intro, status, createdAt (safe projection).
 */
async function getRequestInbox(req, res) {
  try {
    const requests = await MessageRequest.find(
      { recipientUid: req.user.uid, status: 'pending' },
      { senderUid: 1, intro: 1, status: 1, createdAt: 1, _id: 1 }
    ).sort({ createdAt: -1 });

    res.json({ data: requests });
  } catch (err) {
    console.error('[getRequestInbox]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PATCH /api/message-requests/:id
 *
 * Accept or decline a message request (MSG-02).
 * RECIPIENT-ONLY — mirrors the StayRequest host-only guard (T-02-04-05).
 *
 * Body: { status: 'accepted' | 'declined' }
 *
 * On ACCEPTED:
 *   1. Create a Conversation (participants sorted) if none exists for the pair.
 *   2. Seed the sender's intro as the first Message in the conversation.
 *   3. Update lastMessageAt / lastMessagePreview on the Conversation.
 *   4. Push-notify the SENDER that their request was accepted.
 *   5. Return the updated request plus conversationId.
 *
 * On DECLINED:
 *   1. Set status = 'declined'.
 *   2. Push-notify the sender that their request was declined.
 *
 * Rejection rules:
 *   400 — status not in { accepted, declined }
 *   403 — caller is not the recipient (T-02-04-05)
 *   404 — request not found
 *   200 — updated request (+ conversationId when accepted)
 */
async function updateRequestStatus(req, res) {
  try {
    const { status } = req.body;

    if (!status || !['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'status must be "accepted" or "declined"' });
    }

    const messageRequest = await MessageRequest.findById(req.params.id);
    if (!messageRequest) {
      return res.status(404).json({ error: 'Message request not found' });
    }

    // T-02-04-05: recipient-only guard
    if (messageRequest.recipientUid !== req.user.uid) {
      return res.status(403).json({ error: 'Only the recipient can respond to this request' });
    }

    messageRequest.status = status;
    await messageRequest.save();

    let conversationId = null;

    if (status === 'accepted') {
      const sortedPair = [messageRequest.senderUid, messageRequest.recipientUid].sort();

      // Create the Conversation if it doesn't already exist for this pair
      let conversation = await Conversation.findOne({ participants: { $all: sortedPair } });
      if (!conversation) {
        conversation = await Conversation.create({
          type: 'dm',
          participants: sortedPair,
        });
      }
      conversationId = conversation._id;

      // Seed the intro as the first Message (store-first pattern, BEFORE any socket emit)
      const preview = messageRequest.intro.length > 80
        ? messageRequest.intro.slice(0, 80) + '…'
        : messageRequest.intro;

      await Message.create({
        conversationId: conversation._id,
        senderUid: messageRequest.senderUid,
        content: messageRequest.intro,
        type: 'dm',
      });

      // Update Conversation with preview
      conversation.lastMessageAt = new Date();
      conversation.lastMessagePreview = preview;
      await conversation.save();
    }

    // Push-notify the sender about the outcome
    const sender = await User.findOne({ firebaseUid: messageRequest.senderUid });
    await sendPushNotification(
      sender?.expoPushToken,
      status === 'accepted' ? 'Message request accepted' : 'Message request declined',
      status === 'accepted'
        ? 'Your message request was accepted — start chatting!'
        : 'Your message request was declined.',
      { type: 'message_request', requestId: messageRequest._id.toString(), status }
    );

    const responseData = { data: messageRequest };
    if (conversationId) {
      responseData.conversationId = conversationId;
    }
    res.json(responseData);
  } catch (err) {
    console.error('[updateRequestStatus]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  createMessageRequest,
  getRequestInbox,
  updateRequestStatus,
};
