# Requirements: WomenApp

**Defined:** 2026-07-02
**Core Value:** A verified, women-only space where any woman can find safe housing and trusted community wherever she is in the world.

## v1 Requirements

### Verification & Safety

- [ ] **VERI-01**: User can create an account with email and password via Firebase Auth
- [x] **VERI-02**: User can upload an ID document photo and a selfie for gender verification
- [ ] **VERI-03**: Admin can review, approve, or reject verification requests in a moderation panel
- [x] **VERI-04**: User receives a push notification when their verification is approved or rejected
- [ ] **VERI-05**: Unverified users are hard-gated — they can only access signup and verification screens; no other feature is accessible
- [x] **VERI-06**: User can block another user (blocked user cannot message or view profile)
- [x] **VERI-07**: User can report another user or content to admins

### Profile

- [x] **PROF-01**: Verified user can create and edit a profile with display name, profile photo, bio, and home city
- [x] **PROF-02**: Verified users display a verification badge visible on their profile
- [x] **PROF-03**: Profile shows host/guest stats: number of stays hosted and trips taken
- [x] **PROF-04**: Any verified user can view another verified user's public profile

### Listings

- [x] **LIST-01**: Verified user can create a free housing listing with title, description, availability dates, location, and house rules
- [x] **LIST-02**: User can upload multiple photos per listing
- [x] **LIST-03**: Listings appear on a map with a neighbourhood pin — exact address is hidden until request is accepted
- [x] **LIST-04**: User can search and browse listings by geographic location
- [x] **LIST-05**: User can filter listing search results by availability dates

### Housing Requests

- [x] **REQT-01**: Verified user can send a stay request to a host, specifying dates and an introductory message
- [x] **REQT-02**: Host can accept or decline a stay request from their inbox
- [x] **REQT-03**: Full host address is revealed to the guest only after the host accepts the request
- [x] **REQT-04**: User receives a push notification when their stay request is accepted or declined

### Messaging

- [x] **MSG-01**: Verified user can send a direct message request to another verified user
- [x] **MSG-02**: Recipient can accept or decline a DM request — accepted conversations open a real-time chat
- [x] **MSG-03**: Accepted 1:1 conversations are real-time via Socket.io (messages delivered instantly)
- [x] **MSG-04**: Verified user can join and post in city-based group chats (one per city, Socket.io rooms)
- [x] **MSG-05**: User receives a push notification when a new message arrives in any accepted conversation or group chat

### Community Feed

- [x] **COMM-01**: Verified user can create a post with text and an optional photo
- [x] **COMM-02**: Verified user can comment on any post in the feed
- [x] **COMM-03**: Verified user can like a post

### Reviews

- [x] **REVW-01**: Guest can submit a written review for a host after a confirmed stay
- [x] **REVW-02**: Host can submit a written review for a guest after a confirmed stay
- [x] **REVW-03**: Reviews use blind release — both are visible only after both parties have submitted, or after 14 days

## v2 Requirements

### Listings (Paid)

- **LIST-V2-01**: Verified user can create a paid short-term rental listing with price per night
- **LIST-V2-02**: Search/filter includes a price range filter

### Events

- **EVNT-01**: Verified user can create a local event with title, date, location, and description
- **EVNT-02**: User can browse events by city and on a map
- **EVNT-03**: User can RSVP to an event and see attendee count

### Safety Features

- **SAFE-01**: User can set a safety check-in with a trusted contact
- **SAFE-02**: Emergency resources directory (local emergency contacts) by city
- **SAFE-03**: Trusted contact receives SMS alert if check-in is missed (requires GDPR legal review)

### Payments

- **PAY-01**: In-app payment processing for paid listings (Stripe)

### Localization

- **I18N-01**: Russian language UI option

### Platform

- **PLAT-01**: iOS build and App Store submission

## Out of Scope

| Feature | Reason |
|---------|--------|
| In-app payment processing (v1) | Validates demand before adding payment complexity; excluded from MVP |
| Automated ID verification (AI/OCR) | Manual moderation sufficient for MVP; automation adds cost and third-party dependency |
| Video posts | Storage/bandwidth cost; no validated demand |
| Algorithmic feed | Chronological feed sufficient for MVP; algorithm adds complexity |
| Anonymous posting | Conflicts with women-only verified identity premise |
| Public listing browsing without verification | Core safety promise — no unverified access to any feature |
| Events (v1) | Deferred to v2 after housing core is validated |
| iOS build (v1) | Android-first; same Expo codebase exports later |
| Web app | Mobile-only for MVP |

## Traceability

Updated 2026-07-02 — roadmap created with 3 phases (Trust Foundation, Housing Core, Community & Trust Layer).

| Requirement | Phase | Status |
|-------------|-------|--------|
| VERI-01 | Phase 1 | Pending |
| VERI-02 | Phase 1 | Complete |
| VERI-03 | Phase 1 | Pending |
| VERI-04 | Phase 1 | Complete |
| VERI-05 | Phase 1 | Pending |
| VERI-06 | Phase 1 | Complete |
| VERI-07 | Phase 1 | Complete |
| PROF-01 | Phase 1 | Complete |
| PROF-02 | Phase 1 | Complete |
| PROF-03 | Phase 1 | Complete |
| PROF-04 | Phase 1 | Complete |
| LIST-01 | Phase 2 | Complete |
| LIST-02 | Phase 2 | Complete |
| LIST-03 | Phase 2 | Complete |
| LIST-04 | Phase 2 | Complete |
| LIST-05 | Phase 2 | Complete |
| REQT-01 | Phase 2 | Complete |
| REQT-02 | Phase 2 | Complete |
| REQT-03 | Phase 2 | Complete |
| REQT-04 | Phase 2 | Complete |
| MSG-01 | Phase 2 | Complete |
| MSG-02 | Phase 2 | Complete |
| MSG-03 | Phase 2 | Complete |
| MSG-04 | Phase 2 | Complete |
| MSG-05 | Phase 2 | Complete |
| COMM-01 | Phase 3 | Complete |
| COMM-02 | Phase 3 | Complete |
| COMM-03 | Phase 3 | Complete |
| REVW-01 | Phase 3 | Complete |
| REVW-02 | Phase 3 | Complete |
| REVW-03 | Phase 3 | Complete |

**Coverage:**

- v1 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-02*
*Last updated: 2026-07-02 after roadmap creation — traceability complete*
