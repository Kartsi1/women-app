const { Schema, model } = require('mongoose');

/**
 * Conversation model — represents an accepted 1:1 DM channel (MSG-02).
 *
 * A Conversation is created ONLY when a MessageRequest is accepted.
 * Its existence for a sorted participant pair is the MSG-02 server-side gate:
 * the socket handler (chatHandler.js) refuses to write a Message unless an
 * accepted Conversation already exists for the two UIDs.
 *
 * Participants are stored server-sorted ([uid1, uid2].sort()) so the pair key
 * is deterministic — both users derive the same document regardless of who
 * initiated the request.
 *
 * Security (T-02-04-02):
 *   - Conversation is created solely by updateRequestStatus on accept
 *   - No client path creates a Conversation directly
 *   - message:dm handler queries by participants $all, not a client-supplied id
 *
 * Fields:
 *   type               — always 'dm' for this slice (group type reserved for 02-05)
 *   participants       — [String × 2], server-sorted Firebase UIDs; indexed for pair lookup
 *   lastMessageAt      — Date of the most recent message (used for conversation list order)
 *   lastMessagePreview — Short preview of the last message body (truncated if needed)
 *
 * Timestamps add createdAt and updatedAt automatically.
 */
const conversationSchema = new Schema(
  {
    type:               { type: String, enum: ['dm'], default: 'dm' },
    participants:       { type: [String], required: true, index: true },
    lastMessageAt:      { type: Date },
    lastMessagePreview: { type: String },
  },
  { timestamps: true }
);

module.exports = model('Conversation', conversationSchema);
