---
phase: 01-trust-foundation
plan: 05
subsystem: user-profiles
tags: [express, multer, firebase-storage, react-native, expo-image-picker, zustand, typescript]

# Dependency graph
requires: ["01-02", "01-03"]
provides:
  - storageService.js: uploadFile generic helper (arbitrary Storage paths)
  - userController.js: updateProfile (PUT /profile), getProfile (GET /:uid with block check + public projection), uploadProfilePhoto (POST /profile-photo)
  - routes/users.js: profile/profile-photo/get-by-uid routes guarded by requireVerified; correct static-before-param ordering
  - profileStore.ts: Zustand useProfileStore with Profile interface
  - api.ts: getMyProfile, updateProfile, getUserProfile, uploadProfilePhoto (no manual Content-Type)
  - ProfileScreen: own profile with badge + stats
  - EditProfileScreen: form + photo upload via expo-image-picker
  - ViewProfileScreen: public profile with badge + Plan 07 block/report slot
  - AppNavigator: Profile / EditProfile / ViewProfile native-stack (replaces placeholder Home stub)
affects: [01-06, 01-07]

# Tech tracking
tech-stack:
  added: []
  patterns: [Zustand profile store, explicit public projection pattern, block-state 403 guard, uploadFile generic Storage helper]

key-files:
  created:
    - mobile/src/store/profileStore.ts
    - mobile/src/screens/Profile/ProfileScreen.tsx
    - mobile/src/screens/Profile/EditProfileScreen.tsx
    - mobile/src/screens/Profile/ViewProfileScreen.tsx
  modified:
    - backend/src/services/storageService.js
    - backend/src/controllers/userController.js
    - backend/src/routes/users.js
    - mobile/src/services/api.ts
    - mobile/src/navigation/AppNavigator.tsx

key-decisions:
  - "storageService: added generic uploadFile(storagePath, buffer, mimetype) helper — avoids path-hacking the existing uploadVerificationDoc (which prefixes verification/<uid>/<field>); reusable for any future Storage write"
  - "getProfile returns explicit public projection object, never the raw Mongoose doc — email, verificationDocumentUrl, selfieUrl, rejectionReason, expoPushToken are not accessible via this endpoint (T-05-02)"
  - "block check: target.blockedUsers.includes(req.user.uid) → 403 'Not available' — supports Plan 06 VERI-06 block semantics already"
  - "Route ordering in users.js: /profile, /profile-photo, /push-token, /verification-docs all declared before parameterized /:uid so they are not shadowed"
  - "ViewProfileScreen.tsx has a clearly labeled Plan 07 slot comment for block/report action buttons"
  - "AppNavigator placeholder Home stub removed; now exposes Profile (initial) / EditProfile / ViewProfile"

# Metrics
duration: 3min
completed: 2026-07-05
status: complete
---

# Phase 01 Plan 05: User Profile Vertical Slice Summary

**Profile view/edit with verified badge, host/trip stats, and public-profile viewer backed by explicit-projection endpoints guarded by requireVerified and block-state enforcement (PROF-01, PROF-02, PROF-03, PROF-04)**

## Performance

- **Duration:** ~3 min
- **Completed:** 2026-07-05
- **Tasks completed:** 2/2 (Task 3 is checkpoint:human-verify — deferred to end-of-phase UAT)
- **Files created/modified:** 9

## Accomplishments

### Backend

- `backend/src/services/storageService.js` — added `uploadFile(storagePath, buffer, mimetype)` generic helper; exports now include `uploadVerificationDoc`, `getSignedUrl`, `uploadFile`
- `backend/src/controllers/userController.js` — added three new async handlers:
  - `updateProfile`: validates bio ≤ 500 chars (T-05-04), picks displayName/bio/homeCity, `findOneAndUpdate({ new: true })`, responds `{ data: user }`
  - `getProfile`: loads target by firebaseUid (404 if absent), 403 if requester in `target.blockedUsers` (T-05-03), returns explicit public projection with `isVerified` derived from `verificationStatus === 'approved'`, `photoURL` resolved via `getSignedUrl` (T-05-02)
  - `uploadProfilePhoto`: validates MIME starts with `image/` (T-05-04), uploads to `profiles/<uid>/photo` via `uploadFile`, updates `photoURL` field
- `backend/src/routes/users.js` — added `requireVerified` import, `uploadSingle` multer instance (`.single('photo')`, 5 MB limit), and three routes in correct order before `/:uid`:
  - `PUT /profile` — `verifyFirebaseToken + requireVerified`
  - `POST /profile-photo` — `verifyFirebaseToken + requireVerified + uploadSingle`
  - `GET /:uid` — `verifyFirebaseToken + requireVerified`
  - `node --check` passes on all backend files

### Mobile

- `mobile/src/store/profileStore.ts` — `useProfileStore` Zustand store with `Profile` interface (`uid?`, `displayName?`, `photoURL?`, `bio?`, `homeCity?`, `isVerified?`, `hostsCount`, `tripsCount`), `setProfile`, `clear`
- `mobile/src/services/api.ts` — added `getMyProfile()`, `updateProfile(fields)`, `getUserProfile(uid)`, `uploadProfilePhoto(uri)` (no manual Content-Type — RESEARCH Pitfall 5)
- `mobile/src/navigation/AppNavigator.tsx` — replaced placeholder Home with typed `AppStackParamList` (`Profile`, `EditProfile`, `ViewProfile: { uid }`) and native-stack navigator with `initialRouteName: 'Profile'`
- `mobile/src/screens/Profile/ProfileScreen.tsx` — loads own profile via `getMyProfile()`, shows photo/displayName/badge(PROF-02)/bio/homeCity/stats "Stays hosted: N · Trips: N" (PROF-03)/Edit button
- `mobile/src/screens/Profile/EditProfileScreen.tsx` — form for displayName/bio(500 max)/homeCity + photo picker via `expo-image-picker launchImageLibraryAsync({ mediaTypes: ['images'] })` + `uploadProfilePhoto` (PROF-01), saves via `updateProfile`, refreshes store
- `mobile/src/screens/Profile/ViewProfileScreen.tsx` — receives `uid` route param, calls `getUserProfile`, renders public projection with badge (PROF-04), labeled Plan 07 block/report slot
- `npx tsc --noEmit` → 0 errors

