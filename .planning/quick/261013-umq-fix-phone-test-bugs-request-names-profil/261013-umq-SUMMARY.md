---
phase: quick-261013-umq
plan: 01
subsystem: backend + mobile
tags: [socket.io, safe-area, expo-notifications, zustand, firebase-emulator]
status: complete
requirements: [QUICK-261013-umq]
key-files:
  created:
    - backend/src/services/userSummaryService.js
    - mobile/src/navigation/useSafeStackScreenOptions.ts
  modified:
    - backend/src/controllers/messageRequestController.js
    - backend/src/controllers/conversationController.js
    - backend/src/controllers/userController.js
    - backend/src/socket/chatHandler.js
    - backend/src/server.js
    - Makefile
    - .gitignore
    - mobile/src/store/conversationStore.ts
    - mobile/src/services/socketService.ts
    - mobile/src/services/push.ts
    - mobile/src/navigation/AppNavigator.tsx
    - mobile/App.tsx
commits:
  - b97c3d3 fix(backend): enrich request inbox + conversations with member names, own-profile projection on update, user socket room for message requests
  - 0062b8d fix(mobile): member names in requests/conversations, request badge + local notification, dedupe optimistic messages, refresh profile on focus
  - 010f612 fix(mobile): apply top safe-area inset centrally for edge-to-edge Android, drop status-bar padding hacks
apk: /home/kartsi/PycharmProjects/women-app/mobile/android/app/build/outputs/apk/release/app-release.apk
---

# Quick 261013-umq: Fix phone-test bugs Summary

Backend name/photo enrichment, per-user socket room with real-time message-request events, optimistic-message reconcile, central safe-area handling and a rebuilt release APK.

## What was done

**Task 1 (backend, b97c3d3)**
- `userSummaryService.getUserSummaries(uids)` batch-resolves display name + signed photo URL (explicit projection).
- `GET /api/message-requests/inbox` rows carry `senderDisplayName` / `senderPhotoUrl`; `GET /api/conversations` rows carry `otherUid` / `otherDisplayName` / `otherPhotoUrl`.
- `PUT /api/users/profile` now returns the same projection as `GET /api/users/me` (shared `buildOwnProfileData`: signed `photoURL`, no private fields).
- Sockets auto-join `user:<uid>` (uid from verified token); `createMessageRequest` emits `message_request:new` (own try/catch, `app.set('io', io)`).
- `make emulators` / `make dev` use `--import=./.firebase-emulator-data --export-on-exit` (after `mkdir -p`); the dir is gitignored.

**Task 2 (mobile, 0062b8d)**
- Inbox and conversation list show display names (fallback "A member") and photo/initial avatars; no UID rendered; DM header shows the member name.
- `conversationStore`: `mergeIncoming` replaces the oldest matching optimistic entry with the server echo (one bubble per send) for DM and city chat; `pendingRequestCount` + set/increment/refresh actions.
- Single global `message_request:new` socket listener increments the count and shows a local notification ("New message request from <name>") via new `presentLocalNotification` in `push.ts`.
- Red circular count badge (top-right of the "Requests" pill, white bold number, hidden at 0, "9+" above 9) plus red badge on the Messages tab; count refreshed on shell mount, Messages focus, inbox load, and after accept/decline.
- `ProfileScreen` refetches on every tab focus.

**Task 3 (mobile, 010f612)**
- `SafeAreaProvider` + dark `StatusBar` at root; `useSafeStackScreenOptions` (contentStyle paddingTop = top inset) used by all six native stacks (Housing, Messages, Community, Profile, Auth, Verification — hook called before the early return in VerificationNavigator).
- 13 hard-coded 48/52 top paddings reduced to 12; `MapDiscoveryScreen` uses plain `View`; `FilterSheet` uses plain `View` with bottom inset padding.
- Release APK rebuilt (no prebuild needed, no native change) with `EXPO_PUBLIC_API_BASE_URL=http://192.168.10.93:3000 EXPO_PUBLIC_USE_EMULATORS=true`; bundle confirmed to contain `message_request:new`.

## Verification
- Backend: `node --check` + require smoke on all changed files, grep gates, `make -n` shows import/export flags, `git check-ignore` OK, `/health` OK after nodemon reload.
- Mobile: `npx tsc --noEmit` clean after Task 2 and Task 3; grep gates pass.
- APK: BUILD SUCCESSFUL, fresh mtime 2026-10-13 22:13.
- On-device human check (status-bar clearance, live badge/notification, single DM bubble, profile photo) is still pending — not performed by the executor.

## Deviations from Plan
None - plan executed as written. (The `contentStyle` approach was used first; the `screenLayout` fallback was not needed/tested on-device.)

## Notes for the user
1. Previously uploaded profile photos were lost when the in-memory Storage emulator restarted — re-upload your profile photo once.
2. Persistence only activates when the emulators are restarted via `make emulators` / `make dev`; stop them with Ctrl+C so data is exported on exit.
3. Remote push is still intentionally inactive in the LAN setup (placeholder EAS projectId). The in-app path is socket + local notification while the app is open.

## Known Stubs
None.

## Threat Flags
None beyond the plan's threat model (user room, enrichment, profile projection, emulator data gitignore all implemented as mitigated).

## Self-Check: PASSED
Commits b97c3d3, 0062b8d, 010f612 exist; APK and new files present; `.planning/config.json` not staged in any commit.
