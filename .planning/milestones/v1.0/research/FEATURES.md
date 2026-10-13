# Feature Landscape

**Domain:** Women-only safety/travel/housing platform
**Researched:** 2026-07-02
**Confidence:** MEDIUM — no live web search available; analysis based on deep knowledge of Couchsurfing, Airbnb, HER app, BeWelcome, bSafe, Bumble BFF, Girls Love Travel community, and women-safety app patterns. Comparable platforms are well-documented in training data through mid-2025.

---

## Comparable Platforms Referenced

| Platform | What it teaches |
|----------|-----------------|
| Couchsurfing | Couch request flow, bidirectional references, city groups, trust levels, host/surfer profiles |
| Airbnb | Listing creation with photos/calendar, map search, timed review release, Superhost trust signal |
| HER app | Women-only gate, community feed + events, profile with verification badge, content moderation |
| BeWelcome | Free hospitality exchange, hosting offer structure, reference system, forum communities |
| bSafe / Noonlight | Safety check-in with escalation, trusted contacts, SOS trigger, emergency resources |
| Girls Love Travel (FB group) | Housing-request post format, member vetting by admins, pinned safety resources, meetup posts |
| Bumble BFF | Interest-based profile, message request model (consent before DM), community groups |

---

## Table Stakes

Features users expect. Missing one = platform feels unfinished or unsafe. Users leave or never trust it.

### Identity & Verification

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Document upload (ID photo) | Core promise — women-only is meaningless without a gate | Medium | Upload image, backend stores in secure bucket, admin reviews manually |
| Verification pending state | Users need feedback after upload; ambiguity kills drop-off | Low | Show status: Pending / Under Review / Verified / Rejected with reason |
| Verified badge on profile | Every comparable (HER, Airbnb Superhost, Couchsurfing) displays trust signal | Low | Simple badge tied to `isVerified` flag |
| Admin moderation queue | Manual review is explicitly planned for MVP | Medium | Backend admin panel: list pending docs, approve/reject with reason |
| Account locked until verified | Without hard gate, the women-only promise fails immediately | Low | Middleware check on protected routes |

### User Profile

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Profile photo (face required) | Couchsurfing, Airbnb, HER — anonymity destroys trust in safety context | Low | Single mandatory photo |
| Name, bio, home city | Every social + housing platform — without this, no one responds to messages or accepts requests | Low | Basic fields |
| Languages spoken | Critical for global platform — helps users identify compatible hosts/guests | Low | Multi-select from list |
| Join date visible | Trust signal — "member since" is standard on Couchsurfing, Airbnb | Low | Display on profile |
| Profile completeness indicator | Drives higher-quality profiles; incomplete profiles get fewer responses | Low | % complete, prompt to fill remaining fields |
| Interests / travel style tags | Matching context; HER and Couchsurfing both use this | Low | Select from preset list (solo traveler, digital nomad, etc.) |

### Housing Listings

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Create listing with photos | Any housing platform — no photos = no requests | Medium | Multi-photo upload (min 1, recommend 3+), stored in object storage |
| Listing type: free (couch-surfing) vs paid (short-term rental) | The dual model is the core product; missing one breaks the value prop | Low | Toggle + price/night field for paid |
| Description, house rules, max guests | Airbnb/Couchsurfing standard — guests need this to self-qualify | Low | Text fields |
| Location (city + neighbourhood, not exact address) | Required for search; exact address revealed only after request accepted | Low | Google Places autocomplete for city/neighbourhood |
| Availability dates | Without this, every listing looks available and inquiry quality is low | Medium | Date range picker; store as array of unavailable ranges |
| Listing detail page | Full listing + host profile + reviews + contact button | Low | Aggregated view |
| Host profile linked from listing | Couchsurfing, Airbnb — users vet the host before requesting | Low | Profile card with reviews count, join date, verification badge |
| Edit / deactivate listing | Hosts need to pause listings (travel, full house) | Low | Toggle active/inactive + edit flow |

### Housing Request Flow

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Send housing request (message with dates) | Core workflow — Couchsurfing couch-request model; without it there's no housing coordination | Medium | Request includes date range, guest count, message; creates a conversation thread |
| Accept / decline request | Host needs to respond; silence is not an answer | Low | Button in conversation, updates request status |
| Request status tracking | Guest needs to know: pending / accepted / declined | Low | Status field on request record |
| Pre-message template prompts | Reduces friction for both sides; guides guests to include relevant info | Low | "Introduce yourself, why you're traveling, dates" starter |

