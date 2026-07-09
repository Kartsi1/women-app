const Listing = require('../models/Listing');
const StayRequest = require('../models/StayRequest');
const User = require('../models/User');
const { sendPushNotification } = require('../services/notificationService');

/**
 * POST /api/requests
 *
 * Create a stay request from a verified guest to a listing host.
 *
 * Security mitigations:
 *   T-02-03-04: guestUid derived from the verified token — never from request body.
 *   T-02-03-03: rejects when req.user.uid === listing.ownerUid (cannot request own listing).
 *   T-02-03-05: intro capped at 500 chars in schema + controller validation.
 *
 * Body: { listingId, checkIn (ISO date), checkOut (ISO date), intro (max 500) }
 * Success: 201 { data: { id } }
 */
async function createRequest(req, res) {
  try {
    const guestUid = req.user.uid; // T-02-03-04: always from token, never body
    const { listingId, checkIn, checkOut, intro } = req.body;

    // --- Validate required fields ---
    if (!listingId) {
      return res.status(400).json({ error: 'listingId is required' });
    }

    // --- Load target listing ---
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // --- T-02-03-03: Prevent self-request (Elevation of Privilege) ---
    if (guestUid === listing.ownerUid) {
      return res.status(403).json({ error: 'Cannot request your own listing' });
    }

    // --- Validate dates ---
    if (!checkIn || isNaN(Date.parse(checkIn))) {
      return res.status(400).json({ error: 'checkIn must be a valid date' });
    }
    if (!checkOut || isNaN(Date.parse(checkOut))) {
      return res.status(400).json({ error: 'checkOut must be a valid date' });
    }
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    if (checkOutDate < checkInDate) {
      return res.status(400).json({ error: 'checkOut must be on or after checkIn' });
    }

    // --- Validate intro ---
    if (!intro || typeof intro !== 'string' || intro.trim().length === 0) {
      return res.status(400).json({ error: 'intro is required' });
    }
    if (intro.length > 500) {
      return res.status(400).json({ error: 'intro must not exceed 500 characters' });
    }

    // --- Create StayRequest ---
    const request = await StayRequest.create({
      guestUid,
      hostUid: listing.ownerUid,
      listingId: listing._id,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      intro: intro.trim(),
      status: 'pending',
    });

    // --- Notify the host (no-op if host has no push token) ---
    const host = await User.findOne({ firebaseUid: listing.ownerUid });
    await sendPushNotification(
      host?.expoPushToken,
      'New stay request',
      `A guest has requested a stay at your listing.`,
      { type: 'stay_request', requestId: String(request._id) }
    );

    res.status(201).json({ data: { id: request._id } });
  } catch (err) {
    console.error('[createRequest]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/requests/inbox
 *
 * Return all stay requests where the authenticated user is the host.
 * Results are projected to safe fields — no guest private data leaked.
 *
 * Security: hostUid taken from the verified token — a user can only see
 *   requests for their own listings.
 */
async function getHostInbox(req, res) {
  try {
    const hostUid = req.user.uid;

    const requests = await StayRequest.find({ hostUid })
      .sort({ createdAt: -1 })
      .select('guestUid listingId checkIn checkOut intro status createdAt')
      .lean();

    res.json({ data: requests });
  } catch (err) {
    console.error('[getHostInbox]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PATCH /api/requests/:id
 *
 * Accept or decline a stay request.
 *
 * Security mitigations:
 *   T-02-03-02: rejects unless request.hostUid === req.user.uid (host-only).
 *   T-02-03-01: on acceptance, hostCount and tripsCount updated; guest notified.
 *
 * Body: { status: 'accepted' | 'declined' }
 * Success: 200 { data: updatedRequest }
 */
async function updateRequestStatus(req, res) {
  try {
    const { status } = req.body;

    // --- Validate status ---
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'status must be accepted or declined' });
    }

    // --- Load request ---
    const request = await StayRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Stay request not found' });
    }

    // --- T-02-03-02: host-only gate ---
    if (request.hostUid !== req.user.uid) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // --- Update status ---
    request.status = status;
    await request.save();

    // --- Update host/trip counters on acceptance ---
    if (status === 'accepted') {
      await User.findOneAndUpdate(
        { firebaseUid: request.hostUid },
        { $inc: { hostsCount: 1 } }
      );
      await User.findOneAndUpdate(
        { firebaseUid: request.guestUid },
        { $inc: { tripsCount: 1 } }
      );
    }

    // --- Notify the guest ---
    const guest = await User.findOne({ firebaseUid: request.guestUid });
    const title = status === 'accepted' ? 'Stay request accepted' : 'Stay request declined';
    const body = status === 'accepted'
      ? 'Your stay request was accepted! Check the listing for the address.'
      : 'Your stay request was declined.';
    await sendPushNotification(
      guest?.expoPushToken,
      title,
      body,
      { type: 'stay_request', requestId: String(request._id), status }
    );

    res.json({ data: request });
  } catch (err) {
    console.error('[updateRequestStatus]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { createRequest, getHostInbox, updateRequestStatus };
