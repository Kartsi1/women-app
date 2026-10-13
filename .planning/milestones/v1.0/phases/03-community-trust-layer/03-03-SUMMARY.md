---
phase: 03-community-trust-layer
plan: "03"
subsystem: api
tags: [review, blind-release, mongodb, mongoose, express, security, trust, node-test]

# Dependency graph
requires:
  - phase: 03-01
    provides: Post/Report models and community feed backend — confirms server.js mount pattern
  - phase: 02-03
    provides: StayRequest model (guestUid, hostUid, checkOut, status) — eligibility anchor

provides:
  - Review Mongoose model with unique (stayRequestId, direction) compound index
  - reviewController: createReview (eligibility-gated), getStayReviews (blind-release gate), getUserReviews (revealed-only aggregation)
  - /api/reviews router mounted in server.js alongside all prior routes
  - held-out blind-release leak test (node --test, no live DB)

affects:
  - 03-04 (mobile review surfaces consume this API's state/reveal semantics)
  - profile screens (avgRating + reviewCount from getUserReviews)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Blind-release gate: lazy-on-read server-side reveal predicate (bothSubmitted OR now >= checkOut + 14d)"
    - "Explicit projection gate: counterpart review built by field-picking, NEVER by spreading raw doc (mirrors T-02-02-01 exactAddress hiding)"
    - "Race-safe uniqueness: E11000 duplicate-key error mapped to 409 on Review.create"
    - "Revealed-only aggregation: getUserReviews filters reviews individually by per-stay reveal status"

key-files:
  created:
    - backend/src/models/Review.js
    - backend/src/controllers/reviewController.js
    - backend/src/routes/reviews.js
    - backend/test/review.blindrelease.test.js
  modified:
    - backend/src/models/User.js
    - backend/src/server.js

key-decisions:
  - "Blind-release reveal predicate computed at GET time, never at write time — lazy-on-read avoids storing reveal state that would drift"
  - "Counterpart review built by explicit field-picking ({ rating, text, submittedAt }) — same discipline as exactAddress hiding; NEVER spread raw doc to avoid accidental field leakage"
  - "E11000 duplicate-key from Review.create maps to 409 — pre-check findOne + index provides defence-in-depth against race"
  - "Reviews immutable by route absence — no PUT/PATCH defined in reviews.js"
  - "getUserReviews: per-review reveal check loads each stay's checkOut and the full stayReviews set once — avoids N+1 by batch-loading both"
  - "/user/:uid route declared before /:stayRequestId in reviews.js to prevent Express route shadowing"

patterns-established:
  - "Blind-release gate pattern: revealed = bothSubmitted || now >= checkOut + WINDOW; safeCounterpart = revealed ? pick(fields) : null"
  - "No PUT/PATCH on immutable resources — immutability enforced by route absence, not runtime check"
  - "Race-safe dedup: pre-check + unique index + E11000 catch gives three layers; only two needed but belt-and-suspenders is cheap here"

requirements-completed: [REVW-01, REVW-02, REVW-03]

coverage:
  - id: D1
    description: "Review.js model: unique (stayRequestId, direction) index, subjectUid index, no update methods"
    requirement: REVW-01
    verification:
      - kind: unit
        ref: "backend/test/review.blindrelease.test.js — node -e verify exits 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "createReview eligibility gate: 403 non-participant, 422 not-accepted, 422 before checkOut, 409 duplicate, 400 invalid rating/text, 201 success with server-derived identity"
    requirement: REVW-01
    verification:
      - kind: unit
        ref: "backend/test/review.blindrelease.test.js — acceptance criteria verified in controller source"
        status: pass
    human_judgment: true
    rationale: "Live eligibility gate requires a real StayRequest in DB; unit tests stub the model but end-to-end 422/409/403 flows need a seeded DB to confirm wiring"
  - id: D3
    description: "Blind-release gate: counterpart text absent pre-reveal, revealed when bothSubmitted or deadline passed"
    requirement: REVW-03
    verification:
      - kind: unit
        ref: "backend/test/review.blindrelease.test.js#LEAK GUARD"
        status: pass
      - kind: unit
        ref: "backend/test/review.blindrelease.test.js#REVEAL BY BOTH"
        status: pass
      - kind: unit
        ref: "backend/test/review.blindrelease.test.js#REVEAL BY DEADLINE"
        status: pass
      - kind: unit
        ref: "backend/test/review.blindrelease.test.js#NOT ELIGIBLE"
        status: pass
    human_judgment: false
  - id: D4
    description: "getUserReviews aggregation counts only revealed reviews (avgRating + reviewCount)"
    requirement: REVW-03
    verification:
      - kind: unit
        ref: "backend/test/review.blindrelease.test.js#AGGREGATION"
        status: pass
    human_judgment: false
  - id: D5
    description: "User.js schema has avgRating and reviewCount fields (additive, no existing fields altered)"
    requirement: REVW-03
    verification:
      - kind: unit
        ref: "node -e verify: u.schema.path('avgRating') + u.schema.path('reviewCount') both truthy"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: "2026-07-10"
status: complete
---

# Phase 03 Plan 03: Blind-Release Review Backend Summary

**Eligibility-gated review submission (accepted stay + past checkOut + participant) with a server-side lazy-on-read reveal gate — counterpart text absent from response until both directions submit or 14 days elapse, proven leak-safe by a held-out sentinel test; revealed-only aggregation in getUserReviews.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-10T14:20:01Z
- **Completed:** 2026-07-10
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Review model with unique `(stayRequestId, direction)` compound index enforcing one review per direction per stay; `subjectUid` index for profile queries; no update methods (immutable by design)
- `createReview`: eligibility gates (accepted + past checkOut + participant-only), server-derived identity (reviewerUid/direction/subjectUid from token + StayRequest, NEVER from body), race-safe dedup (pre-check + E11000 → 409)
- `getStayReviews`: blind-release gate computed at read time — `revealed = (bothSubmitted) OR (now >= checkOut + 14d)`; counterpart built by explicit field-picking, never raw-spread; state ∈ {revealed, waiting, eligible, not_eligible}
- `getUserReviews`: loads all subject reviews, determines per-review reveal status individually (batch-loads stays + stayReviews to avoid N+1), returns avgRating + reviewCount from revealed reviews only
- `backend/test/review.blindrelease.test.js`: 5 tests (no live DB), LEAK GUARD asserts sentinel text absent from pre-reveal JSON; all 25 backend tests pass, 0 regressions
- `backend/src/models/User.js`: additive `avgRating` (null) + `reviewCount` (0) fields for profile aggregation
- `backend/src/server.js`: `/api/reviews` mounted alongside all existing routes (03-01/03-02 mounts preserved)

## Task Commits

1. **Task 1: Review model + eligibility-gated submit + User aggregation fields** - `a8b8893` (feat)
2. **Task 2: Blind-release read gate + revealed-only aggregation + held-out leak test** - `eb249c9` (feat)

## Files Created/Modified

- `backend/src/models/Review.js` — Mongoose schema, unique (stayRequestId, direction) index, subjectUid index, no update methods
- `backend/src/models/User.js` — additive avgRating + reviewCount fields (no existing fields altered)
- `backend/src/controllers/reviewController.js` — createReview, getStayReviews (blind-release gate), getUserReviews (revealed-only)
- `backend/src/routes/reviews.js` — POST /, GET /user/:uid (before /:stayRequestId), GET /:stayRequestId; no PUT/PATCH
- `backend/src/server.js` — added reviewsRouter require + app.use('/api/reviews', reviewsRouter)
- `backend/test/review.blindrelease.test.js` — 5 blind-release tests (node --test, no live DB): LEAK GUARD, REVEAL BY BOTH, REVEAL BY DEADLINE, NOT ELIGIBLE, AGGREGATION

## Decisions Made

- Blind-release reveal predicate is lazy-on-read (computed at GET time), not stored — avoids reveal-state drift if data changes
- Counterpart review is built by explicit field-picking ({ rating, text, submittedAt }), same discipline as T-02-02-01 exactAddress hiding; raw doc never spread
- E11000 duplicate-key from Review.create maps to 409 — pre-check findOne + unique index = defence-in-depth against race conditions
- Reviews immutable by route absence (no PUT/PATCH in reviews.js) — cleaner than a runtime guard
- getUserReviews batch-loads both stays and stayReviews in two queries to avoid N+1 on profile pages

## Deviations from Plan

None — plan executed exactly as written. Controller code from PATTERNS.md was used directly as the template; all security invariants (T-03-03-01 through T-03-03-06) implemented as specified.

## Issues Encountered

None. All 25 tests pass on first run including the LEAK GUARD.

## User Setup Required

None — no external service configuration required. Reviews require a seeded MongoDB with accepted StayRequests past their checkOut for end-to-end manual verification.

## Threat Surface Scan

No new trust boundaries beyond those in the plan's threat model. All surfaces were pre-registered:
- POST /api/reviews: T-03-03-02 (spoofing), T-03-03-04 (elevation), T-03-03-05 (early review), T-03-03-06 (duplicate)
- GET /api/reviews/:stayRequestId: T-03-03-01 (information disclosure / leak guard)
- GET /api/reviews/user/:uid: aggregation counts revealed reviews only (no new surface)

## Next Phase Readiness

- 03-04 (mobile review surfaces) can render review state from GET /api/reviews/:stayRequestId; state field drives UI
- Profile screens can call GET /api/reviews/user/:uid for avgRating + reviewCount display
- Manual end-to-end verification: seed an accepted StayRequest with past checkOut, POST as guest, GET as host — confirm no counterpart text pre-reveal; POST as host too, GET again — confirm revealed

---
*Phase: 03-community-trust-layer*
*Completed: 2026-07-10*

## Self-Check: PASSED

- backend/src/models/Review.js: FOUND
- backend/src/models/User.js (avgRating + reviewCount): FOUND + PASS
- backend/src/controllers/reviewController.js: FOUND
- backend/src/routes/reviews.js: FOUND
- backend/src/server.js (/api/reviews mount): FOUND
- backend/test/review.blindrelease.test.js: FOUND
- .planning/phases/03-community-trust-layer/03-03-SUMMARY.md: FOUND
- Commit a8b8893 (Task 1): FOUND
- Commit eb249c9 (Task 2): FOUND
- Unique (stayRequestId, direction) index: PASS
- User avgRating + reviewCount fields: PASS
- req.body.reviewerUid/subjectUid usage count = 0: PASS
- 14-day reveal constant present: PASS (line 158, 248)
- No PUT/PATCH in reviews.js: PASS
- node --test review.blindrelease.test.js: 5/5 pass
- node --test full suite: 25/25 pass, 0 fail