### Direct Messaging

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 1:1 real-time messaging | Every comparable platform — housing coordination cannot happen via feed | High | Socket.io already scaffolded; needs message persistence in MongoDB |
| Read receipts | Standard on all mobile messaging — without it, senders don't know if ignored | Low | `readAt` timestamp field |
| Photo sharing in chat | Coordination often requires sharing location photo, ID confirmation, etc. | Medium | Image upload in message thread |
| Push notifications for new messages | Without this, response latency kills the product | Medium | Firebase Cloud Messaging (FCM) via Expo |
| Message request model | Following Bumble BFF / Instagram — user must accept before DM thread opens (for non-connected users) | Medium | Prevents unsolicited contact; key for safety |
| Block user from conversation | Table stakes on every social platform | Low | Block from conversation or profile; hides both sides from each other |

### Community Feed

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Post creation (text + optional photo) | Women travel groups on Facebook — 90% of daily engagement comes from posts like "Anyone in Tbilisi?" | Medium | Text post + optional single image |
| Comments on posts | Expected on any feed | Low | Threaded comments, 2 levels max for MVP |
| Likes / reactions | Engagement signal; lets users acknowledge without commenting | Low | Simple like count |
| Post categories / tags | Girls Love Travel uses this: Housing Request, Travel Tips, Meetup, Advice, Story | Low | Select tag on post creation; filter feed by tag |
| Feed pagination / infinite scroll | Performance — without it, slow load drives abandonment | Medium | Cursor-based pagination from MongoDB |
| Report post | Moderation is table stakes — abuse without reporting = platform dies | Low | Report reason selector → moderation queue |

### City Group Chats

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Join city group chat | The core community feature for travelers "who else is in X city?" | High | Socket.io rooms by city; join by setting current location or selecting city |
| City-based room discovery | Users need to find relevant cities | Low | List of cities with member count; search |
| Group message history | Arriving users need context from last 24-48h; otherwise groups feel dead | Medium | Store last N messages in MongoDB, load on join |
| @mention | Standard real-time chat feature; HER app and Slack both use it | Low | Parse @username in message, trigger notification to mentioned user |
| Leave / change city group | Travelers move cities; need to switch rooms | Low | Leave current, join new |

### Search & Discovery

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Search listings by city | The fundamental action — "find housing in Barcelona" | Low | Text search on location field, indexed |
| Date range filter | Without this, every listing shows up regardless of availability | Medium | Filter by availability overlap |
| Free vs paid filter | Distinct use cases; a budget traveler and someone looking for a rental need different results | Low | Toggle |
| Map view with listing pins | Airbnb standard — spatial context is critical for housing decisions | High | Google Maps SDK with clustering; tap pin → listing card |
| Listing card in results | Photo, type, price (if paid), neighbourhood, rating, host badge | Low | Standard list card |
| Sort options: newest / rating | Gives users control over discovery | Low | Sort param on query |

### Ratings & Reviews

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Post-stay review (guest → host) | Airbnb/Couchsurfing — the trust backbone; without reviews, no one takes strangers in | Medium | Triggered after stay end date + 24h grace period |
| Post-stay review (host → guest) | Bidirectional is required — hosts need intel on guests too | Medium | Same trigger; both sides write independently |
| Star rating (1–5) + text | Standard review format | Low | Rating + mandatory min-length text |
| Reviews visible on profile | Aggregated stars + list of reviews; prominent placement | Low | Profile section |
| Timed release (both sides must review or timer expires) | Airbnb model: prevents revenge reviews by releasing both simultaneously | Medium | Release both reviews 14 days after stay or after both submitted |
| Respond to review | Hosts/guests can respond publicly — context for future users | Low | Single reply per review |
| Flag/report review | Abuse prevention | Low | Report to moderation queue |

### Safety Features (Core)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Block user | Absolute table stakes on any social platform | Low | Mutual blocking; blocked user cannot see profile or message |
| Report user (multiple categories) | Harassment, fake profile, inappropriate content, impersonation | Low | Category selector + optional description → moderation queue |
| Report listing | Fraudulent, misleading, unsafe | Low | Same flow as report user |
| Profile flag in admin queue | When a user is reported N times, surface to admin for review | Low | Threshold-based auto-flag |

### Push Notifications

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| New message notification | Core — without it, no one responds | Medium | FCM via Expo Notifications |
| Housing request received | Host needs immediate alert | Medium | Triggered on request creation |
| Request accepted/declined | Guest needs to know | Low | Status change triggers notification |
| New event in city | Discovery driver | Low | Optional, user can disable |
| Mention in group chat | @mention notification | Low | Parse mention, push to mentioned user |

