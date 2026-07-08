const { Schema, model } = require('mongoose');

/**
 * Listing model — housing listings for the WomenApp platform.
 *
 * Address hiding strategy (LIST-03 / T-02-02-01):
 *   - `location` (GeoJSON Point): neighbourhood centroid. SAFE to send to all clients.
 *     Coordinates stored as [longitude, latitude] per GeoJSON/MongoDB spec (Pitfall 2).
 *   - `exactAddress`: full street address string. NEVER sent to client until a StayRequest
 *     for this listing is accepted (handled by controller projection — never spread the raw doc).
 *
 * The 2dsphere index on `location` is REQUIRED for $geoNear aggregation (Pitfall 3).
 * Declared here in the schema so Mongoose creates it on first connection.
 */
const listingSchema = new Schema(
  {
    ownerUid: { type: String, required: true, index: true },

    title: { type: String, required: true, trim: true },

    description: { type: String, maxlength: 2000 },

    houseRules: { type: String, maxlength: 1000 },

    /**
     * Neighbourhood centroid — sent to ALL clients in search and detail responses.
     * GeoJSON Point: coordinates stored as [longitude, latitude] (longitude FIRST).
     * Never use this to infer the exact address.
     */
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
        // Expected: [lng, lat] — longitude first, per GeoJSON spec
      },
    },

    /**
     * Exact street address — NEVER returned to non-accepted guests.
     * The controller builds an explicit projection object; this field is
     * set to null / omitted in all list and detail responses unless the
     * requesting user has an accepted StayRequest (revealed in plan 02-03).
     */
    exactAddress: { type: String, required: true },

    /**
     * Slugified version of the host's homeCity (e.g. "new-york").
     * Used for Socket.io city group-chat room join in plans 02-04/05.
     */
    citySlug: { type: String, required: true, index: true },

    /**
     * Firebase Storage paths: listings/{listingId}/photos/{index}
     * Resolved to signed URLs by the controller before sending to clients.
     */
    photos: [{ type: String }],

    availabilityDates: [
      {
        from: { type: Date, required: true },
        to: { type: Date, required: true },
      },
    ],

    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

/**
 * 2dsphere index — REQUIRED for $near / $geoNear queries (Pitfall 3).
 * Declared in schema so Mongoose auto-creates it on first connection.
 */
listingSchema.index({ location: '2dsphere' });

module.exports = model('Listing', listingSchema);
