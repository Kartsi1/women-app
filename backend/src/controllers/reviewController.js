const StayRequest = require('../models/StayRequest');
const Review = require('../models/Review');

/**
 * Review controller — REVW-01/02/03
 *
 * Security mitigations:
 *   T-03-03-01: Blind-release gate computed server-side at read time;
 *               counterpart text ABSENT from response until revealed.
 *   T-03-03-02: reviewerUid from req.user.uid — NEVER from body.
 *               subjectUid + direction derived from StayRequest, never body.
 *   T-03-03-03: No PUT/PATCH route exists — reviews are immutable.
 *   T-03-03-04: Participant-only: 403 unless caller is stay.guestUid or stay.hostUid.
 *   T-03-03-05: 422 when now < checkOut; 422 when status !== 'accepted'.
 *   T-03-03-06: Unique (stayRequestId, direction) index + E11000→409 mapping.
 */

/**
 * POST /api/reviews
 *
 * Submit a review for a completed stay.
 *
 * Security: reviewerUid from token; subjectUid + direction derived from StayRequest.
 * Body: { stayRequestId, rating (1-5), text (min 20 chars) }
 * Success: 201 { data: { id } }
 */
async function createReview(req, res) {
  try {
    const callerUid = req.user.uid; // T-03-03-02: NEVER from body
    const { stayRequestId, rating, text } = req.body;

    // --- Load StayRequest for eligibility checks ---
    const stay = await StayRequest.findById(stayRequestId)
      .select('guestUid hostUid checkOut status')
      .lean();
    if (!stay) {
      return res.status(404).json({ error: 'Stay not found' });
    }

    // --- T-03-03-04: Participant-only gate ---
    const isGuest = callerUid === stay.guestUid;
    const isHost  = callerUid === stay.hostUid;
    if (!isGuest && !isHost) {
      return res.status(403).json({ error: 'Not a participant of this stay' });
    }

    // --- T-03-03-05: Stay must be accepted ---
    if (stay.status !== 'accepted') {
      return res.status(422).json({ error: 'Stay was not accepted' });
    }

    // --- T-03-03-05: Stay must have ended ---
    if (new Date() < stay.checkOut) {
      return res.status(422).json({ error: 'Stay has not ended yet' });
    }

    // --- Derive direction and subjectUid server-side (T-03-03-02) ---
    const direction  = isGuest ? 'guest_to_host' : 'host_to_guest';
    const subjectUid = isGuest ? stay.hostUid    : stay.guestUid;

    // --- T-03-03-06: One review per direction per stay (pre-check before create) ---
    const existing = await Review.findOne({ stayRequestId, direction });
    if (existing) {
      return res.status(409).json({ error: 'Review already submitted for this direction' });
    }

    // --- Validate rating ---
    const ratingNum = Number(rating);
    if (!rating || isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'rating must be a number between 1 and 5' });
    }

    // --- Validate text length ---
    if (!text || typeof text !== 'string' || text.trim().length < 20) {
      return res.status(400).json({ error: 'text must be at least 20 characters' });
    }

    // --- Create review (race-safe: E11000 on unique index → 409) ---
    let review;
    try {
      review = await Review.create({
        stayRequestId,
        reviewerUid: callerUid,
        subjectUid,
        direction,
        rating: ratingNum,
        text: text.trim(),
      });
    } catch (err) {
      // T-03-03-06: duplicate key error (race condition)
      if (err.code === 11000) {
        return res.status(409).json({ error: 'Review already submitted for this direction' });
      }
      throw err;
    }

    return res.status(201).json({ data: { id: review._id } });
  } catch (err) {
    console.error('[createReview]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/reviews/:stayRequestId
 *
 * Get the review state for a stay. Returns own review and — only when
 * the reveal predicate fires — the counterpart review.
 *
 * BLIND-RELEASE GATE (T-03-03-01):
 *   revealed = (both directions submitted) OR (now >= checkOut + 14 days)
 *   Before reveal: counterpartReview is NULL and MUST NOT appear in the response.
 *   Explicit projection — never spread the raw counterpart document.
 *
 * Auth: verifyFirebaseToken + requireVerified (in router)
 * 403: caller is neither guest nor host of this stay
 */
async function getStayReviews(req, res) {
  try {
    const callerUid      = req.user.uid;
    const { stayRequestId } = req.params;

    // --- Load StayRequest ---
    const stay = await StayRequest.findById(stayRequestId)
      .select('guestUid hostUid checkOut status')
      .lean();
    if (!stay) {
      return res.status(404).json({ error: 'Stay not found' });
    }

    // --- T-03-03-04: Participant-only gate ---
    if (callerUid !== stay.guestUid && callerUid !== stay.hostUid) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const now = new Date();

    // --- Not-eligible state: stay not accepted or not yet ended ---
    if (stay.status !== 'accepted' || stay.checkOut > now) {
      return res.json({ state: 'not_eligible', ownReview: null, counterpartReview: null });
    }

    // --- Derive directions ---
    const callerDirection      = callerUid === stay.guestUid ? 'guest_to_host' : 'host_to_guest';
    const counterpartDirection = callerDirection === 'guest_to_host' ? 'host_to_guest' : 'guest_to_host';

    // --- Load both reviews with explicit projection (T-03-03-01) ---
    const [ownReview, counterpartReview] = await Promise.all([
      Review.findOne({ stayRequestId, direction: callerDirection })
        .select('rating text submittedAt')
        .lean(),
      Review.findOne({ stayRequestId, direction: counterpartDirection })
        .select('rating text submittedAt')
        .lean(),
    ]);

    // --- BLIND-RELEASE PREDICATE — computed server-side at read time ---
    const revealDeadline = new Date(stay.checkOut.getTime() + 14 * 24 * 60 * 60 * 1000);
    const bothSubmitted  = !!(ownReview && counterpartReview);
    const revealed       = bothSubmitted || (now >= revealDeadline);

    const state = revealed ? 'revealed' : (ownReview ? 'waiting' : 'eligible');

    // --- EXPLICIT PROJECTION GATE (T-03-03-01) ---
    // Mirror of exactAddress hiding in listingController (T-02-02-01).
    // The counterpart review is built by EXPLICITLY picking fields — NEVER spread.
    // When not revealed: counterpartReview is null. Its text MUST NOT appear anywhere.
    const safeCounterpart = (revealed && counterpartReview)
      ? {
          rating:      counterpartReview.rating,
          text:        counterpartReview.text,
          submittedAt: counterpartReview.submittedAt,
        }
      : null;

    return res.json({
      state,
      revealDeadline: revealDeadline.toISOString(),
      ownReview: ownReview
        ? {
            rating:      ownReview.rating,
            text:        ownReview.text,
            submittedAt: ownReview.submittedAt,
          }
        : null,
      counterpartReview: safeCounterpart,
    });
  } catch (err) {
    console.error('[getStayReviews]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/reviews/user/:uid
 *
 * Get the public review aggregation for a user.
 * Counts and lists ONLY revealed reviews — unrevealed reviews are excluded.
 *
 * Auth: verifyFirebaseToken + requireVerified (in router)
 * Response: { data: { avgRating, reviewCount, reviews: [...] } }
 */
async function getUserReviews(req, res) {
  try {
    const subjectUid = req.params.uid;

    // --- Load all reviews where the user is the subject ---
    const allReviews = await Review.find({ subjectUid })
      .select('rating text submittedAt reviewerUid stayRequestId direction')
      .lean();

    if (allReviews.length === 0) {
      return res.json({ data: { avgRating: null, reviewCount: 0, reviews: [] } });
    }

    // --- For each review, determine if it's revealed ---
    // A review is revealed when: (both directions submitted) OR (now >= checkOut + 14d)
    const now = new Date();

    // Collect unique stayRequestIds
    const stayIds = [...new Set(allReviews.map((r) => String(r.stayRequestId)))];

    // Load stay checkOut dates for all stays at once
    const stays = await StayRequest.find({ _id: { $in: stayIds } })
      .select('checkOut')
      .lean();
    const stayMap = {};
    for (const s of stays) {
      stayMap[String(s._id)] = s;
    }

    // Load all reviews for those stays to check bothSubmitted
    const stayReviews = await Review.find({ stayRequestId: { $in: stayIds } })
      .select('stayRequestId direction')
      .lean();

    // Build a set of "stayId:direction" combinations that exist
    const submittedSet = new Set();
    for (const r of stayReviews) {
      submittedSet.add(`${String(r.stayRequestId)}:${r.direction}`);
    }

    // Filter to revealed reviews only
    const revealedReviews = allReviews.filter((r) => {
      const stay = stayMap[String(r.stayRequestId)];
      if (!stay) return false;

      const revealDeadline = new Date(stay.checkOut.getTime() + 14 * 24 * 60 * 60 * 1000);

      // The counterpart direction
      const counterpartDir = r.direction === 'guest_to_host' ? 'host_to_guest' : 'guest_to_host';
      const counterpartKey = `${String(r.stayRequestId)}:${counterpartDir}`;
      const bothSubmitted  = submittedSet.has(counterpartKey);

      return bothSubmitted || (now >= revealDeadline);
    });

    // --- Compute aggregation from revealed reviews only ---
    const reviewCount = revealedReviews.length;
    const avgRating   = reviewCount > 0
      ? revealedReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
      : null;

    return res.json({
      data: {
        avgRating,
        reviewCount,
        reviews: revealedReviews.map((r) => ({
          rating:      r.rating,
          text:        r.text,
          submittedAt: r.submittedAt,
          reviewerUid: r.reviewerUid,
        })),
      },
    });
  } catch (err) {
    console.error('[getUserReviews]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { createReview, getStayReviews, getUserReviews };
