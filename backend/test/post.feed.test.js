/**
 * post.feed.test.js — held-out pagination + authorUid integrity tests (node --test)
 *
 * Assertions:
 *  (a) getFeed returns exactly 20 items and hasMore=true when 21 docs match
 *  (b) nextCursor is a base64 string that decodes to JSON containing _id and createdAt of the 20th doc
 *  (c) a second getFeed call passing that nextCursor as req.query.before produces a filter with a $or clause
 *  (d) createPost with req.body.authorUid set to a different uid than req.user.uid uses req.user.uid
 *
 * No live DB, no HTTP server — module stubs via require.cache monkey-patching.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

// ---------------------------------------------------------------------------
// Fake req/res helpers (mirrors auth.middleware.test.js style)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Build 21 fake post documents (enough to trigger hasMore=true)
// ---------------------------------------------------------------------------

const BASE_DATE = new Date('2024-01-01T00:00:00.000Z');

function makeFakeDocs(count) {
  return Array.from({ length: count }, (_, i) => ({
    _id: String(1000 + i),
    authorUid: 'uid-author',
    text: `Post text ${i}`,
    photoUrl: null,
    likeCount: 0,
    likedBy: [],
    commentCount: 0,
    // Reverse-chronological: newest first
    createdAt: new Date(BASE_DATE.getTime() - i * 60000),
  }));
}

const FAKE_21_DOCS = makeFakeDocs(21);

// ---------------------------------------------------------------------------
// Stub the Post model
// ---------------------------------------------------------------------------

// We need to intercept require('../src/models/Post') in postController.
// Strategy: register the stub in require.cache before requiring postController.

let capturedFilter = null; // captures the filter passed to Post.find()
let createSpy = null;      // captures args to Post.create()
let findDocsToReturn = FAKE_21_DOCS;

const fakePostModel = {
  find(filter) {
    capturedFilter = filter;
    // Return a chainable object
    return {
      sort() { return this; },
      limit() { return this; },
      select() { return this; },
      lean() {
        return Promise.resolve([...findDocsToReturn]);
      },
    };
  },

  async create(doc) {
    createSpy = doc;
    return {
      _id: 'new-post-id',
      ...doc,
      save: async function () { this.photoUrl = null; },
    };
  },
};

// Resolve the absolute path that postController uses for '../models/Post'
const path = require('path');
const postModelPath = path.resolve(__dirname, '../src/models/Post');
// Register stub in require.cache (node caches by resolved filename)
require.cache[require.resolve(postModelPath)] = {
  id: require.resolve(postModelPath),
  filename: require.resolve(postModelPath),
  loaded: true,
  exports: fakePostModel,
};

// ---------------------------------------------------------------------------
// Stub storageService.getSignedUrl
// ---------------------------------------------------------------------------

const storageServicePath = path.resolve(__dirname, '../src/services/storageService');
const fakeStorageService = {
  uploadFile: async () => {},
  getSignedUrl: async (p) => `signed://${p}`, // echoes the path back as a fake URL
};
require.cache[require.resolve(storageServicePath)] = {
  id: require.resolve(storageServicePath),
  filename: require.resolve(storageServicePath),
  loaded: true,
  exports: fakeStorageService,
};

// ---------------------------------------------------------------------------
// Stub User model — getFeed resolves author display names via User.find(...)
// ---------------------------------------------------------------------------

const userModelPath = path.resolve(__dirname, '../src/models/User');
require.cache[require.resolve(userModelPath)] = {
  id: require.resolve(userModelPath),
  filename: require.resolve(userModelPath),
  loaded: true,
  exports: {
    find() {
      return {
        select() { return this; },
        lean() { return Promise.resolve([]); },
      };
    },
  },
};

// ---------------------------------------------------------------------------
// Load the controller under test (picks up stubs from cache)
// ---------------------------------------------------------------------------

const postController = require('../src/controllers/postController');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('(a) getFeed returns exactly 20 items and hasMore=true when 21 docs match', async () => {
  findDocsToReturn = FAKE_21_DOCS;
  capturedFilter = null;

  const req = { query: {} };
  const res = makeRes();

  await postController.getFeed(req, res);

  assert.strictEqual(res._status, null, 'should not set an error status');
  assert.ok(res._json, 'response body must be set');
  assert.strictEqual(res._json.data.length, 20, 'page must contain exactly 20 items');
  assert.strictEqual(res._json.hasMore, true, 'hasMore must be true when 21 docs returned');
});

test('(b) nextCursor decodes to JSON with _id and createdAt of the 20th returned doc', async () => {
  findDocsToReturn = FAKE_21_DOCS;

  const req = { query: {} };
  const res = makeRes();

  await postController.getFeed(req, res);

  const { nextCursor, data } = res._json;
  assert.ok(typeof nextCursor === 'string' && nextCursor.length > 0, 'nextCursor must be a non-empty string');

  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(nextCursor, 'base64').toString('utf8'));
  } catch {
    assert.fail('nextCursor is not valid base64-encoded JSON');
  }

  // The 20th returned doc (index 19) is page[19]
  const expectedDoc = FAKE_21_DOCS[19]; // 21 docs in reverse order; page[19] is docs[19]
  assert.strictEqual(decoded._id, String(expectedDoc._id), 'nextCursor._id must match the 20th doc');
  assert.strictEqual(
    decoded.createdAt,
    expectedDoc.createdAt.toISOString(),
    'nextCursor.createdAt must match the 20th doc as ISO string'
  );
});

test('(c) second getFeed call with nextCursor produces a $or filter', async () => {
  findDocsToReturn = FAKE_21_DOCS;

  // First call to get the nextCursor
  const firstReq = { query: {} };
  const firstRes = makeRes();
  await postController.getFeed(firstReq, firstRes);

  const { nextCursor } = firstRes._json;

  // Reset captured filter
  capturedFilter = null;
  findDocsToReturn = makeFakeDocs(5); // fewer docs for the second page

  const req = { query: { before: nextCursor } };
  const res = makeRes();
  await postController.getFeed(req, res);

  assert.ok(capturedFilter, 'Post.find must have been called with a filter');
  assert.ok(
    Array.isArray(capturedFilter.$or),
    'filter must contain a $or array when a before cursor is provided'
  );
  assert.strictEqual(capturedFilter.$or.length, 2, '$or must have exactly 2 clauses');
});

test('(d) createPost with req.body.authorUid different from req.user.uid uses req.user.uid', async () => {
  createSpy = null;

  const req = {
    user: { uid: 'token-uid' },
    body: {
      text: 'Hello world',
      authorUid: 'evil-spoofed-uid', // attacker tries to inject a different uid
    },
    file: undefined,
  };
  const res = makeRes();

  await postController.createPost(req, res);

  assert.ok(createSpy, 'Post.create must have been called');
  assert.strictEqual(
    createSpy.authorUid,
    'token-uid',
    'authorUid must equal req.user.uid (not req.body.authorUid)'
  );
  assert.notStrictEqual(
    createSpy.authorUid,
    'evil-spoofed-uid',
    'authorUid must NOT be the spoofed value from body'
  );
});
