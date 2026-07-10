const { Schema, model } = require('mongoose');

/**
 * Review model — backs the 'reviews' collection (REVW-01..03).
 *
 * Fields:
 *   stayRequestId — ObjectId reference to the StayRequest this review belongs to
 *   reviewerUid   — Firebase UID of the reviewer (always from verified token)
 *   subjectUid    — Firebase UID of the person being reviewed (derived server-side)
 *   direction     — 'guest_to_host' | 'host_to_guest' (derived server-side)
 *   rating        — 1-5 star rating (integer)
 *   text          — Review text (min 20, max 2000 chars)
 *   submittedAt   — When the review was submitted
 *
 * Security:
 *   T-03-03-02: reviewerUid ALWAYS taken from the verified token in reviewController
 *               (never from request body) to prevent spoofing.
 *   T-03-03-03: Reviews are IMMUTABLE after submit — no PUT/PATCH route exists.
 *   T-03-03-06: Unique compound index { stayRequestId, direction } ensures
 *               one review per direction per stay; duplicate attempts → 409.
 *   T-03-03-01: Blind-release gate enforced in getStayReviews — counterpart
 *               text absent from response until revealed.
 *
 * NOTE: Do NOT add update/patch instance methods — reviews are immutable by design.
 */
const reviewSchema = new Schema(
  {
    stayRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'StayRequest',
      required: true,
      index: true,
    },
    reviewerUid: { type: String, required: true },
    subjectUid:  { type: String, required: true, index: true },
    direction: {
      type: String,
      enum: ['guest_to_host', 'host_to_guest'],
      required: true,
    },
    rating:      { type: Number, min: 1, max: 5, required: true },
    text: {
      type: String,
      required: true,
      minlength: 20,
      maxlength: 2000,
    },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// CRITICAL (T-03-03-06): one review per direction per stay
// Duplicate same-direction submit → E11000 → 409 in controller
reviewSchema.index({ stayRequestId: 1, direction: 1 }, { unique: true });

// Index for profile aggregation queries (getUserReviews)
reviewSchema.index({ subjectUid: 1, submittedAt: -1 });

module.exports = model('Review', reviewSchema);
