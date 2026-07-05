const router = require('express').Router();
const multer = require('multer');
const { verifyFirebaseToken } = require('../middleware/auth');
const userController = require('../controllers/userController');

/**
 * Multer configuration for verification document uploads (T-03-01 DoS mitigation).
 *
 * - memoryStorage: buffers are kept in memory and passed directly to Firebase
 *   Storage via the Admin SDK — no temporary disk files.
 * - limits.fileSize: 5MB per file (RESEARCH Pattern 5, T-03-01).
 * - fields: exactly one idDocument and one selfie per request.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
}).fields([
  { name: 'idDocument', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
]);

/**
 * POST /api/users/verification-docs
 *
 * Upload ID document photo and selfie for gender verification review.
 * Protected by verifyFirebaseToken — any signed-in user (verified or not)
 * can submit/resubmit documents (D-06: resubmit while pending is allowed).
 */
router.post('/verification-docs', verifyFirebaseToken, upload, userController.submitVerificationDocs);

/**
 * POST /api/users/push-token
 *
 * Register (or update) the Expo push token for the authenticated user.
 * Called by the mobile app after successful sign-in (Plan 04 uses this token
 * to send approval/rejection notifications).
 */
router.post('/push-token', verifyFirebaseToken, userController.savePushToken);

module.exports = router;

// ── PLAN 05 SLOT ─────────────────────────────────────────────────────────────
// Plan 05 (user profiles) will append:
//   router.put('/profile', verifyFirebaseToken, requireVerified, userController.updateProfile);
//   router.get('/:uid', verifyFirebaseToken, requireVerified, userController.getProfile);
// ─────────────────────────────────────────────────────────────────────────────

// ── PLAN 06 SLOT ─────────────────────────────────────────────────────────────
// Plan 06 (block / report) will append:
//   router.post('/block/:uid', verifyFirebaseToken, requireVerified, userController.blockUser);
//   router.post('/report', verifyFirebaseToken, requireVerified, userController.reportUser);
// ─────────────────────────────────────────────────────────────────────────────
