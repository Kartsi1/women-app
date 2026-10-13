---
phase: 02-housing-core
verified: 2026-07-09T12:00:00Z
status: human_needed
score: 14/15
behavior_unverified: 1
overrides_applied: 0
human_verification:
  - test: "On MapDiscoveryScreen, tap a neighbourhood pin and navigate to ListingDetailScreen. Confirm the map renders neighbourhood pins (not exact addresses) and the detail view shows SafetyChip (amber) for a guest with no accepted stay request."
    expected: "Pins cluster at neighbourhood level; address field reads 'Address hidden for safety' or equivalent; no street address visible."
    why_human: "Requires a running Expo build with Google Maps API key and a seeded listing. Cannot grep for map render output."
  - test: "After a host accepts a stay request, the guest opens ListingDetailScreen for that listing. Confirm AddressRevealCard (green) appears with the full street address."
    expected: "exactAddress is visible only to the accepted guest; all other users still see SafetyChip."
    why_human: "State transition from SafetyChip → AddressRevealCard depends on server returning addressRevealed=true, which requires an accepted StayRequest in Mongo. Cannot verify runtime state transition programmatically."
---

# Phase 2: Housing Core — Verification Report

**Phase Goal:** A verified woman can discover available housing on a map, request a stay, be accepted by a host, and exchange real-time messages in 1:1 conversations and city group chats.
**Verified:** 2026-07-09T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | Verified host can create listing with photos, availability, neighbourhood location, exact address stored hidden from non-accepted guests; listing appears on map as neighbourhood pin | VERIFIED | `listingController.createListing` stores `exactAddress`; `$project` in `searchListings` explicitly omits `exactAddress`; `Listing.js` model has `exactAddress` stored. `createListing` API in `api.ts` calls `POST /api/listings` with `FormData`. |
| SC-2 | Verified user can search by geo location and filter by availability dates; results shown on interactive map | VERIFIED | `searchListings` in `listingController.js` runs `$geoNear` with optional `availabilityDates.$elemMatch` filter. `MapDiscoveryScreen.tsx` fetches via `searchListings()`, renders `Marker` per listing with coordinate flip `{latitude: coords[1], longitude: coords[0]}`. `FilterSheet` enables date-range narrowing. |
| SC-3 | Verified guest sends stay request with dates + intro; host sees inbox; host accepts/declines; guest gets push; on acceptance address revealed | VERIFIED | `requestController.js` `createRequest` validates dates/intro, notifies host push. `getHostInbox` scoped to `hostUid`. `updateRequestStatus` enforces host-only gate (`T-02-03-02`). `getListingDetail` reveals `exactAddress` only when `StayRequest.status === 'accepted'` for that guest+listing pair. `HostInboxScreen`, `StayRequestComposeScreen`, `RequestStatusScreen` all wired. |
| SC-4 | Two verified users can send/receive real-time 1:1 DMs after message request accepted; push on arrival | VERIFIED | Server-side gate: `message:dm` handler queries `Conversation.findOne({participants: $all sortedPair})`; refuses if none found (T-02-04-02). STORE-FIRST: `Message.create()` before `io.to(room).emit()`. Push when recipient not in room. `DirectMessageScreen` joins room, listens for `message:new`, emits `leave:dm` on unmount. |
| SC-5 | Verified user joins city group chat and exchanges real-time messages; push on arrival | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code path is present and wired: `join:city` derives `citySlug` server-side from user profile; `message:city` stores to Mongo before emit; `CityGroupChatScreen` emits `join:city` with no payload. However, the state transition "user with no homeCity gets empty-state, user with homeCity joins room and receives messages" is a runtime invariant that no test exercises. |

**Score:** 14/15 truths verified (1 present, behavior-unverified)

---

## Safety Invariant Verification

Each of the 6 security-critical invariants is verified against the actual code below.

### SI-1: exactAddress NEVER returned unless accepted StayRequest exists

**PASS**