---

## Differentiators

Features that set this platform apart from generic alternatives. Not expected by users arriving from Couchsurfing/Airbnb, but high perceived value for women.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Women-only gate (hard enforcement) | Core identity — HER app has this but not for housing/travel; no housing platform has it | Medium | Admin review of ID enforces gender; this is the #1 differentiator |
| Emergency housing listing type | Explicit "woman in need" flag on listing; distinct from regular couch-surfing | Low | Boolean field on listing + distinct visual treatment in search results |
| Safety check-in during stay | Periodic in-app ping: "Are you safe? Reply YES or get help." With escalation to trusted contact | High | Scheduled notifications + response tracking; if no reply in N hours, contact trusted person |
| Trusted contact for stays | Designate someone (outside the app) to be notified if check-in fails | Medium | Store contact name/phone; app sends SMS via Twilio if escalation triggers |
| Safety-specific review criteria | Host made you feel safe (Y/N)? Guest respected house rules and your boundaries (Y/N)? | Low | Extra fields on review form; aggregated as safety score on profile |
| Local emergency resources directory | In-app page: local shelter hotlines, police number, embassies by country | Low | Static content + country detection; no API needed for MVP |
| "Available now" listing flag | Host marks available for immediate stay (urgent housing) | Low | Boolean field; filter in search; prominent badge in results |
| Multilingual UI (EN + RU) | Serves Russian-speaking women travelers who are underserved by English-only platforms | High | i18n infrastructure (i18next for React Native); all strings externalized from day 1 |
| Mutual connection indicator | Shows if a listing host has been stayed with by someone in your network | Medium | Social graph query; shows "3 of your contacts stayed with her" |
| Community safety alerts by city | Admin or trusted members can pin "Safety notice: avoid area X in [city]" to city group | Medium | Pinned message type in group chat; admin or moderator role can post |

---

## Anti-Features

Features to explicitly NOT build in MVP. Each one has a sound reason and a recommended alternative.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| In-app payment processing | Stripe integration + PCI compliance + escrow + dispute resolution = 3-4 week feature alone; too much risk for unvalidated demand | Let users coordinate payment directly (cash, bank transfer, PayPal); document this clearly on listing |
| Automated ID verification (OCR/API providers) | Persona, Onfido, Jumio cost $1–3 per verification; at early scale manual review is free and more thorough | Manual admin review queue; automate in Phase 2 once volume justifies cost |
| Video posts / Stories | High bandwidth costs, complex transcoding, heavy moderation burden | Photo posts only in MVP |
| Group video calls | Complex WebRTC or Twilio/Agora integration; niche use case in MVP | Real-time group chat via Socket.io suffices |
| Algorithmic feed / ML recommendations | Requires training data that doesn't exist yet; chronological feed is more predictable and trustworthy early on | Reverse-chronological feed with category filter |
| Anonymous posting | Contradicts the verified-identity safety model; any anonymous channel becomes an attack surface | All posts require verified account; no guest browsing of feed |
| Public listing browsing (unverified) | Allowing unverified users to browse listings (even read-only) reveals member location data without consent | Hard gate: verification required before any listing is visible |
| Loyalty / points / rewards system | Premature optimization; no retention data yet | Track "stays completed" counter on profile as social proof instead |
| Native booking calendar with iCal sync | Complex bi-directional sync with external calendars; high edge-case surface area | Simple date range availability on listing; host manually updates |
| AI/ML safety moderation | Moderation LLMs are expensive and have high false-positive rates on nuanced content; could ban legitimate users | Human moderation queue with report thresholds for MVP |
| iOS build | PROJECT.md explicitly defers this | Focus on Android via Expo; same codebase exports to iOS when ready |
| Social login (Google/Facebook OAuth only) | Social login bypasses the ID verification step if not carefully gated | Firebase Auth with email/password; require ID verification as a separate mandatory step after account creation |

---

## Feature Dependencies

The dependency tree below determines build order. No feature can be safely built before its dependencies.

```
[1] Identity Verification (admin gate)
    └── [2] User Profile (complete + displayable)
            ├── [3] Housing Listings (host must be verified + profiled)
            │       └── [4] Housing Request Flow
            │               └── [5] 1:1 Messaging (request creates thread)
            │                       └── [6] Reviews (triggered after stay date)
            ├── [5] 1:1 Messaging (general connection)
            ├── [7] Community Feed (author must be verified)
            ├── [8] City Group Chats (city set on profile)
            │       └── [9] Events (tied to city context)
            └── [10] Search & Discovery (searches verified listings)

[Cross-cutting]
Location Services → Map View, City Groups, Events
Push Notifications → Messaging, Requests, Events, Check-in
Block/Report → All social interactions
```

