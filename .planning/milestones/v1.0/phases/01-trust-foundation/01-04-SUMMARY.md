---
phase: 01-trust-foundation
plan: 04
subsystem: admin-moderation
tags: [express, jwt, expo-server-sdk, react, vite, typescript, firebase-admin]

# Dependency graph
requires: ["01-01", "01-03"]
provides:
  - notificationService.js: sendPushNotification (expo-server-sdk, no-op if token absent)
  - adminController.js: login (8h JWT), getQueue (signed URLs), approveUser (custom claim + push), rejectUser (reason required + push, no claim)
  - routes/admin.js: verifyAdminSession middleware + POST /login + GET /verification-queue + POST /approve/:uid + POST /reject/:uid
  - server.js: /api/admin router mounted
  - admin/ React+Vite SPA: Login page, Queue page, VerificationCard component
affects: [01-05, 01-06, 01-07]

# Tech tracking
tech-stack:
  added: [vite 8.1.3, @vitejs/plugin-react 4.x, React 19 (admin SPA)]
  patterns:
    - admin session JWT with role claim (short-lived 8h, signed with ADMIN_JWT_SECRET)
    - sendPushNotification no-op guard pattern (Expo.isExpoPushToken check)
    - Vite dev proxy for /api CORS avoidance
    - conditional Login->Queue rendering (no router for internal tooling)
    - VerificationCard Reject-disabled-until-reason pattern (D-07)

key-files:
  created:
    - backend/src/services/notificationService.js
    - backend/src/controllers/adminController.js
    - backend/src/routes/admin.js
    - backend/test/admin.login.test.js
    - admin/vite.config.ts
    - admin/src/api/adminApi.ts
    - admin/src/pages/Login.tsx
    - admin/src/pages/Queue.tsx
    - admin/src/components/VerificationCard.tsx
    - admin/src/main.tsx
    - admin/package.json (+ all Vite scaffold files)
  modified:
    - backend/src/server.js

key-decisions:
  - "Admin session JWT carries role:'admin' claim; verifyAdminSession checks both signature and role (T-04-02)"
  - "sendPushNotification silently no-ops if expoPushToken is absent or invalid — approval/rejection succeeds regardless of push delivery"
  - "rejectUser returns 400 immediately if reason is absent or whitespace-only (D-07 backend enforcement)"
  - "Vite dev proxy maps /api -> http://localhost:3000 so the SPA never hits CORS in development (RESEARCH Pitfall 7)"
  - "No router in admin SPA — simple loggedIn boolean state is sufficient for 1-2 admins (D-04)"

requirements-completed: [VERI-03, VERI-04]

coverage:
  - id: D1
    description: "Admin login endpoint returns 401 for wrong creds and {token} for correct creds"
    requirement: "VERI-03"
    verification:
      - kind: unit
        ref: "backend/test/admin.login.test.js (4 tests: 2x401, 1x200+token, 1x JWT role:admin)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Full moderation flow: login, queue, approve (custom claim set), reject (reason required)"
    requirement: "VERI-03"
    verification: []
    human_judgment: true
    rationale: "Requires live backend + Firebase + at least one pending user; deferred to end-of-phase UAT"
  - id: D3
    description: "Push notification sent on approve and reject"
    requirement: "VERI-04 (backend half)"
    verification: []
    human_judgment: true
    rationale: "Requires EAS dev build and physical Android device; deferred to Plan 06"

# Metrics
duration: 6min
completed: 2026-07-05
status: complete
---

# Phase 01 Plan 04: Admin Moderation Panel Summary

**Backend admin API (login, queue, approve with isVerified claim + push, reject with required reason + push) and a separate React+Vite admin SPA (Login -> Queue -> VerificationCard with Reject-disabled-until-reason)**

## Performance

- **Duration:** ~6 min
- **Completed:** 2026-07-05T18:40Z
- **Tasks completed:** 2/2 auto (Task 3 is checkpoint:human-verify -- deferred to end-of-phase UAT)
- **Files created/modified:** 12 (backend: 5, admin SPA: 23 scaffold + custom files)

## Accomplishments

### Backend

- `backend/src/services/notificationService.js` -- `sendPushNotification(expoPushToken, title, body, data={})`: module-level `Expo` instance; early returns if token absent or not a valid Expo push token; otherwise fires `expo.sendPushNotificationsAsync`
- `backend/src/controllers/adminController.js`:
  - `login`: compares `email/password` to env vars, 401 on mismatch, issues 8h JWT with `role:'admin'`
  - `getQueue`: fetches `verificationStatus:'pending'` users, resolves signed URLs for each doc + selfie via `storageService.getSignedUrl`
  - `approveUser`: updates MongoDB to `approved`, calls `getAuth().setCustomUserClaims(uid,{isVerified:true})` (D-08), sends approval push
  - `rejectUser`: 400 if `reason` absent (D-07), updates MongoDB to `rejected` + stores `rejectionReason`, sends rejection push -- custom claim NOT set
- `backend/src/routes/admin.js`: `verifyAdminSession` middleware (checks Bearer JWT signature + `role:'admin'`; T-04-02); four routes with correct guard placement
- `backend/src/server.js`: `adminRouter` mounted at `/api/admin`
- `backend/test/admin.login.test.js`: 4 node:test unit tests -- all pass: 401 for wrong email, 401 for wrong password, 200+token for correct creds, JWT role:admin claim verified