## Task Commits

### Parent repo (backend)
1. **Task 1: Backend profile endpoints** — `79303bb` (feat)

### Mobile repo (`mobile/`)
2. **Task 2: Mobile profile store, screens, navigation** — `19f197f` (feat)

## Deviations from Plan

### Auto-fixed Issues

None. Plan executed exactly as written.

### Additions (Rule 2 — missing critical functionality)

**1. [Rule 2 - Security] Added bio max-length validation before DB call in `updateProfile`**
- **Found during:** Task 1 implementation
- **Issue:** The plan specified bio maxlength 500 enforcement. The Mongoose schema has `maxlength: 500` which rejects at the DB layer, but returning a Mongoose validation error (code 11000-style) exposes implementation details. Added explicit `400` check before the DB call.
- **Fix:** `if (bio !== undefined && bio.length > 500) return res.status(400).json({ error: '...' })`
- **Files modified:** `backend/src/controllers/userController.js`
- **Commit:** `79303bb`

**2. [Rule 2 - Correctness] Added `uploadFile` generic helper to storageService instead of path-hacking `uploadVerificationDoc`**
- **Found during:** Task 1 implementation
- **Issue:** Plan says "uploadVerificationDoc-style save to profiles/<uid>/photo". Direct reuse of `uploadVerificationDoc(uid, field, ...)` would construct the path as `verification/${uid}/${field}` — wrong prefix for profile photos. Path-hacking (e.g. `../../profiles/...`) is fragile and incorrect.
- **Fix:** Added `uploadFile(storagePath, buffer, mimetype)` to `storageService.js` — accepts an arbitrary Storage path. `uploadProfilePhoto` uses `profiles/${uid}/photo` directly.
- **Files modified:** `backend/src/services/storageService.js`
- **Commit:** `79303bb`

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `hostsCount` and `tripsCount` always 0 | All profile screens | — | Intentional per plan — housing feature not yet built; PROF-03 specifically calls these "stubbed 0 in Phase 1" |
| Block/report action slot (comment only) | `ViewProfileScreen.tsx` | ~130 | Intentional — Plan 07 fills this slot |

The stubs do not prevent PROF-01..04 from being achieved. The plan explicitly calls hostsCount/tripsCount "stubbed to 0 in Phase 1".

## Threat Model Coverage

| Threat ID | Status | Implementation |
|-----------|--------|---------------|
| T-05-01 Elevation — unverified profile access | Mitigated | `requireVerified` guards all three profile routes (PUT /profile, POST /profile-photo, GET /:uid) |
| T-05-02 Information Disclosure — private fields in GET /:uid | Mitigated | `getProfile` returns an explicit `{ uid, displayName, bio, homeCity, photoURL, isVerified, hostsCount, tripsCount }` object; raw User document never sent |
| T-05-03 Information Disclosure — blocked user viewing profile | Mitigated | `getProfile` 403s when `target.blockedUsers.includes(req.user.uid)` |
| T-05-04 Input Validation — oversized bio / non-image photo | Mitigated | bio length check before DB call (400); `req.file.mimetype.startsWith('image/')` check before Storage write (400); 5 MB multer limit on uploadSingle |

## Checkpoint (Task 3)

**Paused at:** `checkpoint:human-verify`
**Disposition:** Deferred to end-of-phase UAT per `workflow.human_verify_mode: "end-of-phase"`

**What needs verification:**
1. Backend running with `.env` populated (MONGODB_URI, FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_STORAGE_BUCKET)
2. Mobile app running (`cd mobile && npx expo start`) with a user that has `verificationStatus: 'approved'` (from Plan 04)
3. Open app → RootNavigator routes to AppNavigator (Profile as initial route); verification badge visible; stats show "Stays hosted: 0 · Trips: 0"
4. Tap Edit Profile; change display name, bio, home city; pick a new photo; tap Save → Profile screen shows updated values and photo
5. Navigate to another verified user's ViewProfile (by uid) → their public info + badge render; email field not visible
6. Confirm an unverified user cannot reach Profile screens (requireVerified returns 403; RootNavigator shows VerificationNavigator instead of AppNavigator)

## Self-Check: PASSED

- `backend/src/routes/users.js` — FOUND
- `backend/src/controllers/userController.js` — FOUND
- `backend/src/services/storageService.js` — FOUND
- `mobile/src/store/profileStore.ts` — FOUND
- `mobile/src/screens/Profile/ProfileScreen.tsx` — FOUND
- `mobile/src/screens/Profile/EditProfileScreen.tsx` — FOUND
- `mobile/src/screens/Profile/ViewProfileScreen.tsx` — FOUND
- `mobile/src/navigation/AppNavigator.tsx` — FOUND
- `mobile/src/services/api.ts` — FOUND
- Backend commit `79303bb` — FOUND
- Mobile commit `19f197f` — FOUND
- `node --check` on all backend files — PASSES
- `npx tsc --noEmit` in mobile — 0 errors
