const router = require('express').Router();
const { verifyFirebaseToken, requireVerified } = require('../middleware/auth');
const reviewController = require('../controllers/reviewController');

/**
 * Review routes — REVW-01/02/03
 *
 * All routes require:
 *   - verifyFirebaseToken: sets req.user.uid from Firebase token
 *   - requireVerified: 403 if user account is not verified
 *
 * IMPORTANT: /user/:uid is declared BEFORE /:stayRequestId to prevent
 * the dynamic segment from shadowing the static /user prefix.
 *
 * NOTE: No PUT/PATCH route exists — reviews are IMMUTABLE after submit (T-03-03-03).
 */

/**
 * POST /api/reviews
 *
 * Submit a review for a completed stay.
 * Body: { stayRequestId, rating (1-5), text (min 20 chars) }
 * Success: 201 { data: { id } }
 */
router.post(
  '/',
  verifyFirebaseToken,
  requireVerified,
  reviewController.createReview
);

/**
 * GET /api/reviews/user/:uid
 *
 * Get the revealed review aggregation for a user profile.
 * Returns only revealed reviews (aggregation excludes unrevealed).
 *
 * Declared BEFORE /:stayRequestId to avoid route shadowing.
 */
router.get(
  '/user/:uid',
  verifyFirebaseToken,
  requireVerified,
  reviewController.getUserReviews
);

/**
 * GET /api/reviews/:stayRequestId
 *
 * Get the blind-release review state for a stay.
 * Counterpart review only visible after reveal predicate fires.
 * 403 if caller is not a participant of this stay.
 */
router.get(
  '/:stayRequestId',
  verifyFirebaseToken,
  requireVerified,
  reviewController.getStayReviews
);

// DO NOT ADD router.put or router.patch — reviews are immutable

module.exports = router;
