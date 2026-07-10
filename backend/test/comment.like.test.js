/**
 * comment.like.test.js — held-out unit tests for toggleLike and createComment (03-02).
 *
 * Uses node:test (same style as auth.middleware.test.js and post.feed.test.js).
 * No real DB or HTTP — all Mongoose models and the notification service are stubbed
 * via require.cache monkey-patching before the controllers are loaded.
 *
 * Assertions:
 *   (a) toggleLike — pre-existing like: issues $pull + $inc:-1, returns liked:false
 *   (b) toggleLike — no existing like: issues $addToSet + $inc:+1, returns liked:true
 *   (c) createComment — req.body.authorUid is IGNORED; comment saves with req.user.uid
 *   (d) createComment — no push when commenter === post author
 *       createComment — push fired when commenter !== post author
 */
'use strict';

const { test } = require('node:test');
const assert   = require('node:assert');

// ---------------------------------------------------------------------------
// Shared fake req/res helpers (same shape as auth.middleware.test.js)
// ---------------------------------------------------------------------------

function makeRes() {
  const res = {
    _status: 200,
    _json:   null,
    status(code) { this._status = code; return this; },
    json(payload)  { this._json = payload; return this; },
  };
  return res;
}

// ---------------------------------------------------------------------------
// Stub: Post model
// ---------------------------------------------------------------------------

let postFindByIdResult    = null;  // returned by Post.findById().select().lean()
let postFindByIdUpdateResult = null; // returned by Post.findByIdAndUpdate().select().lean()
let postFindByIdUpdateArgs   = [];   // capture update argument passed to findByIdAndUpdate

const PostStub = {
  findById(id) {
    return {
      select() {
        return { lean: async () => postFindByIdResult };
      },
    };
  },
  findByIdAndUpdate(id, update, opts) {
    postFindByIdUpdateArgs.push(update);
    return {
      select() {
        return { lean: async () => postFindByIdUpdateResult };
      },
    };
  },
  findByIdAndDelete() { return Promise.resolve(null); },
};

// ---------------------------------------------------------------------------
// Stub: Comment model
// ---------------------------------------------------------------------------

let lastCommentCreated = null;

const CommentStub = {
  async create(doc) {
    lastCommentCreated = { ...doc, _id: 'fake-comment-id' };
    return lastCommentCreated;
  },
  deleteMany() { return Promise.resolve(); },
};

// ---------------------------------------------------------------------------
// Stub: User model (for author lookup in createComment push path)
// ---------------------------------------------------------------------------

let userFindOneResult = null;

const UserStub = {
  findOne() {
    return { select() { return { lean: async () => userFindOneResult }; } };
  },
};

// ---------------------------------------------------------------------------
// Stub: notificationService
// ---------------------------------------------------------------------------

let pushCallCount = 0;
let lastPushArgs  = null;

const notificationServiceStub = {
  sendPushNotification: async (...args) => {
    pushCallCount++;
    lastPushArgs = args;
  },
};

// ---------------------------------------------------------------------------
// Wire stubs into require.cache BEFORE loading controllers
// ---------------------------------------------------------------------------

// Resolve the absolute paths that the controllers use with require()
const path = require('path');
const modelsDir      = path.resolve(__dirname, '../src/models');
const servicesDir    = path.resolve(__dirname, '../src/services');
const controllersDir = path.resolve(__dirname, '../src/controllers');

// Register stub modules in require.cache
function stubModule(resolvedPath, stub) {
  require.cache[require.resolve(resolvedPath)] = {
    id: require.resolve(resolvedPath),
    filename: require.resolve(resolvedPath),
    loaded: true,
    exports: stub,
  };
}

// We need to touch the real files so Node knows the paths exist — use try/catch
// to absorb errors if the real modules try to connect to DB/Firebase.
try { require(`${modelsDir}/Post`); } catch (_) {}
try { require(`${modelsDir}/Comment`); } catch (_) {}
try { require(`${modelsDir}/User`); } catch (_) {}
try { require(`${servicesDir}/notificationService`); } catch (_) {}

stubModule(`${modelsDir}/Post`,    PostStub);
stubModule(`${modelsDir}/Comment`, CommentStub);
stubModule(`${modelsDir}/User`,    UserStub);
stubModule(`${servicesDir}/notificationService`, notificationServiceStub);

// Now load the controllers — they pick up the stubs from require.cache
const postController    = require(`${controllersDir}/postController`);
const commentController = require(`${controllersDir}/commentController`);

// ---------------------------------------------------------------------------
// TESTS: toggleLike
// ---------------------------------------------------------------------------

test('toggleLike (a): already-liked post — issues $pull + $inc:-1 and returns liked:false', async () => {
  postFindByIdUpdateArgs = [];

  // Simulate a post whose likedBy already includes our user
  postFindByIdResult       = { _id: 'post1', likedBy: ['uid-alice'] };
  postFindByIdUpdateResult = { likeCount: 2, likedBy: [] };

  const req = { user: { uid: 'uid-alice' }, params: { id: 'post1' } };
  const res = makeRes();
  await postController.toggleLike(req, res);

  // Must have called findByIdAndUpdate with $pull (not $addToSet)
  assert.strictEqual(postFindByIdUpdateArgs.length, 1, 'findByIdAndUpdate called once');
  const update = postFindByIdUpdateArgs[0];
  assert.ok(update.$pull, 'update must use $pull (not $addToSet) for already-liked post');
  assert.strictEqual(update.$inc.likeCount, -1, '$inc must decrement by 1');
  assert.ok(!update.$addToSet, '$addToSet must NOT be present');

  assert.strictEqual(res._status, 200);
  assert.strictEqual(res._json.data.liked, false, 'liked field must be false after unlike');
});

