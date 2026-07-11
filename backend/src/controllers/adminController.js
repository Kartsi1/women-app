const jwt = require('jsonwebtoken');
const { getAuth } = require('firebase-admin/auth');
const User = require('../models/User');
const Report = require('../models/Report');
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

/**
 * GET /api/admin/users
 * Return all users (newest first) for the admin panel user list.
 * Admin-session gated; excludes verification document URLs (queue endpoint covers those).
 */
async function getUsers(req, res) {
  try {
    const users = await User.find({}).sort({ createdAt: -1 }).lean();
    const list = users.map((u) => ({
      uid: u.firebaseUid,
      email: u.email,
      displayName: u.displayName || null,
      homeCity: u.homeCity || null,
      verificationStatus: u.verificationStatus,
      banned: u.banned ?? false,
      hostsCount: u.hostsCount ?? 0,
      tripsCount: u.tripsCount ?? 0,
      createdAt: u.createdAt,
    }));
    res.json({ users: list });
  } catch (err) {
    console.error('[admin getUsers]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/admin/ban/:uid  — set banned=true.
 * POST /api/admin/unban/:uid — set banned=false.
 * Banned users are blocked from all authenticated endpoints (verifyFirebaseToken).
 */
async function setBanned(uid, banned, res) {
  const user = await User.findOneAndUpdate(
    { firebaseUid: uid },
    { banned },
    { new: true }
  ).lean();
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ status: banned ? 'banned' : 'unbanned' });
}

async function banUser(req, res) {
  try {
    return await setBanned(req.params.uid, true, res);
  } catch (err) {
    console.error('[admin banUser]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function unbanUser(req, res) {
  try {
    return await setBanned(req.params.uid, false, res);
  } catch (err) {
    console.error('[admin unbanUser]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/admin/reports — all reports, newest first, with reporter/reported names.
 */
async function getReports(req, res) {
  try {
    const reports = await Report.find({}).sort({ createdAt: -1 }).lean();
    const uids = [
      ...new Set(
        reports.flatMap((r) => [r.reporterUid, r.reportedUid]).filter(Boolean)
      ),
    ];
    const users = await User.find({ firebaseUid: { $in: uids } })
      .select('firebaseUid displayName email')
      .lean();
    const nameMap = Object.fromEntries(
      users.map((u) => [u.firebaseUid, u.displayName || u.email])
    );
    const list = reports.map((r) => ({
      id: String(r._id),
      reporterUid: r.reporterUid,
      reporterName: nameMap[r.reporterUid] || r.reporterUid,
      reportedUid: r.reportedUid,
      reportedName: r.reportedUid ? nameMap[r.reportedUid] || r.reportedUid : null,
      contentType: r.contentType || null,
      contentId: r.contentId,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt,
    }));
    res.json({ reports: list });
  } catch (err) {
    console.error('[admin getReports]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/admin/reports/:id/resolve — mark a report resolved.
 */
async function resolveReport(req, res) {
  try {
    const rep = await Report.findByIdAndUpdate(
      req.params.id,
      { status: 'resolved' },
      { new: true }
    ).lean();
    if (!rep) return res.status(404).json({ error: 'Report not found' });
    res.json({ status: 'resolved' });
  } catch (err) {
    console.error('[admin resolveReport]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  login,
  getQueue,
  approveUser,
  rejectUser,
  getUsers,
  banUser,
  unbanUser,
  getReports,
  resolveReport,
};
