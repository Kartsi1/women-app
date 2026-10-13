---
phase: 01-trust-foundation
plan: 07
subsystem: safety-controls
tags: [express, mongoose, react-native, typescript, block, report]

# Dependency graph
requires: ["01-05"]
provides:
  - Report.js: Mongoose Report model (reporterUid, reportedUid, contentType, contentId, reason, status enum open|resolved)
  - userController.js: blockUser ($addToSet idempotent, self-block 400, T-07-01), reportUser (reason required 400, T-07-02/T-07-04)
  - routes/users.js: POST /block/:uid and POST /report guarded by requireVerified, declared before GET /:uid (T-07-03)
  - api.ts: blockUser(uid), reportUser(payload), ReportPayload interface
  - ViewProfileScreen.tsx: Block button (VERI-06) + Report button with reason-gated Modal (VERI-07)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [$addToSet idempotent block pattern, required-reason client-side gate before submit, bottom-sheet Modal for report form]

key-files:
  created:
    - backend/src/models/Report.js
  modified:
    - backend/src/controllers/userController.js
    - backend/src/routes/users.js
    - mobile/src/services/api.ts
    - mobile/src/screens/Profile/ViewProfileScreen.tsx

key-decisions:
  - "$addToSet used for blockUser — idempotent; a repeated block is safe and returns the same 200 response"
  - "reporterUid always sourced from req.user.uid (token), never req.body — prevents T-07-02 repudiation"
  - "Route ordering: /block/:uid and /report are POST routes; GET /:uid is GET — no method conflict, but declared before /:uid anyway per plan convention and for clarity"
  - "Report modal uses React Native built-in Modal (bottom-sheet) — no extra library; Submit disabled until reportReason.trim() is non-empty (T-07-04 client gate)"
  - "Block confirmation uses Alert before the API call — prevents accidental blocks"

requirements-completed: [VERI-06, VERI-07]

# Metrics
duration: 4min
completed: 2026-07-05
status: complete
---

# Phase 01 Plan 07: Block and Report Safety Controls Summary

**Block a user (VERI-06) and report a user or content to admins (VERI-07) — personal safety controls that complete Phase 1 of the trust-foundation**

## Performance

- **Duration:** ~4 min
- **Completed:** 2026-07-05
- **Tasks completed:** 2/2 (Task 3 is checkpoint:human-verify — deferred to end-of-phase UAT)
- **Files created/modified:** 5

## Accomplishments

### Backend

- `backend/src/models/Report.js` — new Mongoose `Report` schema:
  - `reporterUid` (String, required) — always from verified token (T-07-02)
  - `reportedUid` (String, default null) — nullable for content-only reports
  - `contentType` (enum: listing | message | user)
  - `contentId` (String, default null)
  - `reason` (String, required) — backend enforces (T-07-04)
  - `status` (enum open | resolved, default 'open')
  - `{ timestamps: true }` — createdAt/updatedAt

- `backend/src/controllers/userController.js` — two new handlers appended:
  - `blockUser`: `$addToSet` idempotent append to `req.user.uid`'s `blockedUsers`; self-block returns 400; success → `{ status: 'blocked' }` (T-07-01)
  - `reportUser`: requires non-empty `reason` (400 otherwise, T-07-04); `reporterUid` from token (T-07-02); `Report.create(...)` → `{ status: 'reported' }` (VERI-07)

- `backend/src/routes/users.js` — two new routes added:
  - `POST /block/:uid` — `verifyFirebaseToken + requireVerified + blockUser` (T-07-03)
  - `POST /report` — `verifyFirebaseToken + requireVerified + reportUser` (T-07-03)
  - Both declared BEFORE `GET /:uid` for correct Express route ordering
  - Plan 06 slot comment removed
  - `node --check` passes on all three backend files

### Mobile

- `mobile/src/services/api.ts` — two new exports:
  - `blockUser(uid: string)` — POST /api/users/block/:uid
  - `reportUser(payload: ReportPayload)` — POST /api/users/report
  - `ReportPayload` interface exported (reportedUid?, contentType?, contentId?, reason required)

