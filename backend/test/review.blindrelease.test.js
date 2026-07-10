/**
 * review.blindrelease.test.js
 *
 * Blind-release review gate tests (REVW-03 / T-03-03-01).
 * No live DB or HTTP server — models stubbed via require.cache monkey-patching.
 *
 * TEST SCENARIOS:
 *   1. LEAK GUARD (safety invariant): caller has NO own review; counterpart HAS one.
 *      State must NOT be 'revealed', counterpartReview must be null,
 *      AND the counterpart's sentinel text must NOT appear in the JSON.
 *   2. REVEAL BY BOTH: both directions submitted (within 14d window) → state 'revealed'.
 *   3. REVEAL BY DEADLINE: only one direction submitted, checkOut 15 days ago → 'revealed'.
 *   4. NOT ELIGIBLE: checkOut in the future → state 'not_eligible'.
 *   5. AGGREGATION: getUserReviews with one revealed + one unrevealed review
 *      → reviewCount 1, avgRating equals revealed review's rating.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

// ---- Fake req/res helpers (same style as auth.middleware.test.js) ----

function makeReq(user, params = {}) {
  return { user, params };
}

function makeRes() {
  const res = {
    _status: null,
    _json: null,
    status(code) { this._status = code; return this; },
    json(payload) { this._json = payload; return this; },
  };
  return res;
}

// ---- Time helpers ----

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function daysFromNow(n) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

// ---- Sentinel text for leak guard ----

const COUNTERPART_SENTINEL = 'COUNTERPART_SENTINEL_XYZ_12345_UNIQUE';

// ---- Stub infrastructure ----

// We stub Review and StayRequest models so tests don't need a live DB.
// Strategy: inject stubs into require.cache before requiring the controller.

let stubbedStayRequestFindById = null;
let stubbedReviewFindOne        = null;
let stubbedReviewFind           = null;

// Pre-require StayRequest and Review so cache entries exist, then replace them.
const StayRequestModule = require('../src/models/StayRequest');
const ReviewModule      = require('../src/models/Review');

// Capture cache keys
const stayRequestKey = Object.keys(require.cache).find((k) => k.endsWith('models/StayRequest.js'));
const reviewKey      = Object.keys(require.cache).find((k) => k.endsWith('models/Review.js'));

// Replace with stub objects
require.cache[stayRequestKey].exports = {
  findById: (id) => ({
    select: (fields) => ({
      lean: () => stubbedStayRequestFindById && stubbedStayRequestFindById(id),
    }),
  }),
};

require.cache[reviewKey].exports = {
  findOne: (filter) => ({
    select: (fields) => ({
      lean: () => stubbedReviewFindOne && stubbedReviewFindOne(filter),
    }),
  }),
  find: (filter) => ({
    select: (fields) => ({
      lean: () => stubbedReviewFind && stubbedReviewFind(filter),
    }),
  }),
  create: async (doc) => ({ _id: 'fake-id', ...doc }),
};

// Now require the controller (picks up stub cache entries)
const { getStayReviews, getUserReviews } = require('../src/controllers/reviewController');

// ---- Helper: build a Review stub doc ----

function makeReview({ stayRequestId, direction, rating, text, submittedAt }) {
  return {
    _id:           `review-${direction}`,
    stayRequestId,
    direction,
    rating,
    text,
    reviewerUid:   direction === 'guest_to_host' ? 'guest-uid' : 'host-uid',
    subjectUid:    direction === 'guest_to_host' ? 'host-uid'  : 'guest-uid',
    submittedAt:   submittedAt || new Date(),
  };
}

// ---- Test Suite ----

describe('Review Blind-Release Gate', () => {

  const STAY_ID   = 'stay-aaa111';
  const GUEST_UID = 'guest-uid';
  const HOST_UID  = 'host-uid';

  // Base accepted stay with checkOut 3 days ago (within 14d window)
  const BASE_STAY = {
    _id:      STAY_ID,
    guestUid: GUEST_UID,
    hostUid:  HOST_UID,
    checkOut: daysAgo(3),
    status:   'accepted',
  };

  test('LEAK GUARD: caller with no own review must not see counterpart text pre-reveal', async () => {
    // Setup: guest (caller) has NOT submitted a review; HOST has submitted one.
    stubbedStayRequestFindById = () => Promise.resolve(BASE_STAY);
    stubbedReviewFindOne = (filter) => {
      // callerDirection = 'guest_to_host' (caller is guest); counterpart = 'host_to_guest'
      if (filter.direction === 'guest_to_host') {
        return Promise.resolve(null); // caller has NOT submitted
      }
      if (filter.direction === 'host_to_guest') {
        return Promise.resolve(makeReview({
          stayRequestId: STAY_ID,
          direction:     'host_to_guest',
          rating:        5,
          text:          COUNTERPART_SENTINEL,
        }));
      }
      return Promise.resolve(null);
    };

    const req = makeReq({ uid: GUEST_UID, isVerified: true }, { stayRequestId: STAY_ID });
    const res = makeRes();
    await getStayReviews(req, res);

    // State must NOT be 'revealed'
    assert.notStrictEqual(res._json.state, 'revealed',
      `Expected state to not be 'revealed', got '${res._json.state}'`);

    // counterpartReview must be null
    assert.strictEqual(res._json.counterpartReview, null,
      'counterpartReview must be null before reveal');

    // The sentinel text must NOT appear anywhere in the JSON response
    const serialized = JSON.stringify(res._json);
    assert.ok(!serialized.includes(COUNTERPART_SENTINEL),
      `SECURITY VIOLATION: counterpart sentinel text found in pre-reveal response!\nJSON: ${serialized}`);
  });

  test('REVEAL BY BOTH: both directions submitted within 14d window → state revealed', async () => {
    // Setup: both guest and host have submitted reviews (within the 14d window)
    stubbedStayRequestFindById = () => Promise.resolve(BASE_STAY);
    stubbedReviewFindOne = (filter) => {
      if (filter.direction === 'guest_to_host') {
        return Promise.resolve(makeReview({
          stayRequestId: STAY_ID,
          direction:     'guest_to_host',
          rating:        4,
          text:          'Guest review text that is at least twenty characters long.',
        }));
      }
      if (filter.direction === 'host_to_guest') {
        return Promise.resolve(makeReview({
          stayRequestId: STAY_ID,
          direction:     'host_to_guest',
          rating:        5,
          text:          COUNTERPART_SENTINEL,
        }));
      }
      return Promise.resolve(null);
    };

    const req = makeReq({ uid: GUEST_UID, isVerified: true }, { stayRequestId: STAY_ID });
    const res = makeRes();
    await getStayReviews(req, res);

    assert.strictEqual(res._json.state, 'revealed',
      `Expected state 'revealed', got '${res._json.state}'`);
    assert.ok(res._json.counterpartReview !== null,
      'counterpartReview must not be null when revealed');
    assert.strictEqual(res._json.counterpartReview.text, COUNTERPART_SENTINEL,
      'counterpartReview.text must equal sentinel when revealed');
  });

  test('REVEAL BY DEADLINE: only one direction submitted, checkOut 15 days ago → revealed', async () => {
    // Setup: only guest submitted; checkOut was 15 days ago (past the 14d deadline)
    const oldStay = { ...BASE_STAY, checkOut: daysAgo(15) };
    stubbedStayRequestFindById = () => Promise.resolve(oldStay);
    stubbedReviewFindOne = (filter) => {
      if (filter.direction === 'guest_to_host') {
        return Promise.resolve(makeReview({
          stayRequestId: STAY_ID,
          direction:     'guest_to_host',
          rating:        3,
          text:          'Guest only review text that is long enough.',
        }));
      }
      // Host has NOT submitted
      return Promise.resolve(null);
    };

    const req = makeReq({ uid: GUEST_UID, isVerified: true }, { stayRequestId: STAY_ID });
    const res = makeRes();
    await getStayReviews(req, res);

    assert.strictEqual(res._json.state, 'revealed',
      `Expected state 'revealed' by deadline, got '${res._json.state}'`);
    // counterpartReview should be null (host didn't submit) but state is revealed
    assert.strictEqual(res._json.counterpartReview, null,
      'counterpartReview is null because host never submitted (even though deadline passed)');
  });

  test('NOT ELIGIBLE: checkOut in the future → state not_eligible', async () => {
    // Setup: stay is accepted but checkOut is in the future
    const futureStay = { ...BASE_STAY, checkOut: daysFromNow(5) };
    stubbedStayRequestFindById = () => Promise.resolve(futureStay);
    // findOne should not be called in not_eligible path, but set it up anyway
    stubbedReviewFindOne = () => Promise.resolve(null);

    const req = makeReq({ uid: GUEST_UID, isVerified: true }, { stayRequestId: STAY_ID });
    const res = makeRes();
    await getStayReviews(req, res);

    assert.strictEqual(res._json.state, 'not_eligible',
      `Expected state 'not_eligible', got '${res._json.state}'`);
    assert.strictEqual(res._json.ownReview, null,
      'ownReview must be null in not_eligible state');
    assert.strictEqual(res._json.counterpartReview, null,
      'counterpartReview must be null in not_eligible state');
  });

  test('AGGREGATION: getUserReviews with one revealed + one unrevealed → reviewCount 1', async () => {
    // Setup:
    //   - Review A: for STAY_A (checkOut 15 days ago, host also submitted) → REVEALED
    //   - Review B: for STAY_B (checkOut 3 days ago, counterpart NOT submitted) → NOT REVEALED

    const STAY_A = 'stay-aaa111';
    const STAY_B = 'stay-bbb222';
    const SUBJECT_UID = HOST_UID;
    const REVEALED_RATING = 4;

    // Review A (guest_to_host for STAY_A, subject is host)
    const reviewA = {
      _id:           'review-a',
      stayRequestId: STAY_A,
      direction:     'guest_to_host',
      rating:        REVEALED_RATING,
      text:          'Great host, very welcoming and kind, long enough text.',
      submittedAt:   new Date(),
      reviewerUid:   GUEST_UID,
      subjectUid:    SUBJECT_UID,
    };

    // Review B (guest_to_host for STAY_B, subject is host)
    const reviewB = {
      _id:           'review-b',
      stayRequestId: STAY_B,
      direction:     'guest_to_host',
      rating:        2,
      text:          'Not very clean but ok for the price.',
      submittedAt:   new Date(),
      reviewerUid:   'other-guest-uid',
      subjectUid:    SUBJECT_UID,
    };

    // Stub: Review.find returns both reviews for this subject
    stubbedReviewFind = (filter) => {
      if (filter.subjectUid) {
        return Promise.resolve([reviewA, reviewB]);
      }
      // For the bothSubmitted check (finding all reviews for stays)
      if (filter.stayRequestId && filter.stayRequestId.$in) {
        const ids = filter.stayRequestId.$in.map(String);
        const all = [];
        if (ids.includes(STAY_A)) {
          // STAY_A: both directions submitted (guest + host) → revealed
          all.push({ stayRequestId: STAY_A, direction: 'guest_to_host' });
          all.push({ stayRequestId: STAY_A, direction: 'host_to_guest' });
        }
        if (ids.includes(STAY_B)) {
          // STAY_B: only one direction submitted → not revealed (within 14d)
          all.push({ stayRequestId: STAY_B, direction: 'guest_to_host' });
        }
        return Promise.resolve(all);
      }
      return Promise.resolve([]);
    };

    // Stub: StayRequest.find for stay checkOut dates
    const originalFindById = stubbedStayRequestFindById;
    // We need to override StayRequest.find for getUserReviews
    // The controller calls StayRequest.find({ _id: { $in: stayIds } })
    require.cache[stayRequestKey].exports = {
      findById: (id) => ({
        select: (fields) => ({
          lean: () => stubbedStayRequestFindById && stubbedStayRequestFindById(id),
        }),
      }),
      find: (filter) => ({
        select: (fields) => ({
          lean: () => {
            if (filter._id && filter._id.$in) {
              const stayDocs = [
                { _id: STAY_A, checkOut: daysAgo(15) },  // 15 days ago — past 14d window
                { _id: STAY_B, checkOut: daysAgo(3)  },  // 3 days ago — within 14d window
              ];
              return Promise.resolve(stayDocs);
            }
            return Promise.resolve([]);
          },
        }),
      }),
    };

    // Re-load controller to pick up updated StayRequest stub
    // (Actually the controller caches the require, so we need to reload it)
    // Clear the controller from cache and re-require it
    const controllerKey = Object.keys(require.cache).find((k) =>
      k.endsWith('controllers/reviewController.js')
    );
    if (controllerKey) delete require.cache[controllerKey];
    const { getUserReviews: getUserReviewsFresh } = require('../src/controllers/reviewController');

    const req = makeReq({ uid: GUEST_UID, isVerified: true }, { uid: SUBJECT_UID });
    const res = makeRes();
    await getUserReviewsFresh(req, res);

    assert.ok(res._json.data, `Expected response.data, got: ${JSON.stringify(res._json)}`);
    assert.strictEqual(res._json.data.reviewCount, 1,
      `Expected reviewCount 1 (only revealed), got ${res._json.data.reviewCount}`);
    assert.strictEqual(res._json.data.avgRating, REVEALED_RATING,
      `Expected avgRating ${REVEALED_RATING}, got ${res._json.data.avgRating}`);
    assert.strictEqual(res._json.data.reviews.length, 1,
      'Expected exactly 1 review in the list (unrevealed excluded)');

    // Restore StayRequest stub to original
    require.cache[stayRequestKey].exports = {
      findById: (id) => ({
        select: (fields) => ({
          lean: () => stubbedStayRequestFindById && stubbedStayRequestFindById(id),
        }),
      }),
    };
  });

});
