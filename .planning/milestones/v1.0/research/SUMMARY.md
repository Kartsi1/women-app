# Project Research Summary — WomenApp

**Project:** WomenApp — Women-only Safety / Travel / Housing Platform
**Synthesized:** 2026-07-02

---

## Executive Summary

WomenApp is a verified women-only mobile platform built on an existing Expo 57 / Express / MongoDB scaffold. The core premise — that a verified identity gate unlocks safe housing coordination and community — makes the verification flow architecturally central, not peripheral. Research across analogous platforms (Couchsurfing, Airbnb, HER, bSafe, Bumble BFF) confirms that trust infrastructure must be the first thing built. No verified user base means no listings, no requests, no chats, and no reviews — the entire product collapses into the verification bottleneck.

The recommended build order is: trust foundation (Firebase Auth + ID verification + admin moderation panel) → housing core (listings, search, request flow, 1:1 messaging) → trust layer (reviews, safety check-in, emergency resources) → community (feed, city group chats, events). The dependency graph is unambiguous: every feature except block/report requires a verified user profile, every housing feature requires a verified host profile, and the review system is only meaningful after stays have happened.

The key risks cluster around three areas: the verification bottleneck killing activation before any value is delivered; gender verification bypass creating a safety incident that destroys platform trust permanently; and real-time infrastructure bugs causing silent message loss or zombie socket connections. All three are preventable with known techniques — none require experimental technology.

---

## Key Findings

### From STACK.md

**Confirmed technology choices (all HIGH confidence):**

| Technology | Version | Rationale |
|------------|---------|-----------|
| React Navigation | v7 | Matches existing `src/navigation/` scaffold; auth-gate logic cleaner than file-based Expo Router |
| Zustand | v5 | Already decided in PROJECT.md; React 19 compatible; zero boilerplate |
| React Native Paper | v5 | No native modules; Material Design 3; Expo managed workflow safe |
| Firebase JS SDK | v11 | Pure JS — no bare workflow required |
| socket.io-client | v4.7 | Must match backend's Socket.io 4.7.5 exactly |
| expo-notifications | SDK 57 | Correct managed workflow push solution; wraps FCM/APNs |
| react-native-maps | v1.x | Industry standard; PROVIDER_GOOGLE on both platforms |

**Critical version constraint:** Firebase JS SDK must use `initializeAuth` with `getReactNativePersistence(AsyncStorage)` — NOT `getAuth()`. This is the single most common React Native Firebase mistake.

**Critical early action:** Configure EAS Build before Phase 2 ends. `expo-notifications` requires an EAS project ID for `getExpoPushTokenAsync` on real devices. This is a hard dependency.

**What NOT to use:** Expo Router, @react-native-firebase, expo-maps, NativeBase, Redux Toolkit, base64 images in MongoDB, hardcoded API keys.

### From FEATURES.md

**Critical path for MVP:** Verification → Profile → Listing → Request → Messaging → Review. Build this loop end-to-end before any community features.

**Table stakes (P0):** Document upload + admin moderation queue, user profile, housing listings (free + paid), housing request flow, 1:1 real-time messaging with message request model, block and report, community feed, city group chats, search + map view, bidirectional reviews with timed release, push notifications.

**Differentiators (P1-P2):** Women-only hard gate (enforced, not advisory), emergency housing listing type, safety check-in with trusted contact escalation, safety-specific review criteria, local emergency resources directory, "available now" flag.

**Anti-features (explicitly defer):** In-app payment processing, automated ID verification APIs, video posts, algorithmic feed, anonymous posting, public listing browsing without verification, iOS build.

### From ARCHITECTURE.md

**System shape:** Mobile ↔ REST + Socket.io ↔ Express backend ↔ MongoDB Atlas, with Firebase Auth, Firebase Storage, and Google Maps as external services. Mobile never touches MongoDB directly.

**Key boundary rules:**
- Screens read from Zustand stores and dispatch store actions — never call API/socket services directly
- Services own all MongoDB queries — controllers never call Mongoose models directly
- Socket handlers call services (not models)
- Only verified users can open socket connections

**Socket.io room strategy:** `dm:{lowerUserId}:{higherUserId}` for DMs, `city:{citySlug}` for group chats, `user:{userId}` for notifications.

**ID document security:** Documents flow through backend (multipart POST), not direct client-to-Firebase upload. Admin SDK uploads to private path. Signed URLs for admin access (15-min expiry). Delete after decision (GDPR).

