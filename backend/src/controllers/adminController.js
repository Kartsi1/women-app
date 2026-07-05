const jwt = require('jsonwebtoken');
const { getAuth } = require('firebase-admin/auth');
const User = require('../models/User');
const { getSignedUrl } = require('../services/storageService');
const { sendPushNotification } = require('../services/notificationService');

/**
 * POST /api/admin/login
 * Validate admin credentials from env; issue 8h JWT session token.
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { role: 'admin' },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/admin/verification-queue
 * Return all users with verificationStatus:'pending', each with short-lived
 * signed URLs for the ID document and selfie (via storageService.getSignedUrl).
 */
async function getQueue(req, res) {
  try {
    const users = await User.find({ verificationStatus: 'pending' }).lean();
    const queue = await Promise.all(
      users.map(async (user) => ({
        uid: user.firebaseUid,
        email: user.email,
        docUrl: user.verificationDocumentUrl
          ? await getSignedUrl(user.verificationDocumentUrl)
          : null,
        selfieUrl: user.selfieUrl
          ? await getSignedUrl(user.selfieUrl)
          : null,
        createdAt: user.createdAt,
      }))
    );
    res.json({ queue });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/admin/approve/:uid
 * Approve a pending user:
 *   1. Update MongoDB verificationStatus to 'approved'
 *   2. Set Firebase custom claim { isVerified: true }  (D-08)
 *   3. Send push notification to user's Expo push token
 */
async function approveUser(req, res) {
  try {
    const { uid } = req.params;
    if (!uid) {
      return res.status(400).json({ error: 'uid is required' });
    }

    const user = await User.findOneAndUpdate(
      { firebaseUid: uid },
      { verificationStatus: 'approved' },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Set custom claim — mobile picks it up on next getIdToken(true) (D-08)
    await getAuth().setCustomUserClaims(uid, { isVerified: true });

    // Push notification (best-effort — no token is fine)
    await sendPushNotification(
      user.expoPushToken,
      "You're verified!",
      'Your account has been approved. Tap to enter the app.',
      { type: 'verification_approved' }
    );

    res.json({ status: 'approved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/admin/reject/:uid
 * Reject a pending user:
 *   1. Require req.body.reason (400 if absent — D-07)
 *   2. Update MongoDB verificationStatus to 'rejected' and save the reason
 *   3. Send push notification (does NOT set any custom claim)
 */
async function rejectUser(req, res) {
  try {
    const { uid } = req.params;
    if (!uid) {
      return res.status(400).json({ error: 'uid is required' });
    }

    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'reason is required for rejection (D-07)' });
    }

    const user = await User.findOneAndUpdate(
      { firebaseUid: uid },
      { verificationStatus: 'rejected', rejectionReason: reason.trim() },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Push notification (informational only — claim NOT set; D-07)
    await sendPushNotification(
      user.expoPushToken,
      'Verification update',
      `Your verification was not approved. Reason: ${reason.trim()}`,
      { type: 'verification_rejected' }
    );

    res.json({ status: 'rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { login, getQueue, approveUser, rejectUser };
