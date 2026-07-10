/**
 * Comments router — mounted at /api/posts/:id/comments (mergeParams: true).
 *
 * mergeParams allows commentController to access req.params.id (the postId)
 * even though it is defined on the parent posts router.
 *
 * All routes gated by verifyFirebaseToken + requireVerified (T-03-02-04).
 */
const router = require('express').Router({ mergeParams: true });
const { verifyFirebaseToken, requireVerified } = require('../middleware/auth');
const commentController = require('../controllers/commentController');

router.post('/', verifyFirebaseToken, requireVerified, commentController.createComment);
router.get('/',  verifyFirebaseToken, requireVerified, commentController.getComments);

module.exports = router;
