const router = require('express').Router();
const { verifyFirebaseToken } = require('../middleware/auth');
const authController = require('../controllers/authController');

// POST /api/auth/register — creates MongoDB user from verified Firebase token
router.post('/register', verifyFirebaseToken, authController.register);

module.exports = router;
