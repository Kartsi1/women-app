const { Schema, model } = require('mongoose');

/**
 * Message model — persists individual messages in a separate collection.
 *
 * SCOPE DISCRIMINATOR (MSG-04, 02-05 extension):
 *   type: 'dm'    — 1:1 DM messages (02-04); carry conversationId, no citySlug
 *   type: 'group' — city group chat messages (02-05); carry citySlug, no conversationId
 *
 * Scope isolation is structural: DM history queries filter { conversationId } and
 * city history queries filter { citySlug, type:'group' }. A message of one scope
 * can NEVER match the other's query — cross-leak is impossible at the query level.
 *
 * LOCKED DECISION: messages are stored in a separate collection, NOT embedded in
 * Conversation, to avoid MongoDB's 16MB document size limit on high-volume chats.
 *
 * STORE-FIRST (locked): chatHandler.js calls Message.create() BEFORE io.to(room).emit().
 * A failure in Message.create() causes message:error to be emitted and nothing is sent
 * to recipients — no phantom messages.
 *
 * Security:
 *   T-02-04-01: senderUid is taken from socket.data.uid (verified token), never from
 *               the client payload
 *   T-02-05-01: citySlug is derived server-side from the authenticated user's profile
 *               in join:city and message:city — never from the client payload
 *   T-02-05-04: group Messages carry citySlug + type:'group'; DM Messages carry
 *               conversationId + type:'dm'. Neither scope can match the other's query.
 *
 * Fields (DM scope):
 *   conversationId — ObjectId ref to Conversation (indexed for history queries)
 *   senderUid      — Firebase UID of the sender (from socket.data.uid)
 *   content        — message body (required, max 2000 chars)
 *   type           — 'dm' for 1:1 direct messages
 *
 * Fields (group scope, added in 02-05):
 *   conversationId — NOT set (absent for group messages)
 *   citySlug       — the normalised city slug (derived server-side from homeCity)
 *   senderName     — denormalised display name (cached from socket.data.displayName
 *                    at join:city time; avoids a join on every history read)
 *   type           — 'group' for city group chat messages
 *
 * Indexes:
 *   { conversationId: 1, createdAt: -1 } — covers paginated DM history reads
 *   { citySlug: 1, createdAt: -1 }       — covers paginated city history reads
 *
 * Timestamps add createdAt and updatedAt automatically.
 */
const messageSchema = new Schema(
  {
    // DM scope fields
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', index: true },
    // Group scope fields (02-05)
    citySlug:   { type: String, index: true },
    senderName: { type: String },            // denormalised for group messages
    // Shared fields
    senderUid:  { type: String, required: true },
    content:    { type: String, required: true, maxlength: 2000 },
    type:       { type: String, enum: ['dm', 'group'], default: 'dm' },
  },
  { timestamps: true }
);

// Compound index for paginated DM history reads (getMessages, cursor-based)
messageSchema.index({ conversationId: 1, createdAt: -1 });

// Compound index for paginated city group history reads (getCityMessages, cursor-based, 02-05)
messageSchema.index({ citySlug: 1, createdAt: -1 });

module.exports = model('Message', messageSchema);
