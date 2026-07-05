/**
 * Unit tests for adminController.login
 * Pure logic — no DB, no Firebase, no network.
 * Uses node:test (built-in, no dependencies).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

// Set env vars before requiring the module under test
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_PASSWORD = 'supersecret';
process.env.ADMIN_JWT_SECRET = 'test-jwt-secret-for-unit-tests';

const { login } = require('../src/controllers/adminController');

/**
 * Minimal fake req/res objects for testing Express handlers.
 */
function makeReqRes(body = {}) {
  let statusCode = 200;
  let responseBody = null;
  const req = { body };
  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseBody = data;
      return res;
    },
    get statusCode() { return statusCode; },
    get responseBody() { return responseBody; },
  };
  return { req, res };
}

test('admin login: returns 401 for wrong password', async () => {
  const { req, res } = makeReqRes({ email: 'admin@test.com', password: 'wrongpassword' });
  await login(req, res);
  assert.equal(res.statusCode, 401, 'expected 401 for wrong credentials');
  assert.ok(res.responseBody.error, 'expected error field in response');
});

test('admin login: returns 401 for wrong email', async () => {
  const { req, res } = makeReqRes({ email: 'notadmin@test.com', password: 'supersecret' });
  await login(req, res);
  assert.equal(res.statusCode, 401, 'expected 401 for wrong email');
  assert.ok(res.responseBody.error, 'expected error field in response');
});

test('admin login: returns { token } for correct credentials', async () => {
  const { req, res } = makeReqRes({ email: 'admin@test.com', password: 'supersecret' });
  await login(req, res);
  // Status was never set to non-200, so it stays 200
  assert.equal(res.statusCode, 200, 'expected 200 for correct credentials');
  assert.ok(res.responseBody, 'expected a response body');
  assert.ok(res.responseBody.token, 'expected a token in response');
  assert.equal(typeof res.responseBody.token, 'string', 'token must be a string');
  assert.ok(res.responseBody.token.length > 0, 'token must be non-empty');
});

test('admin login: returned token is a valid JWT', async () => {
  const jwt = require('jsonwebtoken');
  const { req, res } = makeReqRes({ email: 'admin@test.com', password: 'supersecret' });
  await login(req, res);
  const { token } = res.responseBody;
  const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
  assert.equal(decoded.role, 'admin', 'token must contain role:admin');
});
