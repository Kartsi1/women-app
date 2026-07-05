const { test } = require('node:test');
const assert = require('node:assert');

// Fake req/res helpers
function makeRes() {
  const res = {
    _status: null,
    _json: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(payload) {
      this._json = payload;
      return this;
    },
  };
  return res;
}

function makeNext() {
  let calls = 0;
  const fn = () => { calls++; };
  fn.getCalls = () => calls;
  return fn;
}

// --- Module mock setup ---
// We monkey-patch firebase-admin/auth so auth.js picks up our stub.
// The trick: require auth.js AFTER patching Module._resolveFilename cache.
// Simpler approach: patch require.cache after a first require of firebase-admin/auth.

// Step 1: Pre-require firebase-admin/auth so its cache entry exists.
const firebaseAuth = require('firebase-admin/auth');

// Step 2: Store original getAuth reference and replace with stub.
let stubbedVerifyIdToken = null;
const originalGetAuth = firebaseAuth.getAuth;
firebaseAuth.getAuth = () => ({
  verifyIdToken: (...args) => {
    if (stubbedVerifyIdToken) return stubbedVerifyIdToken(...args);
    throw new Error('stubbedVerifyIdToken not set');
  },
});

// Step 3: Now require auth middleware (picks up the patched firebase-admin/auth).
const { verifyFirebaseToken, requireVerified } = require('../src/middleware/auth');

// --- Tests ---

test('verifyFirebaseToken: missing Authorization header responds 401', async (t) => {
  const req = { headers: {} };
  const res = makeRes();
  const next = makeNext();

  await verifyFirebaseToken(req, res, next);

  assert.strictEqual(res._status, 401);
  assert.deepStrictEqual(res._json, { error: 'Missing or invalid authorization header' });
  assert.strictEqual(next.getCalls(), 0, 'next() must not be called');
});

test('verifyFirebaseToken: Authorization header not starting with "Bearer " responds 401', async (t) => {
  const req = { headers: { authorization: 'Token somevalue' } };
  const res = makeRes();
  const next = makeNext();

  await verifyFirebaseToken(req, res, next);

  assert.strictEqual(res._status, 401);
  assert.deepStrictEqual(res._json, { error: 'Missing or invalid authorization header' });
  assert.strictEqual(next.getCalls(), 0, 'next() must not be called');
});

test('verifyFirebaseToken: valid token sets req.user and calls next()', async (t) => {
  const fakeDecoded = { uid: 'uid123', email: 'user@example.com', isVerified: true };
  stubbedVerifyIdToken = async (token) => fakeDecoded;

  const req = { headers: { authorization: 'Bearer validtoken' } };
  const res = makeRes();
  const next = makeNext();

  await verifyFirebaseToken(req, res, next);

  assert.deepStrictEqual(req.user, { uid: 'uid123', email: 'user@example.com', isVerified: true });
  assert.strictEqual(next.getCalls(), 1, 'next() must be called exactly once');
  assert.strictEqual(res._status, null, 'no status set on success');
});

test('verifyFirebaseToken: verifyIdToken rejects responds 401', async (t) => {
  stubbedVerifyIdToken = async () => { throw new Error('Token invalid'); };

  const req = { headers: { authorization: 'Bearer badtoken' } };
  const res = makeRes();
  const next = makeNext();

  await verifyFirebaseToken(req, res, next);

  assert.strictEqual(res._status, 401);
  assert.deepStrictEqual(res._json, { error: 'Invalid or expired token' });
  assert.strictEqual(next.getCalls(), 0, 'next() must not be called');
});

test('requireVerified: req.user.isVerified false responds 403', (t) => {
  const req = { user: { uid: 'uid123', email: 'user@example.com', isVerified: false } };
  const res = makeRes();
  const next = makeNext();

  requireVerified(req, res, next);

  assert.strictEqual(res._status, 403);
  assert.deepStrictEqual(res._json, { error: 'Account not verified' });
  assert.strictEqual(next.getCalls(), 0, 'next() must not be called');
});

test('requireVerified: req.user.isVerified true calls next()', (t) => {
  const req = { user: { uid: 'uid123', email: 'user@example.com', isVerified: true } };
  const res = makeRes();
  const next = makeNext();

  requireVerified(req, res, next);

  assert.strictEqual(next.getCalls(), 1, 'next() must be called exactly once');
  assert.strictEqual(res._status, null, 'no status set on success');
});
