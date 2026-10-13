# Phase 1: Trust Foundation - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Authentication gate, document verification flow, admin moderation panel, and user profiles. A new user can sign up, upload ID + selfie, wait for manual admin approval, and — once approved — access a full profile. Unverified users are hard-gated to signup/pending screens only. Nothing else in the app is reachable until verification passes.

Requirements in scope: VERI-01, VERI-02, VERI-03, VERI-04, VERI-05, VERI-06, VERI-07, PROF-01, PROF-02, PROF-03, PROF-04

</domain>

<decisions>
## Implementation Decisions

### Admin Moderation Panel

- **D-01:** Admin panel is a **separate web app** — not screens inside the mobile app. Women-user flows and admin flows are completely separate codebases.
- **D-02:** Admin web app lives at **`/admin`** — a new top-level directory in the monorepo (alongside `/backend` and `/mobile`).
- **D-03:** Admin web app built with **React + Vite**. Component-based so it can grow after MVP.
- **D-04:** Admin authentication uses **hardcoded credentials in `.env`** (`ADMIN_EMAIL` + `ADMIN_PASSWORD`). No Firebase admin accounts, no admin users in MongoDB. Backend validates credentials and issues a short-lived session token for the admin panel. This is intentional for MVP — not a bug to fix.

### Pending Verification UX

- **D-05:** After submitting ID + selfie, user lands on a **full-screen pending status screen** showing: a thumbnail of submitted photos, verification status badge ("Under review"), and estimated wait time. User cannot navigate anywhere else.
- **D-06:** User **can resubmit documents while pending** — a "Resubmit" button on the pending screen replaces the previous upload. Admin sees the latest submission only. Prevents users being stuck on bad uploads.
- **D-07:** On **rejection**: user receives push notification (VERI-04), opens app, sees pending screen updated with the **admin's rejection reason** and a "Resubmit" button. Admin must enter a reason when rejecting — this is a required field in the moderation panel.

### Verified State Propagation

- **D-08:** Verification status is stored as a **Firebase Custom Claim** (`isVerified: true`) set by the backend via Firebase Admin SDK when an admin approves a user. The mobile app reads this from the decoded token — no separate backend call needed to check verified status on every request.
- **D-09:** Token refresh that picks up the new custom claim is triggered by **tapping the approval push notification**. The notification handler forces `user.getIdToken(true)` (force-refresh), then the app re-evaluates navigation and routes to the main app. No polling, no background work.

### Claude's Discretion

- **Document/photo storage:** Not discussed — researcher should determine the best approach. Given Firebase Auth is already the platform, Firebase Storage via the backend's Firebase Admin SDK is the natural choice. Backend receives the upload, validates it, stores in Firebase Storage under a protected path (not publicly readable), saves the Storage URL in MongoDB.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria (5 items), and requirement list (VERI-01..07, PROF-01..04)
- `.planning/REQUIREMENTS.md` — Full requirement definitions for all Phase 1 requirements with acceptance detail

### Project Constraints
- `.planning/PROJECT.md` — Key Decisions table; Constraints section (Expo managed, Firebase JS SDK v11, MongoDB, Socket.io, no payments, manual verification)

No external ADRs or specs — all decisions are captured above and in PROJECT.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — all `src/screens/`, `src/components/`, `src/hooks/`, `src/store/` directories are empty in `/mobile`
- Backend `src/routes/`, `src/controllers/`, `src/services/`, `src/models/`, `src/middleware/` all empty

### Established Patterns
- Backend uses CommonJS (`require()`); mobile uses ES6 modules (`import`/`export`)
- 2-space indentation, semicolons present — both projects
- TypeScript strict mode enabled in `/mobile`
- Functional components with hooks in React Native
- `StyleSheet.create()` for styles
- Zustand chosen for state management (decided at project init, not yet installed)
- Firebase JS SDK v11 (pure JS, not @react-native-firebase) — Expo managed workflow constraint; locked

### Integration Points
- `/backend/src/server.js` — entry point; new routes attach here via `app.use('/api/...', router)`
- `/mobile/App.tsx` — root component; navigation provider and auth gate go here
- `/mobile/src/navigation/` — empty; React Navigation stack goes here
- Socket.io skeleton wired in backend (`connection`/`disconnect` only) — Phase 1 does not need Socket.io; it's there for Phase 2
- MongoDB not yet connected — `mongoose.connect()` must be added to `/backend/src/config/` before any route uses it

</code_context>

<specifics>
## Specific Ideas

- Admin must enter a rejection reason (required field) — this was an explicit decision, not a nice-to-have
- Approval flow: admin clicks Approve → backend sets Firebase Custom Claim → backend sends push notification → user taps notification → app force-refreshes token → navigates to main app. This is the exact sequence; planner should implement it in this order.
- The `/admin` React+Vite app is internal tooling for 1-2 admins — no i18n, no accessibility hardening, minimal styling. Speed of build > polish.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Trust Foundation*
*Context gathered: 2026-07-02*
