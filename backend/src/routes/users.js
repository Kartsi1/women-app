const router = require('express').Router();
const multer = require('multer');
const { verifyFirebaseToken, requireVerified } = require('../middleware/auth');
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

/**
 * Multer configuration for single profile photo uploads (T-05-04 MIME + size guard).
 *
 * - memoryStorage: buffer streamed directly to Firebase Storage via Admin SDK.
 * - limits.fileSize: 5MB per file (matches verification-docs limit).
 * - .single('photo'): one field named 'photo'.
 */
const uploadSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single('photo');

/**
 * PUT /api/users/profile
 *
 * Update display name, bio, and home city for the authenticated verified user.
 * Body: { displayName?, bio?, homeCity? }
 * T-05-01: guarded by verifyFirebaseToken + requireVerified.
 */
router.put('/profile', verifyFirebaseToken, requireVerified, userController.updateProfile);

/**
 * POST /api/users/profile-photo
 *
 * Upload or replace the authenticated verified user's profile photo.
 * Multipart form field: 'photo' (image/*, max 5 MB).
 * T-05-01: guarded by verifyFirebaseToken + requireVerified.
 * T-05-04: MIME type validated in uploadProfilePhoto controller.
 *
 * NOTE: declared BEFORE the /:uid route to avoid being shadowed.
 */
router.post('/profile-photo', verifyFirebaseToken, requireVerified, uploadSingle, userController.uploadProfilePhoto);

/**
 * GET /api/users/:uid
 *
 * Return the public profile projection for a verified user by Firebase UID.
 * T-05-01: guarded by verifyFirebaseToken + requireVerified.
 * T-05-02: explicit projection only (no email, no verification docs).
 * T-05-03: 403 if requester is in target's blockedUsers.
 *
 * NOTE: declared last among profile routes so static paths (/profile, /profile-photo,
 * /verification-docs, /push-token) are matched first.
 */
router.get('/:uid', verifyFirebaseToken, requireVerified, userController.getProfile);

module.exports = router;

// ── PLAN 06 SLOT ─────────────────────────────────────────────────────────────
// Plan 06 (block / report) will append:
//   router.post('/block/:uid', verifyFirebaseToken, requireVerified, userController.blockUser);
//   router.post('/report', verifyFirebaseToken, requireVerified, userController.reportUser);
// ─────────────────────────────────────────────────────────────────────────────
