const router = require('express').Router();
const { verifyFirebaseToken, requireVerified } = require('../middleware/auth');
const conversationController = require('../controllers/conversationController');

/**
 * Conversation routes — all protected by verifyFirebaseToken + requireVerified.
 *
 * GET  /api/conversations               — listConversations (MSG-03)
 * GET  /api/conversations/:id/messages  — getMessages (MSG-03, T-02-04-01)
 */

/**
 * GET /api/conversations
 *
 * List all conversations where the authenticated user is a participant.
 * Results sorted by lastMessageAt descending.
 */
router.get('/', verifyFirebaseToken, requireVerified, conversationController.listConversations);

/**
 * GET /api/conversations/:id/messages
 *
 * Paginated message history for a specific conversation.
 * Query params: before (ISO date cursor), limit (default 30, max 50).
 * Security: 403 if caller is not a participant (T-02-04-01).
 */
router.get('/:id/messages', verifyFirebaseToken, requireVerified, conversationController.getMessages);

module.exports = router;
