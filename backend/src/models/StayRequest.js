const { Schema, model } = require('mongoose');

/**
 * StayRequest model — backs the 'stayrequests' collection (REQT-01..04).
 *
 * Fields:
 *   guestUid   — Firebase UID of the user requesting a stay (from verified token)
 *   hostUid    — Firebase UID of the listing owner (copied from listing at creation)
 *   listingId  — ObjectId reference to the Listing being requested
 *   checkIn    — Requested check-in date (required)
 *   checkOut   — Requested check-out date (required, must be >= checkIn enforced in controller)
 *   intro      — Guest's introduction message (required, max 500 chars — T-02-03-05 DoS)
 *   status     — Workflow state: 'pending' (default) | 'accepted' | 'declined'
 *
 * Security:
 *   T-02-03-04: guestUid is ALWAYS taken from the verified token in requestController
 *               (never from request body) to prevent spoofing.
 *   T-02-03-03: createRequest rejects when guestUid === listing.ownerUid
 *   T-02-03-01: status='accepted' is the sole gate for exactAddress disclosure in
 *               listingController.getListingDetail.
 */
const stayRequestSchema = new Schema(
  {
    guestUid:  { type: String, required: true, index: true },
    hostUid:   { type: String, required: true, index: true },
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
    checkIn:   { type: Date, required: true },
    checkOut:  { type: Date, required: true },
    intro:     { type: String, required: true, maxlength: 500 },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = model('StayRequest', stayRequestSchema);