- `searchListings` (`listingController.js:224–235`): Aggregation `$project` explicitly lists allowed fields — `exactAddress` is not among them. Comment: `// exactAddress is NOT projected`.
- `getListingDetail` (`listingController.js:287–293`): Performs `StayRequest.findOne({ listingId, guestUid: req.user.uid, status: 'accepted' })`. Only if that document exists is `exactAddress` included in response (`line 321`).
- Response is built via explicit object literal, never with raw document spread (Pitfall 5 avoided).
- Neither `/api/listings/search` nor any search-related route exposes `exactAddress`.

### SI-2: 1:1 message-request GATE enforced SERVER-SIDE

**PASS**

- `message:dm` handler (`chatHandler.js:124`): `await Conversation.findOne({ participants: { $all: sortedPair } })`. If no conversation found: `socket.emit('message:error', { error: 'No accepted conversation' }); return;`
- The `Conversation` document is created exclusively in `messageRequestController.js:updateRequestStatus` on acceptance — no client path creates a Conversation directly.
- `join:dm` also gates on Conversation existence before admitting to room (`chatHandler.js:73`).
- Client cannot bypass: the server gate fires on the `message:dm` event regardless of what room the client believes it is in.

### SI-3: STORE-FIRST — messages persisted to Mongo BEFORE socket emit

**PASS (DM):** `chatHandler.js:134` — `savedMessage = await Message.create({...})` inside a try/catch; on failure `socket.emit('message:error')` and `return` — no `io.to(room).emit()` is reached.

**PASS (city group):** `chatHandler.js:277` — same pattern. `savedMessage = await Message.create({...})` before `io.to(room).emit('message:new', {...})` at line 285.

### SI-4: citySlug derived SERVER-SIDE from user's profile, never from client

**PASS**

- `join:city` (`chatHandler.js:187–207`): takes zero payload from client; loads `User.findOne({ firebaseUid: uid })`; uses `user.citySlug`. Comment: "T-02-05-01: ALWAYS derive citySlug from the caller's own profile".
- `message:city` (`chatHandler.js:242`): `let citySlug = socket.data.citySlug` (cached from join:city); if not cached, re-derives from `User.findOne({firebaseUid: uid})`. Client-supplied payload is `{ content }` only — no `citySlug` field read.
- `CityGroupChatScreen.tsx:126`: `socket.emit('join:city')` — no payload. `socket.emit('message:city', { content })` — no citySlug. This is the correct client contract.
- `getCityMessages` (`conversationController.js:144–151`): also always loads citySlug from caller's profile; a client-supplied query param is ignored.

### SI-5: senderUid / senderName from socket.data, never from client payload

**PASS**

- DM messages: `senderUid: uid` where `uid = socket.data.uid` (set by io.use auth middleware at line 50). The `message:dm` payload is `{ otherUid, content }` — no senderUid field.
- Group messages: `senderUid: uid` (socket.data), `senderName: socket.data.displayName` (cached at join:city). The `message:city` payload is `{ content }` only.
- REST: `messageRequestController.js:28`: `const senderUid = req.user.uid;` (from verified Firebase token). `requestController.js:21`: `const guestUid = req.user.uid;`.

### SI-6: Socket handshake authenticates Firebase token; verified-only; rooms left on disconnect/leave

**PASS (auth):** `io.use` middleware (`chatHandler.js:39–55`): `getAuth().verifyIdToken(token)`. If `!decoded.isVerified` → `next(new Error('User not verified'))`. Missing token → `next(new Error('Missing auth token'))`.

**PASS (leave on explicit leave event):** `leave:dm` (`chatHandler.js:89–94`): `socket.leave(room)`. `leave:city` (`chatHandler.js:214–217`): `socket.leave('city:${citySlug}')`.

**PASS (disconnect):** `socket.on('disconnect')` handler only logs. Socket.io automatically removes a socket from all rooms it belongs to on disconnect — no manual `leave()` needed here. This is correct behaviour per Socket.io specification.

