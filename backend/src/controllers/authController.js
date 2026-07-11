const User = require('../models/User');

async function register(req, res) {
  try {
    const { uid, email } = req.user;
    let user = await User.findOne({ firebaseUid: uid });

    // Reconcile a pre-existing mirror keyed on the same (Firebase-verified) email whose
    // firebaseUid changed — e.g. the Firebase account was deleted and recreated. Without
    // this, User.create hits the unique email index and throws E11000. verifyFirebaseToken
    // already proved the caller owns this email, so adopting the new uid is safe.
    if (!user && email) {
      const byEmail = await User.findOne({ email });
      if (byEmail) {
        byEmail.firebaseUid = uid;
        user = await byEmail.save();
      }
    }

    if (!user) {
      user = await User.create({ firebaseUid: uid, email });
    }
    return res.status(201).json({ data: user });
  } catch (err) {
    // Idempotent fallback: a concurrent/duplicate register raced us — return the existing doc.
    if (err && err.code === 11000) {
      const { uid, email } = req.user;
      const existing = await User.findOne({ $or: [{ firebaseUid: uid }, { email }] });
      if (existing) return res.status(200).json({ data: existing });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { register };
