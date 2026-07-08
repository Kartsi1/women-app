const { Schema, model } = require('mongoose');

/**
 * Message model — persists individual 1:1 messages in a separate collection (MSG-03).
 *
 * LOCKED DECISION: messages are stored in a separate collection, NOT embedded in
 * Conversation, to avoid MongoDB's 16MB document size limit on high-volume chats.
 *
 * STORE-FIRST (locked): chatHandler.js calls Message.create() BEFORE io.to(room).emit().
 * A failure in Message.create() causes message:error to be emitted and nothing is sent
 * to the recipient — no phantom messages.
 *
 * Security (T-02-04-01):
 *   - senderUid is taken from socket.data.uid (the verified token), never from the client payload
 *   - getMessages verifies req.user.uid is in conversation.participants before returning rows
 *   - message:new is emitted only to the dm:{sorted} room, so only participants receive it
 *
 * Fields:
 *   conversationId — ObjectId ref to Conversation (indexed for history queries)
 *   senderUid      — Firebase UID of the sender (from socket.data.uid / req.user.uid)
 *   content        — message body (required, max 2000 chars)
 *   type           — always 'dm' for this slice
 *
 * Compound index { conversationId: 1, createdAt: -1 } covers paginated history queries
 * (getMessages queries for a conversation's messages sorted newest-first with a cursor).
 *
 * Timestamps add createdAt and updatedAt automatically.
 */
const messageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    senderUid:      { type: String, required: true },
    content:        { type: String, required: true, maxlength: 2000 },
    type:           { type: String, enum: ['dm'], default: 'dm' },
  },
  { timestamps: true }
);

// Compound index for paginated history reads (getMessages, cursor-based)
messageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = model('Message', messageSchema);
