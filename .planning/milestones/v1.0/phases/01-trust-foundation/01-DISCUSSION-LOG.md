# Phase 1: Trust Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-02
**Phase:** 1-Trust Foundation
**Areas discussed:** Admin moderation panel, Pending verification UX, Verified state propagation

---

## Admin moderation panel

### Where does the admin panel live?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate web app | React or plain HTML served separately; admins use browser; scope isolated | ✓ |
| Admin screens in mobile app | Hidden admin section in mobile; mixes admin and user flows | |
| Backend-served HTML only | Express renders simple HTML; no framework | |

**User's choice:** Separate web app

---

### Where in the repo?

| Option | Description | Selected |
|--------|-------------|----------|
| /admin (new top-level dir) | Mirrors monorepo structure; independent deploy | ✓ |
| Served by /backend at /admin routes | Single deploy; couples admin UI to backend | |
| You decide | Let researcher/planner pick | |

**User's choice:** /admin top-level directory

---

### Framework?

| Option | Description | Selected |
|--------|-------------|----------|
| Plain HTML/JS + Fetch | No build step; MVP for 1-2 admins | |
| React (Vite) | Component-based; easy to extend; adds build step | ✓ |
| You decide | Pick whatever fits MVP internal tooling | |

**User's choice:** React + Vite

---

### Admin authentication?

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded credentials in .env | ADMIN_EMAIL + ADMIN_PASSWORD; no DB admin accounts; MVP simplicity | ✓ |
| Firebase admin role (custom claim) | Consistent with main auth; adds complexity | |
| You decide | Fastest and secure enough for MVP | |

**User's choice:** Hardcoded credentials in .env

---

## Pending verification UX

### What does user see while pending?

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen pending status | Thumbnail + status badge + estimated wait; user stuck here | ✓ |
| App preview (read-only) | Browse listings view-only; conflicts with VERI-05 hard-gate | |
| Minimal lock screen | Single message; no thumbnails | |

**User's choice:** Full-screen pending status with photo thumbnail

---

### Can user resubmit while pending?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — can resubmit before admin reviews | Resubmit button replaces previous upload | ✓ |
| No — locked until admin acts | Admin must reject first | |
| You decide | Pick what makes queue cleanest | |

**User's choice:** Yes — resubmit allowed while pending

---

### What happens on rejection?

| Option | Description | Selected |
|--------|-------------|----------|
| Push notification + rejection reason | Admin writes reason; shown on pending screen; Resubmit button | ✓ |
| Push notification + generic message | No custom reason; simpler for MVP | |

**User's choice:** Push notification + admin's rejection reason on pending screen
**Notes:** Admin rejection reason is a required field in the moderation panel — cannot approve/reject without entering it.

---

## Verified state propagation

### How does mobile app know user is verified?

| Option | Description | Selected |
|--------|-------------|----------|
| Firebase Custom Claims | Backend sets isVerified=true; token refresh picks it up | ✓ |
| Backend check on login/app open | App pings /api/me on every launch; MongoDB source of truth | |
| Both: Custom claim + backend fallback | Robust but over-engineered for MVP | |

**User's choice:** Firebase Custom Claims

---

### When does token refresh happen?

| Option | Description | Selected |
|--------|-------------|----------|
| On push notification tap | Approval push → user taps → force token refresh → navigate to main app | ✓ |
| Background polling | Polls while on pending screen; battery drain | |
| Only on next app open/re-login | Token refreshes naturally on cold start | |

**User's choice:** On push notification tap (force-refresh `user.getIdToken(true)`)

---

## Claude's Discretion

- **Document/photo storage:** Not discussed. Researcher should determine approach. Firebase Storage via backend Admin SDK is the natural fit (Firebase already the auth platform; backend validates + stores; URL saved in MongoDB).

## Deferred Ideas

None — discussion stayed within Phase 1 scope.
