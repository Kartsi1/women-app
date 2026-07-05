const User = require('../models/User');
const { uploadVerificationDoc, getSignedUrl, uploadFile } = require('../services/storageService');

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

/**
 * PUT /api/users/profile
 *
 * Update the authenticated user's display name, bio, and home city.
 *
 * Body: { displayName?, bio?, homeCity? }
 * Success response: { data: user }
 * Error responses:
 *   400 — bio exceeds 500 characters
 *   404 — user document not found (should not happen for verified users)
 *   500 — unexpected server error
 */
async function updateProfile(req, res) {
  try {
    const { displayName, bio, homeCity } = req.body;

    // T-05-04: enforce bio maxlength before hitting the DB constraint
    if (bio !== undefined && bio.length > 500) {
      return res.status(400).json({ error: 'bio must not exceed 500 characters' });
    }

    const update = {};
    if (displayName !== undefined) update.displayName = String(displayName).trim();
    if (bio !== undefined) update.bio = String(bio);
    if (homeCity !== undefined) update.homeCity = String(homeCity).trim();

    const user = await User.findOneAndUpdate(
      { firebaseUid: req.user.uid },
      update,
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ data: user });
  } catch (err) {
    console.error('[updateProfile]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/users/:uid
 *
 * Return the public profile projection for another verified user.
 *
 * T-05-02: explicit projection — no private fields (email, verificationDocumentUrl, etc.)
 * T-05-03: requester in target.blockedUsers → 403 (VERI-06 block enforcement)
 *
 * Success response: { data: { uid, displayName, bio, homeCity, photoURL, isVerified,
 *                             hostsCount, tripsCount } }
 * Error responses:
 *   403 — requester is blocked by target
 *   404 — target user not found
 *   500 — unexpected server error
 */
async function getProfile(req, res) {
  try {
    const target = await User.findOne({ firebaseUid: req.params.uid });
    if (!target) return res.status(404).json({ error: 'User not found' });

    // T-05-03: block state enforcement — does the target have the requester blocked?
    if (Array.isArray(target.blockedUsers) && target.blockedUsers.includes(req.user.uid)) {
      return res.status(403).json({ error: 'Not available' });
    }

    // T-05-02: build an explicit public projection — never expose the raw User document
    const photoURL = target.photoURL ? await getSignedUrl(target.photoURL) : null;

    const data = {
      uid: target.firebaseUid,
      displayName: target.displayName,
      bio: target.bio,
      homeCity: target.homeCity,
      photoURL,
      isVerified: target.verificationStatus === 'approved',
      hostsCount: target.hostsCount,
      tripsCount: target.tripsCount,
    };

    res.json({ data });
  } catch (err) {
    console.error('[getProfile]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/users/profile-photo
 *
 * Upload or replace the authenticated user's profile photo.
 * Accepts a multipart upload (via multer memoryStorage.single) containing:
 *   - photo (required, image/*)
 *
 * Validates MIME type (T-05-04), streams the buffer to Firebase Storage under
 * profiles/<uid>/photo, then updates the user's photoURL field to that path.
 * Callers resolve the path to a signed URL via getProfile or getMyProfile.
 *
 * Success response: { status: 'ok' }
 * Error responses:
 *   400 — missing file or non-image MIME type
 *   500 — unexpected server error
 */
async function uploadProfilePhoto(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'photo file is required' });
    }

    // T-05-04: reject non-image MIME types
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'photo must be an image file' });
    }

    const { uid } = req.user;
    const storagePath = `profiles/${uid}/photo`;

    await uploadFile(storagePath, req.file.buffer, req.file.mimetype);

    await User.findOneAndUpdate(
      { firebaseUid: uid },
      { photoURL: storagePath }
    );

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('[uploadProfilePhoto]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { submitVerificationDocs, savePushToken, updateProfile, getProfile, uploadProfilePhoto };

// ── PLAN 06 SLOT ─────────────────────────────────────────────────────────────
// Plan 06 (block / report) will add:
//   blockUser(req, res)       — POST /api/users/block/:uid
//   reportUser(req, res)      — POST /api/users/report
// ─────────────────────────────────────────────────────────────────────────────
