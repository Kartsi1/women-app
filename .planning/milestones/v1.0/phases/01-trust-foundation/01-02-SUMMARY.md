---
phase: 01-trust-foundation
plan: 02
subsystem: mobile-auth
tags: [expo, firebase, react-navigation, zustand, typescript]

# Dependency graph
requires: ["01-01"]
provides:
  - Firebase Auth client (initializeAuth + AsyncStorage persistence) in mobile/src/config/firebase.ts
  - Zustand auth store (useAuthStore) with user/isVerified/verificationStatus state
  - useFirebaseAuth hook (onAuthStateChanged + D-09 notification tap token refresh)
  - API service layer (registerUser, uploadVerificationDocs helpers)
  - RootNavigator: 3-branch gate (!user → Auth, user&&!verified → Pending, verified → App)
  - AuthNavigator: SignUp + SignIn native stack
  - AppNavigator: placeholder Home screen (Profile screens added by Plan 05)
  - SignUpScreen: createUserWithEmailAndPassword → registerUser() → auto-routed to pending gate
  - SignInScreen: signInWithEmailAndPassword with inline errors
  - PendingVerificationScreen: full-screen gate with status badge + Plan 03 upload slot
  - mobile/.env.example: 7 EXPO_PUBLIC_* env vars
affects: [01-03, 01-04, 01-05, 01-06, 01-07]

# Tech tracking
tech-stack:
  added: [firebase@12.15.0, @react-native-async-storage/async-storage@2.2.0, "@react-navigation/native@7.3.7", "@react-navigation/native-stack@7.17.9", react-native-screens@4.25.2, react-native-safe-area-context@5.7.0, expo-image-picker@57.0.2, expo-notifications@57.0.3, zustand@5.0.14]
  patterns: [Zustand store pattern, Firebase onAuthStateChanged + custom-claim gate, createNativeStackNavigator auth flow, D-09 force token refresh on notification tap]

key-files:
  created:
    - mobile/src/config/firebase.ts
    - mobile/src/store/authStore.ts
    - mobile/src/hooks/useFirebaseAuth.ts
    - mobile/src/services/api.ts
    - mobile/src/navigation/RootNavigator.tsx
    - mobile/src/navigation/AuthNavigator.tsx
    - mobile/src/navigation/AppNavigator.tsx
    - mobile/src/screens/Auth/SignUpScreen.tsx
    - mobile/src/screens/Auth/SignInScreen.tsx
    - mobile/src/screens/Auth/PendingVerificationScreen.tsx
    - mobile/.env.example
  modified:
    - mobile/App.tsx
    - mobile/package.json
    - mobile/package-lock.json
    - mobile/tsconfig.json

key-decisions:
  - "getReactNativePersistence imported from @firebase/auth (not firebase/auth): firebase/auth package exports map has no react-native condition so TypeScript uses browser types which omit getReactNativePersistence; tsconfig paths redirect @firebase/auth to rn type definitions"
  - "PendingVerificationScreen has labeled Plan 03 slots for upload thumbnails and Resubmit button — functional stubs, not dead code"
  - "AppNavigator has a placeholder Home screen for Plan 05 — intentional temporary stub"

# Metrics
duration: 8min
completed: 2026-07-05
status: complete
---

# Phase 01 Plan 02: Mobile Auth + Gated Navigation Summary

**Firebase sign-up/sign-in with AsyncStorage session persistence, Zustand auth store, onAuthStateChanged gate, and RootNavigator that hard-routes unverified users to a full-screen pending screen (VERI-01, VERI-05)**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-07-05T14:24Z
- **Tasks completed:** 2/2 (Task 3 is a checkpoint:human-verify — paused)
- **Files created/modified:** 15

## Accomplishments

- All required packages installed via `npx expo install` (firebase@12.15.0, async-storage, react-navigation, native-stack, screens, safe-area, image-picker, notifications, zustand)
- `mobile/src/config/firebase.ts` — `initializeAuth` with `getReactNativePersistence(AsyncStorage)` for persistent sessions (RESEARCH Pitfall 4 avoided)
- `mobile/src/store/authStore.ts` — Zustand `useAuthStore` with full Phase 1 state: `user`, `isVerified`, `verificationStatus`, `rejectionReason`, `expoPushToken` + setters + `clear`
- `mobile/src/hooks/useFirebaseAuth.ts` — `onAuthStateChanged` syncs `setUser`/`setVerified` from `getIdTokenResult` claims; D-09 notification-response listener forces `getIdToken(true)` on verification_approved/rejected events
- `mobile/src/services/api.ts` — `registerUser()` + `uploadVerificationDocs()` helpers using plain fetch; `authHeaders()` helper
- `mobile/src/navigation/RootNavigator.tsx` — `NavigationContainer` with 3-branch logic: `!user → AuthNavigator`, `user && !isVerified → PendingVerificationScreen`, `isVerified → AppNavigator`
- `mobile/src/navigation/AuthNavigator.tsx` and `AppNavigator.tsx` — `createNativeStackNavigator` (native, not JS stack)
- `mobile/src/screens/Auth/SignUpScreen.tsx` — `createUserWithEmailAndPassword` → `registerUser()` → RootNavigator auto-routes to pending gate
- `mobile/src/screens/Auth/SignInScreen.tsx` — `signInWithEmailAndPassword` with inline error
- `mobile/src/screens/Auth/PendingVerificationScreen.tsx` — full-screen pending gate with status badge, estimated wait, rejection box, and labeled Plan 03 upload/resubmit slots
- `mobile/App.tsx` — `useFirebaseAuth()` called at root before navigation renders; returns `<RootNavigator />`
- `mobile/.env.example` — documents all 7 `EXPO_PUBLIC_*` keys
- `npx tsc --noEmit` → 0 errors

