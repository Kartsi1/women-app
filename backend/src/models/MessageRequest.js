const { Schema, model } = require('mongoose');

/**
 * MessageRequest model — persists a pending 1:1 message gate request (MSG-01, MSG-02).
 *
 * A message request is sent by senderUid to recipientUid before any conversation
 * or message can be created. The recipientUid accepts or declines it.
 * On acceptance, a Conversation document is created for the pair.
 *
 * Security (T-02-04-02, T-02-04-05):
 *   - senderUid is ALWAYS taken from the verified Firebase token — never from the body
 *   - updateRequestStatus accepts only when recipientUid === req.user.uid
 *
 * Fields:
 *   senderUid    — Firebase UID of the user sending the request (indexed for sent-box queries)
 *   recipientUid — Firebase UID of the recipient (indexed for inbox queries)
 *   intro        — brief intro message sent with the request (required, max 2000 chars)
 *   status       — lifecycle state: 'pending' | 'accepted' | 'declined'
 *
 * Timestamps add createdAt and updatedAt automatically.
 */
const messageRequestSchema = new Schema(
  {
    senderUid:    { type: String, required: true, index: true },
    recipientUid: { type: String, required: true, index: true },
    intro:        { type: String, required: true, maxlength: 2000 },
    status:       { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending', index: true },
  },
  { timestamps: true }
);

module.exports = model('MessageRequest', messageRequestSchema);
