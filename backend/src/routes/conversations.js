const router = require('express').Router();
const { verifyFirebaseToken, requireVerified } = require('../middleware/auth');
const conversationController = require('../controllers/conversationController');

/**
 * Conversation routes — all protected by verifyFirebaseToken + requireVerified.
 *
 * IMPORTANT: static routes (/city, /city/messages) MUST be declared BEFORE
 * the dynamic /:id/messages route to prevent Express from capturing 'city' as
 * the :id parameter. This is a routing precedence requirement (T-02-05-01).
 *
 * GET  /api/conversations                — listConversations (MSG-03)
 * GET  /api/conversations/city           — getCityInfo (MSG-04, 02-05)
 * GET  /api/conversations/city/messages  — getCityMessages (MSG-04, 02-05)
 * GET  /api/conversations/:id/messages   — getMessages (MSG-03, T-02-04-01)
 */

/**
 * GET /api/conversations
 *
 * List all conversations where the authenticated user is a participant.
 * Results sorted by lastMessageAt descending.
 */
router.get('/', verifyFirebaseToken, requireVerified, conversationController.listConversations);

/**
 * GET /api/conversations/city
 *
 * Return the city slug and home city derived from the caller's own profile.
 * Security (T-02-05-01): citySlug is NEVER read from the request — always from
 * the authenticated user's own User document.
 *
 * Declared BEFORE /:id/messages so 'city' is not captured as :id.
 */
router.get('/city', verifyFirebaseToken, requireVerified, conversationController.getCityInfo);

/**
 * GET /api/conversations/city/messages
 *
 * Paginated city group message history for the caller's own city.
 * Security (T-02-05-01): citySlug is derived from the caller's profile;
 * a user with no homeCity receives 400.
 *
 * Declared BEFORE /:id/messages so 'city' is not captured as :id.
 */
router.get('/city/messages', verifyFirebaseToken, requireVerified, conversationController.getCityMessages);

/**
 * GET /api/conversations/:id/messages
 *
 * Paginated message history for a specific 1:1 conversation.
 * Query params: before (ISO date cursor), limit (default 30, max 50).
 * Security: 403 if caller is not a participant (T-02-04-01).
 */
router.get('/:id/messages', verifyFirebaseToken, requireVerified, conversationController.getMessages);

module.exports = router;