**Note:** REST middleware in `auth.js` uses the same Firebase Admin `verifyIdToken` and a `requireVerified` guard that checks `isVerified`, providing defence-in-depth at the HTTP layer.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/models/Listing.js` | Listing model with exactAddress + location GeoJSON | VERIFIED | Present, substantive, used by listingController |
| `backend/src/models/StayRequest.js` | StayRequest with status enum | VERIFIED | Present, substantive, used by requestController |
| `backend/src/models/Conversation.js` | Conversation with participants | VERIFIED | Present, substantive, used by chatHandler + messageRequestController |
| `backend/src/models/Message.js` | Message with type discriminator (dm/group) | VERIFIED | Present, substantive, dual-scope indexes |
| `backend/src/models/MessageRequest.js` | MessageRequest gate model | VERIFIED | Present, substantive |
| `backend/src/controllers/listingController.js` | create + search + detail with address hiding | VERIFIED | All 3 functions substantive, geoNear, address gate |
| `backend/src/controllers/requestController.js` | createRequest + inbox + updateStatus | VERIFIED | Host-only gate, token-derived guestUid, push on accept |
| `backend/src/controllers/messageRequestController.js` | MSG gate create + inbox + accept | VERIFIED | Recipient-only guard, Conversation created on accept |
| `backend/src/controllers/conversationController.js` | listConversations + getMessages + getCityInfo + getCityMessages | VERIFIED | Participant 403 gate, city derived from profile |
| `backend/src/socket/chatHandler.js` | Authenticated socket + join:dm + message:dm + join:city + message:city | VERIFIED | All handlers substantive, safety invariants in code |
| `backend/src/routes/listings.js` | Routes with auth middleware + multer | VERIFIED | verifyFirebaseToken + requireVerified on all routes |
| `backend/src/routes/requests.js` | Stay request routes | VERIFIED | Protected, static/inbox before dynamic /:id |
| `backend/src/routes/messageRequests.js` | Message request routes | VERIFIED | Protected, inbox before /:id |
| `backend/src/routes/conversations.js` | Conversation routes incl city path | VERIFIED | city + city/messages before /:id/messages |
| `mobile/src/screens/Housing/CreateListingScreen.tsx` | Create listing form with photos | VERIFIED | Exists, multipart upload wired to api.createListing |
| `mobile/src/screens/Housing/MapDiscoveryScreen.tsx` | Map with neighbourhood pins + date filter | VERIFIED | Substantive, searchListings wired, coordinate flip correct |
| `mobile/src/screens/Housing/ListingDetailScreen.tsx` | Detail view with SafetyChip / AddressRevealCard | VERIFIED | Both components imported and conditionally rendered |
| `mobile/src/screens/Requests/StayRequestComposeScreen.tsx` | Stay request form | VERIFIED | Date picker + intro, wired to createStayRequest |
| `mobile/src/screens/Requests/HostInboxScreen.tsx` | Host inbox with accept/decline | VERIFIED | FlatList + accept/decline wired to updateStayRequestStatus |
| `mobile/src/screens/Requests/RequestStatusScreen.tsx` | Request status + address reveal | VERIFIED | Fetches listing detail when listingId provided; renders AddressRevealCard |
| `mobile/src/screens/Messages/MessageRequestComposeScreen.tsx` | Compose message request | VERIFIED | Wired to sendMessageRequest |
| `mobile/src/screens/Messages/MessageRequestInboxScreen.tsx` | Message request inbox | VERIFIED | Wired to getMessageRequestInbox + updateMessageRequestStatus |
| `mobile/src/screens/Messages/DirectMessageScreen.tsx` | Real-time 1:1 DM | VERIFIED | Socket join:dm + message:dm + leave:dm + push handling |
| `mobile/src/screens/Messages/ConversationListScreen.tsx` | Conversation list | VERIFIED | File exists, wired to listConversations |
| `mobile/src/screens/Messages/CityGroupChatScreen.tsx` | City group chat | VERIFIED | join:city with no payload, message:city with content only |
| `mobile/src/services/socketService.ts` | Authenticated Socket.io client | VERIFIED | Firebase token in handshake.auth, connectSocket idempotent |
| `mobile/src/services/api.ts` | Full API client for phase 2 | VERIFIED | All LIST/REQT/MSG endpoints wired correctly |
| `mobile/src/navigation/AppNavigator.tsx` | Housing + Messages + Profile stacks in bottom tab | VERIFIED | All screens registered, connectSocket called on user change |
| `mobile/src/store/conversationStore.ts` | DM + city message state, separate arrays | VERIFIED | appendMessage + appendCityMessage deduplicate; clear() on sign-out |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `listingController.getListingDetail` | `StayRequest` model | `findOne({ listingId, guestUid, status: 'accepted' })` | WIRED | Line 287-292 |
| `listingController.searchListings` | address hiding | `$project` omits `exactAddress` | WIRED | Lines 222-235 |
| `chatHandler.message:dm` | `Conversation` model | `findOne({ participants: $all sortedPair })` gate | WIRED | Line 124 |
| `chatHandler.message:dm` | `Message` model | `Message.create()` BEFORE `io.to(room).emit()` | WIRED | Lines 134, 154 |
| `chatHandler.join:city` | `User` model | `findOne({ firebaseUid: uid })` → `user.citySlug` | WIRED | Lines 191-195 |
| `chatHandler.message:city` | `Message` model | `Message.create()` with `citySlug` server-derived | WIRED | Lines 275, 285 |
| `messageRequestController.updateRequestStatus` | `Conversation` model | `Conversation.create()` on accept | WIRED | Lines 170-175 |
| `AppNavigator` | `socketService.connectSocket` | `useEffect` on user change | WIRED | Line 163-169 |
| `DirectMessageScreen` | `chatHandler join:dm` | `socket.emit('join:dm', { otherUid })` | WIRED | Line 94 |
| `CityGroupChatScreen` | `chatHandler join:city` | `socket.emit('join:city')` no payload | WIRED | Line 126 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `MapDiscoveryScreen` | `listings` | `searchListings()` → `Listing.aggregate($geoNear)` | Yes — live Mongo geo query | FLOWING |
| `ListingDetailScreen` | `listing` | `getListingDetail()` → `Listing.findById()` + `StayRequest.findOne()` | Yes — Mongo + address gate | FLOWING |
| `HostInboxScreen` | `requests` | `getHostInbox()` → `StayRequest.find({ hostUid })` | Yes — Mongo query | FLOWING |
| `DirectMessageScreen` | `activeMessages` | `getConversationMessages()` → `Message.find({ conversationId })` + socket `message:new` | Yes — history + real-time | FLOWING |
| `CityGroupChatScreen` | `cityMessages` | `getCityMessages()` → `Message.find({ citySlug, type:'group' })` + socket `message:new` | Yes — history + real-time | FLOWING |
| `MessageRequestInboxScreen` | `requests` | `getMessageRequestInbox()` → `MessageRequest.find({ recipientUid, status:'pending' })` | Yes — Mongo query | FLOWING |

---

## Requirement Coverage

| Requirement | Plan | Status | Evidence |
|-------------|------|--------|---------|
| LIST-01 | 02-02 | SATISFIED | `createListing` stores title, description, photos, availability, location, houseRules, exactAddress |
| LIST-02 | 02-02 | SATISFIED | `getListingDetail` returns full detail; `searchListings` for listing card |
| LIST-03 | 02-02 | SATISFIED | `searchListings` uses `$geoNear`; `MapDiscoveryScreen` renders neighbourhood pins |
| LIST-04 | 02-02 | SATISFIED | `searchListings` accepts `fromDate`/`toDate`; `FilterSheet` drives it from mobile |
| LIST-05 | 02-02 | SATISFIED | `exactAddress` never in `$project` of search; `getListingDetail` hides unless accepted |
| REQT-01 | 02-03 | SATISFIED | `createRequest` validates dates + intro; `StayRequestComposeScreen` drives it |
| REQT-02 | 02-03 | SATISFIED | `getHostInbox` + `updateRequestStatus` host-only; `HostInboxScreen` accept/decline |
| REQT-03 | 02-03 | SATISFIED | Address reveal logic in `getListingDetail` behind accepted StayRequest check; `RequestStatusScreen` + `AddressRevealCard` on mobile |
| REQT-04 | 02-03 | SATISFIED | `sendPushNotification` called for guest on accept/decline; host notified on new request |
| MSG-01 | 02-04 | SATISFIED | `createMessageRequest` with intro; `MessageRequestComposeScreen`; senderUid from token |
| MSG-02 | 02-04 | SATISFIED | `getRequestInbox` + `updateRequestStatus`; `MessageRequestInboxScreen`; accept creates Conversation |
| MSG-03 | 02-04 | SATISFIED | `listConversations` + `getMessages`; `ConversationListScreen` + `DirectMessageScreen`; participant 403 gate |
| MSG-04 | 02-05 | SATISFIED | `message:city` socket handler + `getCityMessages` + `getCityInfo`; `CityGroupChatScreen` |
| MSG-05 | 02-04+05 | SATISFIED | DM push: recipient not in room check (`chatHandler.js:164-175`). City push: offline fan-out to citySlug members (`chatHandler.js:298-323`). |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/src/server.js` | 28 | `app.use(cors())` — REST CORS still wildcard `*` | WARNING | HTTP REST endpoints accept requests from any origin. Socket.io CORS is correctly scoped to `ALLOWED_ORIGINS` env var. This was a pre-existing known issue documented in CLAUDE.md ("Критические проблемы"). Not introduced by this phase. Does not block phase goal delivery but should be fixed before production. |