**Build order:** Foundation → Verification → Listings → Messaging → Community/Events (parallel) → Reviews.

### From PITFALLS.md

**Top pitfalls:**

| # | Pitfall | Consequence | Prevention |
|---|---------|-------------|------------|
| 1 | Verification bottleneck | Activation collapse | Admin panel Phase 1; 90% reviewed in 2h; staged launch |
| 2 | Gender verification bypass | Safety incident + trust collapse | Selfie + ID face-match; written moderation checklist |
| 3 | Socket.io zombie connections | Memory leak, message loss | Explicit `socket.leave()` on disconnect; Redis adapter |
| 4 | Message delivery guarantee theater | Silent message loss | DB write FIRST, socket emit AFTER |
| 5 | Firebase auth persistence loss | Log out on every restart | `initializeAuth` with `getReactNativePersistence(AsyncStorage)` |
| 6 | Firebase token 1h expiry | 401 errors for idle users | `await user.getIdToken()` before every API call |
| 7 | expo-notifications vs @react-native-firebase conflict | Build failure or double notifications | Expo Push API exclusively |
| 8 | Maps API key in source | Billing explosion | EAS Secrets + Google Cloud application restrictions |
| 9 | Places Autocomplete per-keystroke cost | $367/day at scale | 300ms debounce, 3-char minimum, caching |
| 10 | Messages embedded in Conversation doc | 16MB MongoDB limit hit in days | Separate `messages` collection mandatory from schema design |
| 11 | Wrong GeoJSON coordinate order | Silent wrong-query bug | `[longitude, latitude]` — counterintuitive but required |
| 12 | content:// URI upload failure (Android) | Silent upload failure on real devices | `expo-file-system` `uploadAsync`; test on physical device |

---

## Recommended Stack

### Mobile (`/mobile`)

| Layer | Package | Version |
|-------|---------|---------|
| Navigation | `@react-navigation/native` + native-stack + bottom-tabs | v7 |
| State | `zustand` | v5 |
| UI | `react-native-paper` | v5 |
| Auth | `firebase` + `@react-native-async-storage/async-storage` | v11 / v2 |
| Maps | `react-native-maps` | v1.x |
| Real-time | `socket.io-client` | v4.7 |
| Media | `expo-image-picker` + `expo-document-picker` + `expo-file-system` | SDK 57 |
| Push | `expo-notifications` + `expo-device` | SDK 57 |
| OAuth | `expo-auth-session` + `expo-web-browser` | SDK 57 |

### Backend (`/backend`)

| Package | Purpose |
|---------|---------|
| `firebase-admin` v12 | Token verification + Storage admin + FCM |
| `expo-server-sdk` v3 | Send push notifications via Expo Push API |
| `express-validator` | Input validation |
| `express-rate-limit` | Rate limiting |
| `express-session` + `bcryptjs` | Admin panel session auth |

---

## Feature Priorities

