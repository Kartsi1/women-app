# Walking Skeleton — WomenApp

**Phase:** 1 (Trust Foundation)
**Generated:** 2026-07-05

## Capability Proven End-to-End

A new woman can sign up with email + password (Firebase Auth), the backend mirrors her into MongoDB, she uploads an ID document + selfie routed through the backend into Firebase Storage, an admin approves her in a separate React+Vite web panel, and on tapping the approval push notification the mobile app force-refreshes her token, reads the `isVerified` custom claim, and unlocks the main app. This single flow exercises all three sub-projects (`/mobile`, `/backend`, `/admin`) and every external system (Firebase Auth, Firebase Storage, MongoDB, Expo Push).

The thinnest slice that proves the stack (delivered by Plan 01 + Plan 02): sign up → backend creates MongoDB user → mobile lands on the full-screen pending-verification gate. Everything after that (upload, admin, approval, profile, safety) layers onto this backbone without changing its architectural decisions.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Mobile framework | Expo SDK 57 managed workflow, React Native 0.86, TypeScript strict | Locked project constraint — no bare ejection for MVP |
| Auth | Firebase Auth (email/password), Firebase JS SDK v12 on device | Locked constraint; `firebase@12+` required by Expo SDK 57; `@react-native-firebase` forbidden (needs bare workflow) |
| Auth persistence | `initializeAuth` + `getReactNativePersistence(AsyncStorage)` | `getAuth()` uses in-memory persistence on RN — session lost on restart (RESEARCH Pitfall 4) |
| Verified-state propagation | Firebase Custom Claim `isVerified:true` set by backend Admin SDK; mobile reads from decoded ID token | D-08; avoids a per-request backend call to check verification |
| Token refresh trigger | Notification tap → `getIdToken(true)` force-refresh | D-09; no polling, no background work |
| Backend | Express 4 + Mongoose 8 (MongoDB) + Firebase Admin SDK 14 | Existing scaffold; MongoDB locked; Admin SDK verifies tokens + sets claims + streams Storage uploads |
| Document storage | Backend receives multipart (`multer` memoryStorage) → streams to Firebase Storage protected path; Storage URL in MongoDB | Claude's discretion in CONTEXT; keeps Storage credentials off device; docs never publicly readable |
| Admin panel | Separate React + Vite SPA at `/admin` top-level dir; plain `fetch`, no CSS framework | D-01/D-02/D-03; internal tooling for 1–2 admins, speed over polish |
| Admin auth | Hardcoded `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env` → backend issues 8h session JWT | D-04; full user/role system is over-engineering for MVP internal tooling |
| Push notifications | `expo-notifications` (device) + `expo-server-sdk` (backend); EAS dev build required for Android | RESEARCH Pitfall 1 — Expo Go cannot deliver Android push from SDK 53+ |
| Mobile state | Zustand 5 (`authStore`, `profileStore`) | Chosen at project init; lightweight for MVP |
| Navigation | `@react-navigation/native` + `native-stack`; conditional stack gated on auth+claim | RESEARCH Pattern 2 / auth-flow idiom — no custom route guards |
| Directory layout | Monorepo: `/backend` (MVC), `/mobile` (feature folders under `src/`), `/admin` (Vite SPA). `/mobile` is its own git repo — commit mobile changes from `mobile/` | Existing repo structure; documented in CLAUDE.md |

## Stack Touched in Phase 1

- [x] Project scaffold — backend config wiring, mobile deps via `npx expo install`, `/admin` via `npm create vite`
- [x] Routing — Express routers (`/api/auth`, `/api/users`, `/api/admin`); React Navigation conditional stack
- [x] Database — real read AND write: MongoDB `users` collection created on register, read on profile/queue, updated on verification
- [x] UI — interactive: sign-up form → Firebase Auth → backend; document upload; admin approve/reject
- [x] Deployment — documented local full-stack run: `backend` (`npm run dev`) + `mobile` (`npx expo start` / EAS dev build) + `admin` (`npm run dev`)

## Out of Scope (Deferred to Later Slices)

- Listings, map search, stay requests (Phase 2)
- 1:1 and group chat / Socket.io usage (Phase 2 — skeleton exists but unused in Phase 1)
- Community feed, posts, comments, likes (Phase 3)
- Bidirectional reviews / blind release (Phase 3)
- Automated ID/OCR verification (permanently out of scope — manual moderation only)
- Payments, events, iOS build, i18n (v2)
- Real host/trip counters — `hostsCount`/`tripsCount` are stub fields, always 0 in Phase 1 (PROF-03)

## Subsequent Slice Plan

- Phase 2 (Housing Core): verified user creates a listing, discovers it on a map, requests a stay, is accepted, exchanges real-time messages — builds on the User model, auth middleware, and push pipeline from Phase 1
- Phase 3 (Community & Trust): community feed posts/comments/likes and bidirectional blind-release reviews — builds on the verified-user identity and profile layer from Phase 1
