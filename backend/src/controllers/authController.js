const User = require('../models/User');

async function register(req, res) {
  try {
    const { uid, email } = req.user;
    let user = await User.findOne({ firebaseUid: uid });
    if (!user) {
      user = await User.create({ firebaseUid: uid, email });
    }
    res.status(201).json({ data: user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { register };
