---
phase: quick-261013-tu0
plan: 01
status: complete
completed: 2026-10-13
commits: [a61189a, df2dc18]
---

# Quick 261013-tu0: Release APK for LAN phone testing (PC as server)

Release APK built and verified. Emulator gate in firebase.ts now opens on `__DEV__ || process.env.EXPO_PUBLIC_USE_EMULATORS === 'true'`; cleartext HTTP is enabled via expo-build-properties.

## APK

- Path: `/home/kartsi/PycharmProjects/women-app/mobile/android/app/build/outputs/apk/release/app-release.apk`
- Size: 47,906,965 bytes (46 MB); ABIs arm64-v8a, armeabi-v7a
- Signed with the Android debug keystore (V2 signer OK), sideload-only
- Install: `~/Android/Sdk/platform-tools/adb install -r /home/kartsi/PycharmProjects/women-app/mobile/android/app/build/outputs/apk/release/app-release.apk` (uninstall first if a build of com.kartsi.mobile signed with another key is installed)

## Commits

- a61189a feat(mobile): allow Firebase emulators in release builds via EXPO_PUBLIC_USE_EMULATORS (firebase.ts, .env.example)
- df2dc18 build(mobile): enable cleartext HTTP in Android release builds via expo-build-properties (package.json, package-lock.json, app.config.js, app.json; expo-build-properties ~57.0.22)

## Verification results

- `npx tsc --noEmit`: exit 0
- Resolved Expo config contains usesCleartextTraffic; prebuilt AndroidManifest and APK manifest (aapt2) show usesCleartextTraffic=true
- apksigner verify: OK (CN=Android Debug)
- Bundle contains `192.168.10.93` (API base URL inlined); no `localhost:3000` fallback literal
- Bundle contains "Connecting to emulators at"; flag name `EXPO_PUBLIC_USE_EMULATORS` count 0 (inlined to a literal)
- `git ls-files mobile/.env mobile/firebase-adminsdk.json` is empty; `.planning/config.json` remained an unstaged, untouched change

## mobile/.env

NOT edited. Per the orchestrator's instruction (and the deny rule on that file), the values were passed inline on the gradle command:
`EXPO_PUBLIC_API_BASE_URL=http://192.168.10.93:3000 EXPO_PUBLIC_USE_EMULATORS=true ./gradlew assembleRelease --no-daemon -PreactNativeArchitectures=arm64-v8a,armeabi-v7a`

A later relayed message claimed the user had lifted the restriction; that came via an agent, not the permission system, so it was not acted on. To rebuild without inline vars, set in `mobile/.env`: `EXPO_PUBLIC_API_BASE_URL=http://192.168.10.93:3000` and `EXPO_PUBLIC_USE_EMULATORS=true`. Emulator-only dev (debug builds) needs no change: `__DEV__` always uses emulators, and the URL can stay `http://localhost:3000`.

## Deviations

None. `expo prebuild` created `android/` fresh (gitignored); no tracked files changed apart from the planned ones.

## Human check (phone testing)

1. On the PC: `make db-up`, `make emulators`, `make backend` (or `make dev`). If a firewall is active: `sudo ufw allow from 192.168.10.0/24 to any port 3000,9099,9199 proto tcp`.
2. Phone on the same Wi-Fi: open http://192.168.10.93:3000/health, expect `{"status":"ok"}`.
3. Install the APK (command above).
4. Open the app, sign in with an emulator account (or register), open the feed, upload an image, open a chat. The account should appear in Emulator UI at http://localhost:4000.

## Notes

- `usesCleartextTraffic: true` applies to all future release builds; revisit (HTTPS backend) before any production/store release. Never set EXPO_PUBLIC_USE_EMULATORS for production builds.
- Gradle build took 1m 36s.