- `mobile/src/screens/Profile/ViewProfileScreen.tsx` — Plan 07 slot filled:
  - Added `navigation` to props destructure (enables `navigation.goBack()` after block)
  - **Block button**: `Alert.alert` confirmation before API call → calls `blockUser(uid)` → on success navigate back (VERI-06)
  - **Report button**: opens bottom-sheet Modal; `TextInput` for reason; Submit disabled until `reportReason.trim()` is non-empty (T-07-04 client gate); calls `reportUser({ reportedUid: uid, contentType: 'user', reason })` → confirmation Alert on success (VERI-07)
  - New imports: `TouchableOpacity`, `Modal`, `TextInput`, `Alert` (all from react-native)
  - New styles: `safetyActions`, `blockButton`/`Text`, `reportButton`/`Text`, `buttonDisabled`, modal card/overlay/button/input styles
  - `npx tsc --noEmit` → 0 errors

## Task Commits

### Parent repo (backend)
1. **Task 1: Report model + blockUser/reportUser backend endpoints** — `d71e827` (feat)

### Mobile repo (`mobile/`)
2. **Task 2: Block + report actions on ViewProfileScreen** — `289facf` (feat)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Additions (Rule 2 — missing critical functionality)

None — the plan already specified all required security controls (T-07-01 through T-07-04).

## Known Stubs

None introduced in this plan. The block/report slot from Plan 05 is now fully wired.

## Threat Model Coverage

| Threat ID | Status | Implementation |
|-----------|--------|---------------|
| T-07-01 Tampering — block on behalf of another user | Mitigated | `blockUser` keys on `req.user.uid` from verified token; callers can only modify their own `blockedUsers` |
| T-07-02 Repudiation — anonymous reports | Mitigated | `reporterUid` is always `req.user.uid` from the verified token; never taken from request body |
| T-07-03 Elevation — unverified users blocking/reporting | Mitigated | Both `/block/:uid` and `/report` routes guarded by `requireVerified` middleware |
| T-07-04 Input Validation — report with no reason | Mitigated | Backend 400s when `reason` is missing/empty; `ViewProfileScreen` disables Submit button until `reportReason.trim()` is non-empty |

## Checkpoint (Task 3)

**Paused at:** `checkpoint:human-verify`
**Disposition:** Deferred to end-of-phase UAT per `workflow.human_verify_mode: "end-of-phase"`

**What needs verification:**
1. Backend running with `.env` populated (MONGODB_URI, FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_STORAGE_BUCKET)
2. Two approved (verified) users A and B available
3. As user A, open user B's profile (ViewProfileScreen) and tap **Block** → confirm → success Alert → navigates back
4. Check MongoDB: `db.users.findOne({ firebaseUid: A.uid }).blockedUsers` contains B's uid
5. As user B, try to open user A's profile → expect 403 / "Not available" error (proves VERI-06 enforcement via getProfile)
6. As user A, open a profile, tap **Report** → modal appears; try Submit with empty reason (button stays disabled, T-07-04); enter a reason and Submit → success Alert
7. Check MongoDB: `db.reports.findOne({ reporterUid: A.uid })` has `status: 'open'` and the entered reason (proves VERI-07)

## Self-Check: PASSED

- `backend/src/models/Report.js` — FOUND
- `backend/src/controllers/userController.js` — FOUND (blockUser, reportUser exported)
- `backend/src/routes/users.js` — FOUND (/block/:uid and /report before /:uid)
- `mobile/src/services/api.ts` — FOUND (blockUser, reportUser exported)
- `mobile/src/screens/Profile/ViewProfileScreen.tsx` — FOUND (Block + Report UI)
- Backend commit `d71e827` — FOUND
- Mobile commit `289facf` — FOUND
- `node --check` on all backend files — PASSES
- `npx tsc --noEmit` in mobile — 0 errors
