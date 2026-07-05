const { Schema, model } = require('mongoose');

/**
 * Report model — persists user/content reports for admin review (VERI-07).
 *
 * Fields:
 *   reporterUid  — Firebase UID of the user filing the report (required, T-07-02)
 *   reportedUid  — Firebase UID of the reported user (null for content-only reports)
 *   contentType  — what is being reported: 'user' | 'listing' | 'message'
 *   contentId    — ID of the reported content item (null for user-only reports)
 *   reason       — human-readable explanation (required, T-07-04)
 *   status       — workflow state for admins: 'open' (default) | 'resolved'
 *
 * Timestamps add createdAt and updatedAt automatically.
 */
const reportSchema = new Schema(
  {
    reporterUid:  { type: String, required: true },
    reportedUid:  { type: String, default: null },
    contentType:  { type: String, enum: ['listing', 'message', 'user'] },
    contentId:    { type: String, default: null },
    reason:       { type: String, required: true },
    status:       { type: String, enum: ['open', 'resolved'], default: 'open' },
  },
  { timestamps: true }
);

module.exports = model('Report', reportSchema);
