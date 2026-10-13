const User = require('../models/User');
const { getSignedUrl } = require('./storageService');

/**
 * getUserSummaries — batch-resolve display name + signed avatar URL for a list of
 * Firebase UIDs. Mirrors the read-time author join in postController (names are
 * never snapshotted, so profile renames show up everywhere).
 *
 * Security (T-umq-01): explicit projection — only firebaseUid, displayName and
 * photoURL are read; the photo is exposed only as a short-lived signed URL.
 *
 * @param {string[]} uids Firebase UIDs (falsy / duplicate values are ignored)
 * @returns {Promise<Object<string, {displayName: string|null, photoUrl: string|null}>>}
 */
async function getUserSummaries(uids) {
  const unique = [...new Set((uids || []).filter(Boolean))];
  if (unique.length === 0) return {};

  const users = await User.find({ firebaseUid: { $in: unique } })
    .select('firebaseUid displayName photoURL')
    .lean();

  const summaries = {};
  for (const user of users) {
    let photoUrl = null;
    if (user.photoURL) {
      try { photoUrl = await getSignedUrl(user.photoURL); } catch { photoUrl = null; }
    }
    summaries[user.firebaseUid] = { displayName: user.displayName || null, photoUrl };
  }
  return summaries;
}

module.exports = { getUserSummaries };
