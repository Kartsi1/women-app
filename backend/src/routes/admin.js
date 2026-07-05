const router = require('express').Router();
const jwt = require('jsonwebtoken');
const adminController = require('../controllers/adminController');

/**
 * Middleware: verify that the request carries a valid admin session JWT.
 * Checks the Bearer token is signed with ADMIN_JWT_SECRET and has role:'admin'.
 * Returns 401 on missing, invalid, or non-admin tokens (T-04-02).
 */
function verifyAdminSession(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    if (decoded.role !== 'admin') throw new Error('Not admin role');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid admin session' });
  }
}

// POST /api/admin/login — no session guard (public)
router.post('/login', adminController.login);

// GET /api/admin/verification-queue — requires admin session
router.get('/verification-queue', verifyAdminSession, adminController.getQueue);

// POST /api/admin/approve/:uid — requires admin session
router.post('/approve/:uid', verifyAdminSession, adminController.approveUser);

// POST /api/admin/reject/:uid — requires admin session
router.post('/reject/:uid', verifyAdminSession, adminController.rejectUser);

module.exports = router;
