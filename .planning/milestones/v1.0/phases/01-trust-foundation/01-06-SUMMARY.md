---
phase: 01-trust-foundation
plan: 06
subsystem: push-notifications
tags: [expo, eas, expo-notifications, react-native, typescript]

# Dependency graph
requires: ["01-02", "01-03", "01-04"]
provides:
  - mobile/eas.json: EAS build config (development/preview/production profiles)
  - mobile/app.json: expo-notifications plugin + extra.eas.projectId placeholder
  - mobile/src/services/push.ts: registerForPushNotifications() — permission check, Android channel, getExpoPushTokenAsync, savePushToken
  - mobile/src/hooks/useFirebaseAuth.ts: push registration called on authenticated login (session-guarded)
  - mobile/App.tsx: setNotificationHandler at module scope for foreground notifications
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - EAS dev build config (developmentClient:true, distribution:internal)
    - expo-notifications plugin in app.json for managed workflow
    - registerForPushNotifications with graceful null-return on missing projectId/permission
    - non-blocking push registration after onAuthStateChanged (fire-and-forget, does not block navigation)
    - Notifications.setNotificationHandler at module scope for foreground delivery

key-files:
  created:
    - mobile/eas.json
    - mobile/src/services/push.ts
  modified:
    - mobile/app.json
    - mobile/src/hooks/useFirebaseAuth.ts
    - mobile/App.tsx

key-decisions:
  - "registerForPushNotifications() returns null (not throws) on missing projectId or denied permission — push is a best-effort feature; approval/rejection succeeds regardless (matches notificationService.js no-op pattern from Plan 04)"
  - "Push registration is fire-and-forget (.then()) in onAuthStateChanged — does NOT await; nav switch cannot block on an optional async operation"
  - "setNotificationHandler uses shouldShowBanner + shouldShowList (not deprecated shouldShowAlert) — expo-notifications v57 API"
  - "Android notification channel created before permission request — required for push tokens to work on Android"
  - "app.json projectId uses placeholder 'YOUR_EAS_PROJECT_ID'; push.ts guards against this value and warns; real ID populated by user running `eas init`"

requirements-completed: [VERI-04]

# Metrics
duration: 8min
completed: 2026-07-05
status: complete
---

# Phase 01 Plan 06: EAS Config + Push Token Registration Summary

**EAS dev build config, Expo push token registration on login, and foreground notification handler — completing the mobile half of VERI-04 (the backend push sender was implemented in Plan 04)**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-07-05T19:41Z
- **Tasks completed:** 1/1 auto (Task 2 is checkpoint:human-action — documented in User Setup below)
- **Files created/modified:** 5

## Accomplishments

- `mobile/eas.json` — standard EAS build config: `development` profile with `developmentClient: true` + `distribution: internal`; `preview` with internal distribution; `production` stub (standard EAS layout per RESEARCH)
- `mobile/app.json` — added `plugins: [["expo-notifications", {icon, color}]]` for managed workflow + `extra.eas.projectId: "YOUR_EAS_PROJECT_ID"` (placeholder populated by `eas init`)
- `mobile/src/services/push.ts` — `registerForPushNotifications()`:
  - Sets Android notification channel (AndroidImportance.MAX) before permission request
  - Checks existing permission before prompting (`getPermissionsAsync`) to avoid repeated dialogs
  - Guards against missing/placeholder projectId — returns null with console.warn
  - Calls `getExpoPushTokenAsync({ projectId })` then `savePushToken(token)` (Plan 03 endpoint)
  - Try/catch — returns null on any registration failure; never throws
- `mobile/src/hooks/useFirebaseAuth.ts` — added push registration call inside `onAuthStateChanged` handler (after setUser/setVerified); fire-and-forget `.then()` so navigation is not blocked; session-guarded via `useAuthStore.getState().expoPushToken` check
- `mobile/App.tsx` — added `Notifications.setNotificationHandler({...})` at module scope with `shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false` (v57 API — not deprecated `shouldShowAlert`)
- `npx tsc --noEmit` → 0 errors