## Task Commits (in mobile repo)

1. **Task 1: Install deps + Firebase init + auth store + hook** — `8fbec7c` (feat)
2. **Task 2: Navigation gate + auth screens + App.tsx** — `b5c6127` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `getReactNativePersistence` not exported from `firebase/auth` types**
- **Found during:** Task 1 TypeScript typecheck
- **Issue:** `firebase/auth`'s exports map in the `firebase` package has no `react-native` condition, so TypeScript resolves to `./auth/dist/auth/index.d.ts` which does not export `getReactNativePersistence`. The function exists at runtime but TypeScript errors with TS2305.
- **Fix:** Changed import to `@firebase/auth` (not `firebase/auth`), and added a `paths` entry to `tsconfig.json` mapping `@firebase/auth` to `./node_modules/@firebase/auth/dist/rn/index.rn.d.ts` (the react-native type definition that exports `getReactNativePersistence`). At runtime, Metro's react-native bundling resolves the correct RN implementation automatically.
- **Files modified:** `mobile/src/config/firebase.ts`, `mobile/tsconfig.json`
- **Commit:** `8fbec7c`

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| Placeholder Home screen `<Text>Verified — home</Text>` | `mobile/src/navigation/AppNavigator.tsx` | ~16 | Intentional — Profile/app screens added by Plan 05 |
| `<Text style={styles.resubmitPlaceholder}>Resubmit — coming in Plan 03</Text>` | `mobile/src/screens/Auth/PendingVerificationScreen.tsx` | ~73 | Intentional — upload/resubmit UI built in Plan 03; slot is clearly labeled |

These stubs do not prevent the plan's goal (sign-up → pending gate → no escape route). Plan 03 fills the upload slot; Plan 05 fills AppNavigator.

## Threat Model Coverage

| Threat ID | Status |
|-----------|--------|
| T-02-01 Elevation (navigation gate bypass) | Client gate implemented; authoritative enforcement is backend `requireVerified` from Plan 01 |
| T-02-02 Information Disclosure (EXPO_PUBLIC keys) | Keys are public by design; documented in `.env.example` |
| T-02-03 Spoofing (fake approval push) | Notification tap only triggers token refresh; actual state read from signed Firebase custom claim |
| T-02-04 Tampering (session persistence) | Firebase JS SDK manages token refresh/expiry via AsyncStorage |

## Checkpoint (Task 3)

**Paused at:** `checkpoint:human-verify`
**What needs verification:**
1. Backend from Plan 01 running with populated `.env`
2. `mobile/.env` has 6 `EXPO_PUBLIC_FIREBASE_*` values + `EXPO_PUBLIC_API_BASE_URL`
3. `cd mobile && npx expo start` — Sign Up → lands on pending screen
4. Cannot navigate away from pending screen (VERI-05)
5. MongoDB `users` collection has new document with `verificationStatus: 'none'`
6. Kill/reopen app → still signed in on pending screen (AsyncStorage persistence)

**Resume signal:** Type "approved" if all criteria pass, or describe what broke.

## User Setup Required

Firebase and backend must be configured before the checkpoint can be verified. See [01-01-USER-SETUP.md](./01-01-USER-SETUP.md) for backend setup; additionally:
- `mobile/.env` must have the 6 `EXPO_PUBLIC_FIREBASE_*` values from Firebase Console → Project Settings → General → Your apps → Web app config
- `EXPO_PUBLIC_API_BASE_URL` must be reachable from the test device/emulator

## Self-Check: PASSED

> Section completed by orchestrator — executor was terminated by session limit mid-write. Verified post-hoc: all 11 created files exist on disk, both task commits (`8fbec7c`, `b5c6127`) present in mobile repo, `npx tsc --noEmit` exits 0, mobile working tree clean.

**Checkpoint disposition:** Task 3 (`checkpoint:human-verify`) deferred to end-of-phase UAT per `workflow.human_verify_mode: "end-of-phase"`. Verification criteria from the Checkpoint section above will be included in phase-level UAT via `/gsd-verify-work 1`.
