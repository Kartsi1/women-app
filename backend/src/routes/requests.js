const router = require('express').Router();
const { verifyFirebaseToken, requireVerified } = require('../middleware/auth');
const requestController = require('../controllers/requestController');

/**
 * Stay request routes — all behind verifyFirebaseToken + requireVerified.
 *
 * Static routes BEFORE dynamic /:id (same pattern as users.js lines 85–113):
 *   - POST /               → createRequest   (guest sends a stay request)
 *   - GET  /inbox          → getHostInbox    (host views their incoming requests)
 *   - PATCH /:id           → updateRequestStatus (host accepts or declines)
 *
 * Security:
 *   T-02-03-02: updateRequestStatus enforces host-only (hostUid === req.user.uid).
 *   T-02-03-03: createRequest rejects when guest === listing owner.
 *   T-02-03-04: guestUid always from the verified token, never the body.
 *
 * NOTE: /inbox is registered BEFORE /:id so it is matched first.
 */
router.post('/', verifyFirebaseToken, requireVerified, requestController.createRequest);
router.get('/inbox', verifyFirebaseToken, requireVerified, requestController.getHostInbox);
router.patch('/:id', verifyFirebaseToken, requireVerified, requestController.updateRequestStatus);

module.exports = router;
