const router = require('express').Router();
const multer = require('multer');
const { verifyFirebaseToken, requireVerified } = require('../middleware/auth');
const listingController = require('../controllers/listingController');

/**
 * Multer configuration for listing photo uploads.
 *
 * - memoryStorage: buffers passed directly to Firebase Storage via Admin SDK.
 * - limits.fileSize: 5MB per file (T-02-02-04 DoS mitigation).
 * - .array('photos', 10): field named 'photos', max 10 files (T-02-02-04).
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
}).array('photos', 10);

/**
 * GET /api/listings/search
 *
 * Search listings by geographic location and optional date range.
 * Declared BEFORE /:id to prevent the dynamic segment from shadowing this route.
 *
 * Query params: lat, lng, radiusM, fromDate, toDate
 * Auth: verifyFirebaseToken + requireVerified (T-02-02-03)
 * Security: exactAddress deliberately omitted from response (T-02-02-01)
 */
router.get(
  '/search',
  verifyFirebaseToken,
  requireVerified,
  listingController.searchListings
);

/**
 * POST /api/listings
 *
 * Create a new housing listing with photos and neighbourhood location.
 * Auth: verifyFirebaseToken + requireVerified (T-02-02-03)
 *
 * Multipart fields: title, description, houseRules, citySlug, exactAddress,
 *   coordinates (JSON "[lng, lat]"), availabilityDates (JSON), photos[] (images).
 */
router.post(
  '/',
  verifyFirebaseToken,
  requireVerified,
  upload,
  listingController.createListing
);

/**
 * GET /api/listings/:id
 *
 * Fetch listing detail. Returns addressRevealed=false in plan 02-02.
 * Declared AFTER /search to avoid route shadowing.
 * Auth: verifyFirebaseToken + requireVerified (T-02-02-03)
 */
router.get(
  '/:id',
  verifyFirebaseToken,
  requireVerified,
  listingController.getListingDetail
);

module.exports = router;