## Task Commits (in mobile repo)

1. **Task 1: EAS config + Expo push token registration wired to login** — `a1a6825` (feat)

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria met:
- `mobile/app.json` contains `expo.extra.eas.projectId` (set to placeholder; user runs `eas init`) and `expo-notifications` plugin entry
- `mobile/eas.json` defines `development` profile with `developmentClient: true`
- `mobile/src/services/push.ts` calls `getExpoPushTokenAsync({ projectId })` then `savePushToken(...)`, returns null when permission denied or projectId missing/placeholder
- `useFirebaseAuth.ts` calls `registerForPushNotifications()` on authenticated login, guarded against duplicates via `useAuthStore.getState().expoPushToken`
- `npx tsc --noEmit` reports 0 errors

## Threat Model Coverage

| Threat ID | Status | Implementation |
|-----------|--------|----------------|
| T-06-01 Spoofed approval push granting access | Mitigated | `setNotificationHandler` and response listener only trigger `getIdToken(true)`; actual access derives from the signed `isVerified` custom claim set by the backend (D-08), not the push payload. Comment in App.tsx documents this. |
| T-06-02 Registering another user's push token | Mitigated | `savePushToken` in api.ts calls `POST /api/users/push-token` with `authHeaders()` (Bearer token); backend endpoint keys on `req.user.uid` from verified Firebase token (Plan 03) |
| T-06-03 Push flooding | Accepted | expo-server-sdk handles rate limiting/batching; volume is admin-driven and low for MVP |

## Checkpoint (Task 2 — EAS Device Build)

**Type:** `checkpoint:human-action`
**Disposition:** Per `sequential_execution` CHECKPOINT POLICY — this EAS/device step requires human-only actions; documented in User Setup below. No further implementation tasks depend on it. Verification criteria deferred to end-of-phase UAT per `workflow.human_verify_mode: "end-of-phase"`.

**What the human verification step tests:**
1. EAS dev build installed on physical Android device
2. Sign in as PENDING user — confirm `expoPushToken` saved in MongoDB
3. Admin approves user (Plan 04 panel) → push arrives → tap → token force-refresh → `isVerified: true` → app navigates to Profile (D-09)
4. Admin rejects user → push arrives → app shows rejection reason + Resubmit button (D-07)

## User Setup Required

**To activate push notifications end-to-end:**

1. **EAS setup** (one-time):
   ```bash
   npm install -g eas-cli   # if not installed
   cd mobile
   eas login                # log in to expo.dev
   eas init                 # writes the real projectId into app.json extra.eas.projectId
   ```

2. **Build a dev client** (required — Expo Go does not deliver push on Android from SDK 53+):
   ```bash
   cd mobile
   eas build --profile development --platform android
   ```
   Install the resulting APK on a physical device or emulator.

3. **Verify push loop:**
   - Launch the dev build; sign in as a PENDING user; grant notification permission
   - Confirm in MongoDB that `expoPushToken` is non-null for that user
   - Use the admin panel (`cd admin && npm run dev`) to Approve the user
   - Expected: "You're verified!" push arrives on device; tap it
   - Expected: app navigates from pending gate into main app (Profile screen) — D-09
   - Repeat with a second user; Reject with a reason
   - Expected: rejection push arrives; opening app shows rejection reason + Resubmit button — D-07

## Self-Check: PASSED

- `mobile/eas.json` — exists ✓
- `mobile/app.json` — exists with `extra.eas.projectId` and `expo-notifications` plugin ✓
- `mobile/src/services/push.ts` — exists ✓
- `mobile/src/hooks/useFirebaseAuth.ts` — exists (modified) ✓
- `mobile/App.tsx` — exists (modified with setNotificationHandler) ✓
- Commit `a1a6825` — present in mobile repo ✓
- `npx tsc --noEmit` in mobile/ — 0 errors ✓