### Admin SPA

- `admin/vite.config.ts`: Vite dev proxy maps `/api` -> `http://localhost:3000` (RESEARCH Pitfall 7)
- `admin/src/api/adminApi.ts`: `setSessionToken`, `authedFetch` (attaches Bearer), `adminLogin`, `getVerificationQueue`, `approveUser`, `rejectUser` -- plain `fetch`, no axios
- `admin/src/pages/Login.tsx`: email + password form, calls `adminLogin`, sets token on success, error display
- `admin/src/pages/Queue.tsx`: fetches queue on mount, re-fetches after each card action, Refresh button
- `admin/src/components/VerificationCard.tsx`: renders email, doc + selfie images from signed URLs; Approve button; Reject text input + button **disabled until reason is non-empty** (D-07); cursor `not-allowed` when disabled
- `admin/src/main.tsx`: renders `<Login onLoggedIn>` -> `<Queue>` based on `loggedIn` boolean state

Build result: `tsc --noEmit` clean + `npm run build` passes (dist: 196kB, 0 TS errors).

## Task Commits

1. **Task 1: Backend admin API** -- `ac836d2` (feat)
2. **Task 2: Admin React+Vite SPA** -- `00795db` (feat)

## Deviations from Plan

None -- plan executed exactly as written. All acceptance criteria met:
- `node --test test/admin.login.test.js` -> 4/4 pass
- `approveUser` calls `setCustomUserClaims` AND `sendPushNotification`; `rejectUser` does neither set a claim, requires reason (400 if absent), sends `verification_rejected` push
- `getQueue` resolves signed URLs via `storageService.getSignedUrl`
- `admin.js` guards queue/approve/reject with `verifyAdminSession`; `server.js` mounts `/api/admin`
- `vite.config.ts` proxies `/api` to backend; `adminApi.ts` exports all 4 functions using plain fetch
- `VerificationCard.tsx` disables Reject until reason is non-empty; `npm run build` succeeds

## Threat Model Coverage

| Threat ID | Status | Implementation |
|-----------|--------|----------------|
| T-04-01 credential brute-force | Documented | Rate-limit `POST /api/admin/login` before production (express-rate-limit; noted in Security Domain) |
| T-04-02 forged admin session | Mitigated | `verifyAdminSession` verifies JWT with ADMIN_JWT_SECRET and checks `decoded.role === 'admin'` |
| T-04-03 unauthorized setCustomUserClaims | Mitigated | Claim set only inside `approveUser` which is guarded by `verifyAdminSession` |
| T-04-04 document exposure | Mitigated | `getQueue` generates 15-min signed URLs; raw Storage paths are not exposed |
| T-04-05 reject without reason | Mitigated | Backend 400s if reason absent; SPA `VerificationCard` disables Reject button until input non-empty |
| T-04-SC vite/plugin-react legitimacy | Mitigated | Approved in RESEARCH Package Legitimacy Audit |

## Checkpoint (Task 3)

**Type:** `checkpoint:human-verify`
**Disposition:** Deferred to end-of-phase UAT per `workflow.human_verify_mode: "end-of-phase"`

**What needs human verification:**
1. Backend running with `.env` populated (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET` set); at least one user is `pending` from Plan 03
2. Start admin panel: `cd admin && npm run dev`; open the printed localhost URL
3. Log in with wrong password -> expect an error. Log in with `ADMIN_EMAIL`/`ADMIN_PASSWORD` -> expect the queue
4. Confirm pending user's ID document and selfie images render (signed URLs load)
5. Click Reject without a reason -> action is **blocked** (button disabled). Enter a reason and reject -> confirm in MongoDB: `verificationStatus:'rejected'`, `rejectionReason` set
6. For another pending user, click Approve -> confirm MongoDB: `verificationStatus:'approved'`; in Firebase Console -> Authentication, confirm custom claim `isVerified: true` is set

## User Setup Required

Per plan `user_setup`:
1. **Firebase Storage Security Rules:** Set to deny all public reads (`allow read, write: if false;`) -- admin reads go via Admin SDK signed URLs which bypass rules (T-04-04)
2. **Admin credentials in backend `.env`:**
   - `ADMIN_EMAIL` -- choose an admin email
   - `ADMIN_PASSWORD` -- choose a strong password
   - `ADMIN_JWT_SECRET` -- generate with `openssl rand -hex 32`

## Self-Check: PASSED

- `backend/src/services/notificationService.js` -- exists
- `backend/src/controllers/adminController.js` -- exists
- `backend/src/routes/admin.js` -- exists
- `backend/test/admin.login.test.js` -- exists (4/4 tests pass)
- `admin/vite.config.ts` -- exists (proxy configured)
- `admin/src/api/adminApi.ts` -- exists
- `admin/src/pages/Login.tsx` -- exists
- `admin/src/pages/Queue.tsx` -- exists
- `admin/src/components/VerificationCard.tsx` -- exists
- `admin/src/main.tsx` -- exists
- `backend/src/server.js` -- modified (/api/admin mounted)
- Commits `ac836d2` (backend), `00795db` (admin SPA) -- both present
- `node --check` on all backend files -- passes
- `npx tsc --noEmit` in admin/ -- 0 errors
- `npm run build` in admin/ -- 196kB dist, 0 errors
