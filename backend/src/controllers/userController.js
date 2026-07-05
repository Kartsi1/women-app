const User = require('../models/User');
const { uploadVerificationDoc } = require('../services/storageService');

/**
 * POST /api/users/verification-docs
 *
 * Accepts a multipart upload (via multer memoryStorage.fields) containing:
 *   - idDocument (required, image/*)
 *   - selfie    (required, image/*)
 *
 * Validates presence and MIME type (ASVS V5, T-03-04), streams both buffers
 * to protected Firebase Storage paths, then flips the user's verificationStatus
 * to 'pending' in MongoDB (D-06: resubmit is allowed — latest upload replaces
 * the previous one because the same Storage path is overwritten).
 *
 * Success response: { status: 'pending' }
 * Error responses:
 *   400 — missing file or non-image MIME type
 *   500 — unexpected server error
 */
async function submitVerificationDocs(req, res) {
  try {
    const { uid } = req.user;

    const idDocFile = req.files && req.files['idDocument'] && req.files['idDocument'][0];
    const selfieFile = req.files && req.files['selfie'] && req.files['selfie'][0];

    if (!idDocFile || !selfieFile) {
      return res.status(400).json({ error: 'Both idDocument and selfie are required' });
    }

    // ASVS V5 — reject non-image MIME types (T-03-04)
    if (!idDocFile.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'idDocument must be an image file' });
    }
    if (!selfieFile.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'selfie must be an image file' });
    }

    // Upload to protected Storage paths — existing objects are overwritten (D-06)
    await uploadVerificationDoc(uid, 'id-document', idDocFile.buffer, idDocFile.mimetype);
    await uploadVerificationDoc(uid, 'selfie', selfieFile.buffer, selfieFile.mimetype);

    // Record fixed Storage paths and flip verificationStatus to 'pending'
    await User.findOneAndUpdate(
      { firebaseUid: uid },
      {
        verificationStatus: 'pending',
        verificationDocumentUrl: `verification/${uid}/id-document`,
        selfieUrl: `verification/${uid}/selfie`,
      }
    );

    res.json({ status: 'pending' });
  } catch (err) {
    console.error('[submitVerificationDocs]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/users/push-token
 *
 * Stores (or updates) the Expo push token for the authenticated user so that
 * Plan 04 (admin approval/rejection) can deliver push notifications.
 *
 * Body: { expoPushToken: string }
 * Success response: { status: 'ok' }
 */
async function savePushToken(req, res) {
  try {
    const { expoPushToken } = req.body;
    if (!expoPushToken || typeof expoPushToken !== 'string') {
      return res.status(400).json({ error: 'expoPushToken is required' });
    }

    await User.findOneAndUpdate(
      { firebaseUid: req.user.uid },
      { expoPushToken }
    );

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('[savePushToken]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { submitVerificationDocs, savePushToken };

// ── PLAN 05 SLOT ─────────────────────────────────────────────────────────────
// Plan 05 (user profiles) will add:
//   updateProfile(req, res)   — PUT /api/users/profile
//   getProfile(req, res)      — GET /api/users/:uid
// ─────────────────────────────────────────────────────────────────────────────

// ── PLAN 06 SLOT ─────────────────────────────────────────────────────────────
// Plan 06 (block / report) will add:
//   blockUser(req, res)       — POST /api/users/block/:uid
//   reportUser(req, res)      — POST /api/users/report
// ─────────────────────────────────────────────────────────────────────────────
