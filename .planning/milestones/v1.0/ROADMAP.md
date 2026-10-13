# Roadmap: WomenApp

## Overview

WomenApp ships in three phases that mirror the trust chain at the heart of the product. Phase 1 builds the verification gate and user identity layer — nothing else is possible without it. Phase 2 delivers the full housing loop end-to-end: create a listing, discover it on a map, request a stay, get accepted, and exchange real-time messages. Phase 3 closes the trust loop with bidirectional reviews after stays and adds the community feed that drives retention. Each phase is independently shippable and observable.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Trust Foundation** - Signup, document verification, admin moderation panel, and user profiles (completed 2026-07-05)
- [x] **Phase 2: Housing Core** - Listings, map search, stay requests, 1:1 messaging, and city group chats (completed 2026-07-09)
- [x] **Phase 3: Community & Trust Layer** - Community feed, post interactions, and bidirectional blind-release reviews (completed 2026-07-10)

## Phase Details

### Phase 1: Trust Foundation

**Goal**: Any woman can sign up, submit verification documents, and be admitted into the platform by an admin; verified users have a complete profile and safety controls.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: VERI-01, VERI-02, VERI-03, VERI-04, VERI-05, VERI-06, VERI-07, PROF-01, PROF-02, PROF-03, PROF-04
**Success Criteria** (what must be TRUE):

  1. A new user can sign up with email and password, upload an ID document photo and selfie, and submit for manual verification — and cannot access any other feature until approved
  2. An admin can log into a web moderation panel, view the queue of pending documents and selfies, and approve or reject each submission
  3. An approved user receives a push notification and, on next login, can access all app screens; a rejected user receives a rejection notification and can resubmit
  4. A verified user can create and edit a profile with display name, photo, bio, and home city; a verification badge is visible on their profile to other verified users
  5. A verified user can block another user (blocking prevents messages and profile views) or report a user or content to admins

**Plans**: 7/7 plans complete
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Backend foundation: MongoDB + Firebase Admin + User model + auth middleware + register (VERI-01, VERI-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Mobile auth shell + verification-gated navigation + pending screen (VERI-01, VERI-05)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Document upload pipeline: ID + selfie through backend to Firebase Storage (VERI-02)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-04-PLAN.md — Admin moderation: backend admin API + React+Vite panel + approve/reject + push send (VERI-03, VERI-04)
- [x] 01-05-PLAN.md — User profiles: view/edit, verification badge, stats, view others (PROF-01..04)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-06-PLAN.md — Push notifications end-to-end: EAS dev build + token registration + tap-to-unlock (VERI-04)
- [x] 01-07-PLAN.md — Safety controls: block + report (VERI-06, VERI-07)

**UI hint**: yes

### Phase 2: Housing Core

**Goal**: A verified woman can discover available housing on a map, request a stay, be accepted by a host, and exchange real-time messages in 1:1 conversations and city group chats.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: LIST-01, LIST-02, LIST-03, LIST-04, LIST-05, REQT-01, REQT-02, REQT-03, REQT-04, MSG-01, MSG-02, MSG-03, MSG-04, MSG-05
**Success Criteria** (what must be TRUE):

  1. A verified host can create a free listing with title, description, photos, availability dates, location, and house rules; the listing appears on the map as a neighbourhood pin with the exact address hidden from non-accepted guests
  2. A verified user can search and browse listings by geographic location and filter results by availability dates, with results shown on an interactive map
  3. A verified guest can send a stay request with dates and an introductory message; the host sees it in their inbox, accepts or declines, and the guest receives a push notification; upon acceptance the full host address is revealed to the guest
  4. Two verified users can send and receive real-time 1:1 direct messages after a message request is accepted; messages are delivered instantly and all message-arrival events trigger push notifications
  5. A verified user can join their city group chat and exchange real-time messages with all members of that city; new messages in any active conversation or group chat trigger push notifications

**Plans**: 5/5 plans complete

- [x] 02-01-PLAN.md
- [x] 02-02-PLAN.md
- [x] 02-03-PLAN.md
- [x] 02-04-PLAN.md
- [x] 02-05-PLAN.md

**UI hint**: yes

### Phase 3: Community & Trust Layer

**Goal**: Verified women can contribute to a shared community feed and leave reviews after stays, completing the trust loop that makes housing safe for strangers.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: COMM-01, COMM-02, COMM-03, REVW-01, REVW-02, REVW-03
**Success Criteria** (what must be TRUE):

  1. A verified user can create a post with text and an optional photo that appears in the community feed visible to all verified users
  2. A verified user can comment on any post and like any post in the community feed
  3. After a confirmed stay, both host and guest can independently submit a written review; reviews remain hidden from both parties until both have submitted or 14 days have elapsed, then become visible simultaneously (blind release)

**Plans**: 4/4 plans complete
Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Community feed create+read slice: Post model + createPost/getFeed (signed-URL photos, cursor pagination) + Community tab feed & create-post screens (COMM-01)

**Wave 2** *(blocked on 03-01)*

- [x] 03-02-PLAN.md — Post interactions: idempotent likes + chronological comments (author push) + Report enum reuse + author/admin delete + PostDetail screen (COMM-02, COMM-03)

**Wave 3** *(blocked on 03-01)*

- [x] 03-03-PLAN.md — Blind-release review backend: Review model + eligibility-gated submit + lazy-on-read reveal gate + revealed-only aggregation + held-out leak test (REVW-01, REVW-02, REVW-03)

**Wave 4** *(blocked on 03-03)*

- [x] 03-04-PLAN.md — Mobile review surfaces: star rating, compose screen, amber/green blind-release chips, profile review summary (REVW-01, REVW-02, REVW-03)

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Trust Foundation | 7/7 | Complete   | 2026-07-05 |
| 2. Housing Core | 5/5 | Complete   | 2026-07-09 |
| 3. Community & Trust Layer | 4/4 | Complete   | 2026-07-10 |
