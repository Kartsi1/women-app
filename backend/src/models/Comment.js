const { Schema, model } = require('mongoose');

/**
 * Comment model — separate collection referencing Post by postId (COMM-02).
 *
 * Stored in a separate collection, NOT embedded in Post, to avoid the 16MB document
 * limit (same architectural decision as Messages vs Conversation).
 *
 * Fields:
 *   postId     — ObjectId reference to the parent Post (required, indexed for getComments)
 *   authorUid  — Firebase UID of the commenter (required; ALWAYS set server-side from
 *                req.user.uid — never from the request body — T-03-02-02)
 *   text       — comment body; required, max 500 chars (T-03-02-06: DoS guard)
 *
 * Timestamps add createdAt and updatedAt automatically.
 */
const commentSchema = new Schema(
  {
    postId:    { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    authorUid: { type: String, required: true },
    text:      { type: String, required: true, maxlength: 500 },
  },
  { timestamps: true }
);

module.exports = model('Comment', commentSchema);
