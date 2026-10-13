---
phase: 01-trust-foundation
plan: 03
subsystem: verification-upload
tags: [express, multer, firebase-storage, expo-image-picker, react-navigation, typescript]

# Dependency graph
requires: ["01-01", "01-02"]
provides:
  - storageService.js: uploadVerificationDoc (resumable:false, protected path) + getSignedUrl (15-min signed URL)
  - userController.js: submitVerificationDocs (MIME validation ASVS V5) + savePushToken
  - routes/users.js: POST /api/users/verification-docs + POST /api/users/push-token, multer 5MB limit
  - server.js: /api/users router mounted
  - DocumentUploadScreen: expo-image-picker two-slot capture, Submit disabled until both, submits via uploadVerificationDocs
  - VerificationNavigator: navigator wrapping DocumentUpload + PendingVerification for Resubmit flow
  - PendingVerificationScreen: navigation prop, thumbnails from route params, Resubmit button (pending + rejected)
  - api.ts: savePushToken(token) helper added
affects: [01-04, 01-05, 01-06, 01-07]

# Tech tracking
tech-stack:
  added: []
  patterns: [multer memoryStorage -> Firebase Storage Admin SDK pipeline, VerificationNavigator for intra-unverified navigation, navigation param thumbnails for session-only photo display]

key-files:
  created:
    - backend/src/services/storageService.js
    - backend/src/controllers/userController.js
    - backend/src/routes/users.js
    - mobile/src/screens/Auth/DocumentUploadScreen.tsx
    - mobile/src/navigation/VerificationNavigator.tsx
  modified:
    - backend/src/server.js
    - mobile/src/services/api.ts
    - mobile/src/screens/Auth/PendingVerificationScreen.tsx
    - mobile/src/navigation/RootNavigator.tsx

key-decisions:
  - "VerificationNavigator wraps DocumentUpload + PendingVerification instead of adding DocumentUpload to AuthNavigator — required because AuthNavigator unmounts immediately after Firebase auth state fires on sign-up, so navigation inside it cannot reach DocumentUpload in time"
  - "initialRouteName in VerificationNavigator derived from verificationStatus store: 'none' -> DocumentUpload, 'pending'/'rejected' -> PendingVerification"
  - "Photo thumbnails passed as route params (not stored in the Zustand store) — session-only display; persistence deferred to Plan 04/05 when verificationStatus is synced from API on auth state change"
  - "Resubmit available for both 'pending' and 'rejected' states (D-06) — an outline button for pending, a red button inside the rejection box for rejected"

# Metrics
duration: 2min
completed: 2026-07-05
status: complete
---

# Phase 01 Plan 03: Document Upload Vertical Slice Summary

**Multer memoryStorage → Firebase Storage protected path → verificationStatus 'pending' pipeline, with expo-image-picker two-slot capture screen and resubmit-while-pending flow (VERI-02, D-05, D-06)**

## Performance

- **Duration:** ~2 min
- **Completed:** 2026-07-05T18:28Z
- **Tasks completed:** 2/2 (Task 3 is checkpoint:human-verify — deferred to end-of-phase UAT)
- **Files created/modified:** 9

## Accomplishments

### Backend

- `backend/src/services/storageService.js` — `uploadVerificationDoc(uid, field, buffer, mimetype)` uses `resumable: false` (required for small in-memory buffers, RESEARCH Pitfall) to save under `verification/<uid>/<field>` protected path; `getSignedUrl(path)` returns a 15-minute read URL for admin panel use
- `backend/src/controllers/userController.js` — `submitVerificationDocs`: validates both files present + MIME type starts with `image/` (ASVS V5, T-03-04), calls `uploadVerificationDoc` for each, updates MongoDB to `verificationStatus: 'pending'` with fixed Storage paths; `savePushToken`: validates token presence, updates `expoPushToken` field
- `backend/src/routes/users.js` — multer `memoryStorage` + `limits.fileSize: 5MB` (T-03-01) + `.fields([idDocument, selfie])`, guards routes with `verifyFirebaseToken`; includes clearly marked PLAN 05 and PLAN 06 extension slots
- `backend/src/server.js` — mounts `usersRouter` at `/api/users`

### Mobile

- `mobile/src/services/api.ts` — added `savePushToken(token)` POST to `/api/users/push-token`
- `mobile/src/navigation/VerificationNavigator.tsx` — new native-stack navigator wrapping `DocumentUploadScreen` + `PendingVerificationScreen`; `initialRouteName` derived from `verificationStatus` store state; typed `VerificationStackParamList` exported for both screens
- `mobile/src/screens/Auth/DocumentUploadScreen.tsx` — `expo-image-picker` `launchImageLibraryAsync` (quality 0.8, no base64); two pick slots with thumbnails; Submit disabled until both URIs picked; calls `uploadVerificationDocs` (no Content-Type header — RESEARCH Pitfall 5 avoided); on success: `setVerificationStatus('pending')` + `navigation.navigate('PendingVerification', { idDocumentUri, selfieUri })`
- `mobile/src/screens/Auth/PendingVerificationScreen.tsx` — added `NativeStackScreenProps` navigation prop; shows photo thumbnails from route params; Resubmit button in both pending (outline) and rejected (red, inside rejection box) states; `rejectionReason` display for D-07
- `mobile/src/navigation/RootNavigator.tsx` — `user && !isVerified` now renders `<VerificationNavigator />` instead of direct `<PendingVerificationScreen />`
- TypeScript: `npx tsc --noEmit` exits 0

