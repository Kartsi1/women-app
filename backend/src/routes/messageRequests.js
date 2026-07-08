const router = require('express').Router();
const { verifyFirebaseToken, requireVerified } = require('../middleware/auth');
const messageRequestController = require('../controllers/messageRequestController');

/**
 * Message request routes — all protected by verifyFirebaseToken + requireVerified.
 *
 * Static route /inbox is declared BEFORE the dynamic /:id so it is not shadowed
 * (mirrors the users.js pattern of static-before-dynamic).
 *
 * POST   /api/message-requests        — createMessageRequest (MSG-01)
 * GET    /api/message-requests/inbox  — getRequestInbox (MSG-02)
 * PATCH  /api/message-requests/:id    — updateRequestStatus (MSG-02, accept/decline)
 */

/**
 * POST /api/message-requests
 *
 * Send a message request with an intro to another verified user (MSG-01).
 * Body: { recipientUid: string, intro: string }
 * Security: senderUid from verified token (T-02-04-03).
 */
router.post('/', verifyFirebaseToken, requireVerified, messageRequestController.createMessageRequest);

/**
 * GET /api/message-requests/inbox
 *
 * Return pending message requests addressed to the authenticated user (MSG-02).
 * NOTE: declared BEFORE /:id to avoid being shadowed by the dynamic route.
 */
router.get('/inbox', verifyFirebaseToken, requireVerified, messageRequestController.getRequestInbox);

/**
 * PATCH /api/message-requests/:id
 *
 * Accept or decline a message request (MSG-02).
 * Body: { status: 'accepted' | 'declined' }
 * Security: recipient-only guard in controller (T-02-04-05).
 */
router.patch('/:id', verifyFirebaseToken, requireVerified, messageRequestController.updateRequestStatus);

module.exports = router;