**Phase 1 — Trust Foundation:** Firebase Auth, ID document upload (with Android content:// URI handling), admin moderation web panel (multi-user, SLA-tracked), verification approve/reject + push notification, user profile, block/report.

**Phase 2 — Housing Core:** Listing CRUD + Firebase Storage photos, geo search + map view, housing request flow, 1:1 Socket.io messaging (store-first pattern), push notifications, message request model, EAS Build configuration.

**Phase 3 — Trust Layer:** Bidirectional blind-release reviews, safety-specific review criteria, safety check-in (validate UX with users after Phase 2 first), trusted contact escalation (validate GDPR path first), emergency resources directory.

**Phase 4 — Community:** Community feed (post + category + comment + like), city group chats (Socket.io rooms, 90-day TTL, @mention), events (create, geo-discover, RSVP).

**Defer:** i18n RU translations, mutual connection indicator, automated ID verification, in-app payments, iOS build.

---

## Architecture Decisions

1. **Firebase JS SDK v11 over @react-native-firebase** — Expo managed workflow constraint is absolute; pure JS SDK handles auth, storage, and routes push through Expo.
2. **ID documents routed through backend** — private path via Admin SDK; server-side file validation; opaque URLs.
3. **Separate `messages` collection** — 16MB MongoDB document limit is a hard wall; cannot be migrated after launch.
4. **Store-first message pattern** — `await Message.create()` before `io.to(room).emit()`. Non-negotiable in a housing safety context.
5. **GeoJSON `[longitude, latitude]` order** — required for `$near` / `2dsphere`; enforce consistently across all collections.
6. **Admin panel as desktop web page** — ID face-match review requires large screen; decoupled from App Store review cycles.
7. **Expo Push API exclusively** — no mixing with @react-native-firebase/messaging; store Expo Push Tokens (not FCM tokens).
8. **Exact host address hidden until request accepted** — neighbourhood shown publicly; full address revealed in conversation post-acceptance.

---

## Critical Pitfalls

**P0 — Platform-destroying:**
- Verification bottleneck (admin panel must be Phase 1)
- Gender verification bypass (selfie + ID face-match protocol + written checklist)
- Message delivery loss (store first, emit after)

**P1 — Rewrite-forcing:**
- Firebase auth persistence (`initializeAuth` with AsyncStorage persistence)
- Token 1h expiry (auto-refresh `getIdToken()` before every call)
- Socket.io zombie connections (explicit leave + Redis adapter)
- Embedded messages hitting 16MB limit (separate collection from day one)
- Android content:// URI upload failure (FileSystem.uploadAsync)

**P2 — Cost/security:**
- Maps API key exposed (EAS Secrets + Google restrictions + billing alert)
- Places Autocomplete cost explosion (debounce + minimum chars + cache)
- CORS wildcard in production (fix in Phase 1 before any real data is served)

---

## Implications for Roadmap

### Suggested phase structure

**Phase 1: Trust Foundation** (4-6 weeks)
Every subsequent feature is blocked on verified user accounts existing. Admin panel is as critical as the signup flow itself.
Research flag: STANDARD PATTERNS — no dedicated research phase required.

**Phase 2: Housing Core** (5-7 weeks)
Delivers the critical path (Listing → Request → Messaging) and proves core value. EAS Build must be configured here.
Research flag: RECOMMENDED — Socket.io mobile edge cases and EAS Build configuration for managed workflow have enough known pitfalls to warrant a research spike before implementation.

**Phase 3: Trust Layer** (3-4 weeks)
Reviews are the trust backbone that enables strangers to accept housing requests. Safety features are the platform's primary differentiator.
Research flag: REQUIRED (legal) — Trusted contact SMS involves GDPR for non-users. Legal opinion needed before building. Safety check-in UX needs post-Phase-2 user validation.

**Phase 4: Community** (4-5 weeks)
Community drives retention and network effects after housing core is validated.
Research flag: STANDARD PATTERNS — apply patterns established in Phase 2 research.

### Gaps to address during planning

1. **i18n infrastructure:** Externalize all UI strings from Phase 1 (i18next). Russian translations are Phase 2 per PROJECT.md. Expensive to retrofit.
2. **Moderator role model:** Multi-user admin panel from Phase 1 (not single admin flag). Prevents founder burnout at 500+ users.
3. **Review trigger mechanism:** Post-stay review trigger requires a cron job or scheduled task infrastructure. Plan for this in Phase 3.
4. **Rate limiting on housing requests:** Max N new host contacts per day for new accounts. Build in Phase 2 with express-rate-limit.
5. **Trusted contact GDPR validation:** SMS to non-users who haven't consented is a compliance risk. Flag for Phase 3 legal research before building.

---

## Confidence Assessment

| Area | Confidence | Gaps |
|------|------------|------|
| Stack selection | HIGH | react-native-maps config plugin with Expo 57 should be verified at install time |
| Feature priorities — table stakes | HIGH | Well-documented analogous platforms |
| Feature priorities — differentiators | MEDIUM | Gap analysis, not user research |
| Architecture patterns | HIGH | Standard patterns, no experimental technology |
| Pitfall identification — technical | HIGH | Known framework behavior |
| Pitfall identification — safety domain | MEDIUM | Platform post-mortems, not operator interviews |
| Phase timing estimates | MEDIUM | No team size or velocity data yet |

**Overall: HIGH confidence on what to build and how to build it. MEDIUM confidence on demand weighting for differentiators and on timing.**

---

## Sources

- Expo 57.0.1 SDK documentation (training knowledge, August 2025 cutoff)
- React Navigation v7, Firebase JS SDK v11, Socket.io v4, Zustand v5 documentation
- MongoDB geospatial indexing, schema design best practices documentation
- Google Maps Platform pricing and Places API documentation
- Platform patterns: Couchsurfing, Airbnb, HER app, BeWelcome, bSafe/Noonlight, Girls Love Travel, Bumble BFF
- Expo managed workflow constraints and EAS Build documentation