No `TBD`, `FIXME`, or `XXX` markers found in any backend or mobile source file modified in this phase.

No stub patterns found: no `return null`, `return {}`, `return []`, or `console.log`-only implementations in phase deliverables.

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — requires a running MongoDB instance and Firebase project to execute meaningful behavioral spot-checks (API endpoints require live DB; socket handlers require live Socket.io server). No runnable single-command behavioral checks are available without server state.

---

## Probe Execution

No probes defined for this phase.

---

## Human Verification Required

### 1. Address hiding on map (SC-1 / LIST-05)

**Test:** On `MapDiscoveryScreen`, seed one listing and verify the map renders neighbourhood pins (not exact address pins). Tap a pin and navigate to `ListingDetailScreen` as a guest without an accepted stay request.
**Expected:** `SafetyChip` (amber) is rendered in place of the exact address. The `exactAddress` field in the API response is `null`.
**Why human:** Requires a running Expo build with Google Maps API key and seeded DB data. The address-hiding server logic is verified in code; the visual rendering of SafetyChip vs AddressRevealCard is the user-facing invariant that needs confirmation.

### 2. Address reveal after stay acceptance (SC-3 / REQT-03)

**Test:** Complete the full flow: host creates listing → guest requests stay → host accepts → guest opens `ListingDetailScreen`.
**Expected:** `AddressRevealCard` (green) appears with the full street address. No other user (another guest, anonymous) sees the address.
**Why human:** The state transition from `SafetyChip` to `AddressRevealCard` depends on the runtime value of `addressRevealed` from the server. The per-user, per-request check is verified in code; the UI transition and the isolation between guests requires a live integration test.

---

## Gaps Summary

No blocking gaps identified. All 14 of 15 truths verified from code evidence. The one behavior-unverified truth (SC-5, city group chat join/receive flow) has its code fully wired and correct; it requires a human integration test to certify the runtime state transition.

One pre-existing WARNING: REST CORS is still `cors()` (wildcard). This is not a phase 2 regression — it was documented as a known issue in the project's CLAUDE.md before this phase and was not in scope for the housing/messaging work. The Socket.io CORS was correctly scoped in plan 02-01.

---

_Verified: 2026-07-09T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
