const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

/**
 * GET /api/conversations
 *
 * Return all conversations where the authenticated user is a participant (MSG-03).
 * Sorted by lastMessageAt descending (most recently active first).
 *
 * Security (T-02-04-01): The $in query on participants ensures only conversations
 * the requester belongs to are returned.
 *
 * Success response: { data: Conversation[] }
 *   Each row: id, participants, lastMessageAt, lastMessagePreview.
 */
async function listConversations(req, res) {
  try {
    const conversations = await Conversation.find(
      { participants: req.user.uid },
      { _id: 1, participants: 1, lastMessageAt: 1, lastMessagePreview: 1 }
    ).sort({ lastMessageAt: -1 });

    res.json({ data: conversations });
  } catch (err) {
    console.error('[listConversations]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/conversations/:id/messages
 *
 * Return paginated message history for a conversation (MSG-03).
 *
 * Security (T-02-04-01):
 *   - Loads the Conversation by id; 404 if missing.
 *   - Rejects with 403 if req.user.uid is NOT in conversation.participants
 *     (no cross-user history reads — Information Disclosure gate).
 *
 * Pagination (cursor-based):
 *   - Query param: before=<ISO date string> — return messages created before this timestamp
 *   - Default: return the newest `limit` messages
 *   - Limit: default 30, capped at 50
 *   - Returns nextBefore (ISO date string) for the oldest message in the current page,
 *     or null when there are no older messages
 *
 * Success response:
 *   { data: Message[], nextBefore: string | null }
 *   Each message: id, senderUid, content, createdAt.
 */
async function getMessages(req, res) {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // T-02-04-01: participant-only gate
    if (!conversation.participants.includes(req.user.uid)) {
      return res.status(403).json({ error: 'You are not a participant of this conversation' });
    }

    // Pagination params
    const rawLimit = parseInt(req.query.limit, 10) || 30;
    const limit = Math.min(rawLimit, 50);

    const filter = { conversationId: conversation._id };
    if (req.query.before) {
      const beforeDate = new Date(req.query.before);
      if (!isNaN(beforeDate.getTime())) {
        filter.createdAt = { $lt: beforeDate };
      }
    }

    const messages = await Message.find(
      filter,
      { _id: 1, senderUid: 1, content: 1, createdAt: 1 }
    )
      .sort({ createdAt: -1 })
      .limit(limit);

    // Provide a nextBefore cursor if there might be older messages
    const nextBefore = messages.length === limit
      ? messages[messages.length - 1].createdAt.toISOString()
      : null;

    res.json({ data: messages, nextBefore });
  } catch (err) {
    console.error('[getMessages]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  listConversations,
  getMessages,
};