### Critical Path for MVP

The minimum viable trust loop is: Verification → Profile → Listing → Request → Messaging → Review.
Build this end-to-end before any community features. Without it, no one can actually find housing, and the core value is unproven.

---

## MVP Recommendation

**Phase 1 — Trust Foundation (non-negotiable first)**
1. Firebase Auth (email/password) + document upload + admin moderation queue
2. User profile (photo, bio, city, languages, verification badge)
3. Block / Report (safety baseline before any social interaction)

**Phase 2 — Housing Core**
4. Create / edit / deactivate listing (free + paid type, photos, availability, location)
5. Location search + map view + date filter
6. Housing request flow (send request → accept/decline → conversation thread)
7. 1:1 messaging via Socket.io (text + photo)
8. Push notifications (FCM via Expo)

**Phase 3 — Trust Layer**
9. Post-stay review system (bidirectional, timed release)
10. Safety check-in (scheduled ping during stay + trusted contact escalation)
11. Local emergency resources directory (static content, country-detected)

**Phase 4 — Community**
12. Community feed (post + comment + like + category tag)
13. City group chats (Socket.io rooms, message history)
14. Events (create, discover by city, RSVP)

**Defer to Post-MVP**
- Mutual connection indicator (requires social graph)
- Community safety alerts pinning (requires moderator role system)
- Multilingual UI (i18n infrastructure on day 1, RU translations in Phase 2)
- Automated ID verification (Persona/Onfido API)
- In-app payments (commission model)
- iOS build

---

## Safety-Specific Features Expanded

Safety is not a feature category — it is a design layer that runs through every feature. The following are the safety-specific mechanisms separate from generic moderation.

| Safety Mechanism | Layer | Priority | Implementation Note |
|-----------------|-------|----------|---------------------|
| Women-only gate (ID verification) | Identity | P0 | Hard block on all routes until `isVerified: true` |
| Message request model | Messaging | P1 | DM requires acceptance; prevents unsolicited contact |
| Exact address hidden until request accepted | Listings | P1 | Store full address server-side; return only neighbourhood publicly |
| Bidirectional reviews with timed release | Trust | P1 | Prevents retaliatory review suppression |
| Safety-specific review criteria | Trust | P2 | "Did this person make you feel safe?" — adds gender-context safety signal |
| Safety check-in with trusted contact | Stays | P2 | In-app ping during stay; escalation to external contact via SMS if no reply |
| Emergency housing listing type | Discovery | P2 | Women in crisis can filter for hosts explicitly offering emergency shelter |
| Local emergency resources | Resources | P2 | Static directory by country — zero ongoing cost, high perceived safety value |
| Community safety alerts (pinned, admin-only) | Community | P3 | Moderator-pinned warnings in city group chats |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Table stakes features | HIGH | These are well-established patterns across Couchsurfing, Airbnb, HER, Bumble — no live search needed to confirm |
| Differentiators | MEDIUM | Based on gap analysis of existing platforms; no live user research to confirm demand weighting |
| Anti-features | HIGH | Based on scope constraints in PROJECT.md + known complexity of deferred features |
| Feature dependencies | HIGH | Logical dependencies, confirmed by PROJECT.md architecture decisions |
| Safety-specific features | MEDIUM | bSafe/Noonlight patterns are well-documented; demand for these in a housing context is inferred, not surveyed |

---

## Gaps to Address in Later Phases

1. **User research on safety check-in**: Does the target audience (travelers vs women in need) want scheduled pings, or does it feel paternalistic? Validate in Phase 3 before building.
2. **Emergency housing demand**: Is "emergency shelter" a distinct use case or does it overlap with regular couch-surfing? Needs real user feedback after Phase 2 launch.
3. **Review gaming**: Timed-release mitigates revenge reviews, but coordinated positive-review farming is a risk at scale. No mitigation in MVP; flag for Phase 3.
4. **City group chat moderation at scale**: When a city group reaches 500+ members, real-time moderation becomes expensive. Needs a moderator-role system pre-launch in popular cities.
5. **Trusted contact SMS escalation**: Requires Twilio or similar; adds per-SMS cost and legal complexity (GDPR: is SMS to a non-user lawful?). Validate legal path before building.