## Task Commits

### Parent repo (backend)
1. **Task 1: Backend upload pipeline** — `8a38a29` (feat)

### Mobile repo (`mobile/`)
2. **Task 2: Mobile document upload screen + API client** — `294971c` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DocumentUpload added to VerificationNavigator instead of AuthNavigator**
- **Found during:** Task 2 routing analysis
- **Issue:** The plan instructed "Add DocumentUpload to AuthNavigator." AuthNavigator is only rendered when `!user`. After `createUserWithEmailAndPassword`, Firebase fires `onAuthStateChanged` immediately, which sets `user` in the Zustand store, which causes RootNavigator to switch away from AuthNavigator before any `navigation.navigate('DocumentUpload')` call could execute. Additionally, `PendingVerificationScreen`'s Resubmit button (D-06) requires navigating to `DocumentUploadScreen` — impossible if they are in separate navigators.
- **Fix:** Created `VerificationNavigator` (a new native-stack navigator) that wraps both `DocumentUploadScreen` and `PendingVerificationScreen`. `RootNavigator` renders `VerificationNavigator` for `user && !isVerified`. `initialRouteName` is derived from `verificationStatus` store state. Both screens share the same stack so `navigation.navigate()` works in both directions.
- **Files modified:** `mobile/src/navigation/VerificationNavigator.tsx` (created), `mobile/src/navigation/RootNavigator.tsx` (updated)
- **Commit:** `294971c`

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| Photo thumbnails only visible in same session (not persisted) | `mobile/src/screens/Auth/PendingVerificationScreen.tsx` | ~55-72 | `verificationStatus` is not persisted in Zustand across cold-starts; thumbnails rely on route params from the just-submitted upload. Plan 04/05 should add API fetch of verificationStatus on onAuthStateChanged to populate the store correctly on restart. |
| `initialRouteName` in VerificationNavigator falls back to DocumentUpload on cold start | `mobile/src/navigation/VerificationNavigator.tsx` | ~51 | On cold start, Zustand `verificationStatus` resets to 'none' regardless of server-side state. A pending user will see DocumentUploadScreen first. D-06 allows resubmit so this is functionally correct, but suboptimal UX; fix in Plan 04/05 when API sync is added. |

## Threat Model Coverage

| Threat ID | Status | Implementation |
|-----------|--------|---------------|
| T-03-01 DoS oversized upload | Mitigated | multer `limits.fileSize: 5MB` rejects oversized uploads with 400 |
| T-03-02 Direct device→Storage write | Mitigated | All uploads routed through backend; Storage rules must deny client writes (user setup task from Plan 01-04) |
| T-03-03 ID document readable by anyone | Mitigated | `verification/<uid>/` path is private; `getSignedUrl` generates 15-min read URLs for admin use only |
| T-03-04 Non-image MIME type | Mitigated | `submitVerificationDocs` rejects any file whose `mimetype` does not start with `image/` (400) |

## Checkpoint (Task 3)

**Paused at:** `checkpoint:human-verify`
**Disposition:** Deferred to end-of-phase UAT per `workflow.human_verify_mode: "end-of-phase"`

**What needs verification:**
1. Backend running with `.env` populated (MONGODB_URI, FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_STORAGE_BUCKET)
2. Mobile app running (`cd mobile && npx expo start`)
3. Sign in as user created in Plan 02; verify they land on DocumentUploadScreen (verificationStatus='none')
4. Pick an image for ID document and one for selfie; confirm both thumbnails appear and Submit button enables
5. Submit. Expected: app shows the pending "Under review" screen with photo thumbnails
6. In MongoDB, confirm `verificationStatus: 'pending'`, non-empty `verificationDocumentUrl` + `selfieUrl`
7. In Firebase Console → Storage, confirm two objects under `verification/<uid>/` and pasting a raw object URL is DENIED (not public — T-03-03)
8. Tap "Replace submitted documents", pick different images, submit again; confirm Storage objects are overwritten (D-06)

## Self-Check: PASSED

- `backend/src/services/storageService.js` — exists ✓
- `backend/src/controllers/userController.js` — exists ✓
- `backend/src/routes/users.js` — exists ✓
- `mobile/src/screens/Auth/DocumentUploadScreen.tsx` — exists ✓
- `mobile/src/navigation/VerificationNavigator.tsx` — exists ✓
- Commits `8a38a29` (backend), `294971c` (mobile) — both present ✓
- `node --check` on all backend files — passes ✓
- `npx tsc --noEmit` in mobile — 0 errors ✓