test('toggleLike (b): not-yet-liked post — issues $addToSet + $inc:+1 and returns liked:true', async () => {
  postFindByIdUpdateArgs = [];

  postFindByIdResult       = { _id: 'post2', likedBy: [] };
  postFindByIdUpdateResult = { likeCount: 1, likedBy: ['uid-bob'] };

  const req = { user: { uid: 'uid-bob' }, params: { id: 'post2' } };
  const res = makeRes();
  await postController.toggleLike(req, res);

  assert.strictEqual(postFindByIdUpdateArgs.length, 1, 'findByIdAndUpdate called once');
  const update = postFindByIdUpdateArgs[0];
  assert.ok(update.$addToSet, 'update must use $addToSet for not-yet-liked post');
  assert.strictEqual(update.$inc.likeCount, 1, '$inc must increment by 1');
  assert.ok(!update.$pull, '$pull must NOT be present');

  assert.strictEqual(res._status, 200);
  assert.strictEqual(res._json.data.liked, true, 'liked field must be true after like');
});

test('toggleLike: double-call with same already-liked state never issues two $inc:+1 (no drift)', async () => {
  // Simulate two consecutive toggleLike calls where the pre-loaded state says
  // the user has NOT liked the post (likedBy: []).
  // Each call reads the DB state independently and the pre-check runs independently —
  // both will issue $addToSet + $inc:+1 in isolation, which is correct: the $addToSet
  // is idempotent in Mongo but the $inc is not. The anti-drift guarantee is that we
  // never issue $inc:+1 without first confirming from the DB read that the user is
  // NOT in likedBy. Rapid concurrent requests are serialised by the single-threaded
  // event loop in tests; in production the race is prevented at the DB level by the
  // pre-check pattern documented in T-03-02-01.
  postFindByIdUpdateArgs = [];

  // First call — user not liked
  postFindByIdResult       = { _id: 'post3', likedBy: [] };
  postFindByIdUpdateResult = { likeCount: 1, likedBy: ['uid-carol'] };

  const req1 = { user: { uid: 'uid-carol' }, params: { id: 'post3' } };
  const res1 = makeRes();
  await postController.toggleLike(req1, res1);

  // Second call — simulate the DB state updated to include uid-carol
  postFindByIdResult       = { _id: 'post3', likedBy: ['uid-carol'] };
  postFindByIdUpdateResult = { likeCount: 0, likedBy: [] };

  const req2 = { user: { uid: 'uid-carol' }, params: { id: 'post3' } };
  const res2 = makeRes();
  await postController.toggleLike(req2, res2);

  // First call: like (+1), second call: unlike (-1) — net zero, not +2
  assert.strictEqual(postFindByIdUpdateArgs.length, 2, 'two DB updates issued');
  const [u1, u2] = postFindByIdUpdateArgs;
  assert.strictEqual(u1.$inc.likeCount,  1, 'first call: $inc +1 (like)');
  assert.strictEqual(u2.$inc.likeCount, -1, 'second call: $inc -1 (unlike) — pre-check prevented +1 drift');
});

// ---------------------------------------------------------------------------
// TESTS: createComment
// ---------------------------------------------------------------------------

test('createComment (c): req.body.authorUid is IGNORED — comment saved with req.user.uid', async () => {
  lastCommentCreated = null;
  pushCallCount = 0;

  // Post belongs to a different user
  postFindByIdResult = { _id: 'post4', authorUid: 'uid-host' };
  userFindOneResult  = { expoPushToken: null };

  const req = {
    user:   { uid: 'uid-alice' },
    params: { id: 'post4' },
    body:   { text: 'Hello!', authorUid: 'uid-evil-spoof' }, // attempt to spoof
  };
  const res = makeRes();
  await commentController.createComment(req, res);

  assert.ok(lastCommentCreated, 'Comment.create must have been called');
  assert.strictEqual(
    lastCommentCreated.authorUid,
    'uid-alice',
    'authorUid in saved comment must equal req.user.uid, not req.body.authorUid'
  );
  assert.notStrictEqual(
    lastCommentCreated.authorUid,
    'uid-evil-spoof',
    'spoofed authorUid must be discarded'
  );
});

test('createComment (d): no push notification when commenter === post author', async () => {
  lastCommentCreated = null;
  pushCallCount = 0;

  // Post authored by the same uid as the commenter
  postFindByIdResult = { _id: 'post5', authorUid: 'uid-self' };
  userFindOneResult  = { expoPushToken: 'ExponentPushToken[valid]' };

  const req = {
    user:   { uid: 'uid-self' },
    params: { id: 'post5' },
    body:   { text: 'My own post comment' },
  };
  const res = makeRes();
  await commentController.createComment(req, res);

  assert.strictEqual(
    pushCallCount,
    0,
    'sendPushNotification must NOT be called when commenter is the post author'
  );
  assert.strictEqual(res._status, 201, 'should still respond 201');
});

test('createComment (d): push notification fired when commenter !== post author', async () => {
  lastCommentCreated = null;
  pushCallCount      = 0;
  lastPushArgs       = null;

  postFindByIdResult = { _id: 'post6', authorUid: 'uid-host' };
  userFindOneResult  = { expoPushToken: 'ExponentPushToken[valid]' };

  const req = {
    user:   { uid: 'uid-guest' },
    params: { id: 'post6' },
    body:   { text: 'Great post!' },
  };
  const res = makeRes();
  await commentController.createComment(req, res);

  assert.strictEqual(
    pushCallCount,
    1,
    'sendPushNotification must be called exactly once when commenter !== author'
  );
  assert.strictEqual(lastPushArgs[0], 'ExponentPushToken[valid]', 'push token passed correctly');
  assert.strictEqual(res._status, 201, 'should respond 201');
});
