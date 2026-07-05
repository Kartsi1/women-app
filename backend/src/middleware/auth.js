const { getAuth } = require('firebase-admin/auth');

async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      isVerified: decodedToken.isVerified || false,
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireVerified(req, res, next) {
  if (!req.user?.isVerified) {
    return res.status(403).json({ error: 'Account not verified' });
  }
  next();
}

module.exports = { verifyFirebaseToken, requireVerified };
