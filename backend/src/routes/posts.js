const router = require('express').Router();
const multer = require('multer');
const { verifyFirebaseToken, requireVerified } = require('../middleware/auth');
const postController = require('../controllers/postController');

// Single photo upload — field name 'photo', max 5 MB (T-03-01-04)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('photo');

// GET '/' declared before any future dynamic '/:id' route (static-before-dynamic rule)
// T-03-01-02: verifyFirebaseToken + requireVerified on every route
router.get('/', verifyFirebaseToken, requireVerified, postController.getFeed);
router.post('/', verifyFirebaseToken, requireVerified, upload, postController.createPost);

module.exports = router;
