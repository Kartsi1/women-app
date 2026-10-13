const { getAuth } = require('firebase-admin/auth');
const User = require('../models/User');

async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(idToken);
  } catch (error) {
    // Log only the failure reason — never the token, header, or claims.
    console.warn('[auth] verifyIdToken failed:', error.code || error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    // Ban enforcement: a banned user is blocked from every authenticated endpoint.
    const dbUser = await User.findOne({ firebaseUid: decodedToken.uid })
      .select('banned')
      .lean();
    if (dbUser?.banned) {
      return res.status(403).json({ error: 'Account banned' });
    }

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      isVerified: decodedToken.isVerified || false,
    };
    next();
  } catch (error) {
    // A DB failure must not look like an auth failure (client signs out on 401).
    console.error('[auth] user lookup failed:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function requireVerified(req, res, next) {
  if (!req.user?.isVerified) {
    return res.status(403).json({ error: 'Account not verified' });
  }
  next();
}

module.exports = { verifyFirebaseToken, requireVerified };
