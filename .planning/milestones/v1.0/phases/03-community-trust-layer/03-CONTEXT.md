<!-- GSD phase context — feeds gsd-phase-researcher and gsd-planner -->

# Phase 3 Context: Community & Trust Layer

**Created:** 2026-07-09
**Phase goal (ROADMAP):** Verified women can contribute to a shared community feed and leave reviews after stays, completing the trust loop that makes housing safe for strangers.
**Requirements:** COMM-01, COMM-02, COMM-03, REVW-01, REVW-02, REVW-03
**Mode:** mvp

## Domain

Two features closing the trust loop:
1. **Community feed** — verified users create posts (text + optional single photo), comment on posts, like posts. One global feed for all verified users.
2. **Bidirectional blind-release reviews** — after a confirmed stay, host and guest each write a review of the other; reviews stay hidden until both submit or 14 days elapse, then reveal simultaneously.

## Locked Decisions

### Reviews — eligibility & timer (REVW-01/02)
- A `(guest, host, listing)` pair becomes review-eligible **after `StayRequest.checkOut`** (the checkOut date already stored on the accepted StayRequest from phase 2 / plan 02-03). An accepted StayRequest whose checkOut is in the past = a "confirmed stay".
- The 14-day blind window is anchored on **`checkOut`** (reveal deadline = `checkOut + 14 days`).
- One review per direction per stay: guest→host and host→guest are independent records. Enforce uniqueness per `(stayRequestId, direction)` (or `(reviewerUid, subjectUid, stayRequestId)`).

### Reviews — blind release mechanism (REVW-03) — SAFETY/FAIRNESS CRITICAL
- **Lazy-on-read, NO cron/scheduler.** Visibility is COMPUTED AT READ TIME, server-side. A review of a stay is revealed when: **(both directions submitted) OR (now ≥ checkOut + 14 days)**.
- Before reveal: a reviewer may see ONLY their own submitted review; the counterpart's review MUST NOT be returned by the API (server-side gate, explicit projection — same discipline as phase-2 address hiding). The client is never the gate.
- Reveal is simultaneous by construction: the same read-time predicate governs both directions, so neither is exposed before the other.
- Rationale: MVP has no scheduled-task infrastructure (noted in STATE Blockers). Lazy-on-read needs none and cannot leak early.

### Reviews — form & aggregation (REVW-01/02)
- Rating **1–5 stars + free text**.
- **Immutable after submit** (protects blind-release honesty — no editing once the counterpart may have seen it post-reveal).
- After reveal, reviews aggregate onto the subject's **User profile**: average rating + review count + list of revealed reviews. Aggregation counts REVEALED reviews only.

### Community feed (COMM-01/02/03)
- **One global feed** for all verified users (not city-scoped), **reverse-chronological**, **paginated** (cursor by createdAt/_id).
- Post = text (required) + **optional single photo** (reuse Firebase Storage upload pipeline from listings/profile/document upload).
- **Comment** on any post; **like** any post (idempotent — a user likes a post at most once).
- **Moderation via Report (01-07):** posts and comments are reportable, reusing the existing Report model/flow. **Deletion:** by the author, and by admin (admin panel).
- All feed reads/writes gated by `verifyFirebaseToken + requireVerified`.

## Claude's Discretion (implementation defaults — planner may refine)
- **Comments in a SEPARATE collection** referencing `postId` (not embedded) — consistent with the project's "separate collection" decision for messages (16MB doc-limit lesson); avoids unbounded post growth on popular posts.
- **Likes** stored idempotently (e.g. `$addToSet` on a `likedBy` array for MVP scale, or a Like collection if the planner prefers) + a denormalised `likeCount`.
- **Feed/comments/likes are REST**, not socket real-time, for MVP (pull-to-refresh + pagination). Real-time feed is a later concern.
- **Report reuse:** extend the Report model with a target discriminator (e.g. `targetType: 'user' | 'post' | 'comment'` + `targetId`) rather than a new model.
- **Push (optional, minimal):** notify a post author when their post gets a comment, reusing expo-server-sdk. No push on likes.
- Review write endpoint rejects if `now < checkOut` (stay not finished) or if a review for that `(stayRequestId, direction)` already exists.

## Canonical Refs
- `.planning/ROADMAP.md` — Phase 3 goal + success criteria (authoritative scope)
- `.planning/REQUIREMENTS.md` — COMM-01..03, REVW-01..03 definitions
- `.planning/phases/02-housing-core/02-03-SUMMARY.md` — StayRequest model + checkOut field + accepted status (review eligibility source)
- `.planning/phases/01-trust-foundation/01-07` commits — Report model + block/report flow (feed moderation reuse)
- `.claude/CLAUDE.md`, `CLAUDE.md` — project conventions, monorepo, security rules

## Code Context (reusable assets from phases 1–2)
- **StayRequest** (`backend/src/models/StayRequest.js`) — guestUid/hostUid/listingId/checkIn/**checkOut**/status; accepted + past checkOut = confirmed stay (review trigger).
- **Report** (`backend/src/models/Report.js`, plan 01-07) — extend with target discriminator for post/comment moderation.
- **Firebase Storage upload pipeline** (listing photos 02-02, profile photo 01-05, document upload 01-03) — reuse for post photo (multer + firebase-admin storage).
- **User** (`backend/src/models/User.js`) — profile is the aggregation target for revealed reviews (avg rating + count).
- **verifyFirebaseToken + requireVerified** middleware — gate all feed/review routes.
- **expo-server-sdk** push service — optional comment notifications.
- Mobile patterns: Zustand stores, `mobile/src/services/api.ts` client, React Navigation stacks, existing UI tokens/components (SafetyChip-style chips, cards) from phase-2 UI-SPEC.

## Deferred Ideas (NOT this phase)
- Real-time live-updating feed (socket) — later.
- Post search / hashtags / filtering — new capability, own phase.
- Meetups / events — separate roadmap item.
- Rich media (multiple photos, video) in posts — MVP is single optional photo.
- Push notifications at the exact 14-day reveal moment — requires scheduler infra; lazy-on-read reveals on next read instead.

## Open Questions for Research
- Exact reveal predicate implementation shape (aggregation projection vs per-review computed field) — planner/researcher to choose the cleanest server-side gate.
- Report model extension vs. polymorphic target — confirm the least-disruptive change to the existing 01-07 schema.
- Pagination style for feed (cursor vs skip/limit) at MVP scale.
