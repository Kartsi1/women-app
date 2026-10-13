---
phase: 02-housing-core
plan: "03"
subsystem: api, mobile
tags: [stay-requests, address-reveal, push-notifications, safety-critical, security]

requires:
  - phase: 02-housing-core
    plan: "02"
    provides: "Listing model + getListingDetail (addressRevealed=false stub), SafetyChip, ListingDetailScreen with 'Request stay' placeholder"

provides:
  - "StayRequest Mongoose model (guestUid/hostUid/listingId/checkIn/checkOut/intro/status)"
  - "createRequest API: rejects self-requests (T-02-03-03), notifies host via push"
  - "getHostInbox API: host-scoped inbox, newest first, safe field projection"
  - "updateRequestStatus API: host-only (T-02-03-02); increments hostsCount/tripsCount on accept; guest push on accept/decline"
  - "/api/requests routes behind verifyFirebaseToken + requireVerified; /inbox before /:id"
  - "getListingDetail now reveals exactAddress to accepted guest only (REQT-03 / T-02-03-01)"
  - "StayRequestComposeScreen: AvailabilityDatePicker + intro (max 500, live counter); disabled-until-valid; 'Requesting...' in-flight"
  - "RequestStatusScreen: read-only status; fetches listing detail for AddressRevealCard on acceptance"
  - "AddressRevealCard: green (#e8f5e9/#2e7d32), checkmark icon, server-sent address"
  - "HostInboxScreen: FlatList of RequestCard; Accept immediate; Decline with Alert confirmation; empty state"
  - "RequestCard: guest id, date range, intro preview, Accept/Decline buttons, accepted/declined badges"
  - "navigationRef: shared CreateNavigationContainerRef for imperative navigation from hooks"
  - "Push deep-link: stay_request type → HostInbox (host) or RequestStatus (guest)"
  - "Mutually exclusive SafetyChip/AddressRevealCard in ListingDetailScreen"

affects:
  - 02-05 (address reveal is now fully wired; StayRequest backs hostsCount/tripsCount)

tech-stack:
  added: []
  patterns:
    - "StayRequest.findOne({listingId, guestUid: req.user.uid, status:'accepted'}) per-request check — the sole address-reveal gate"
    - "createNavigationContainerRef pattern for imperative navigation from non-component hooks"
    - "Alert.alert for Decline confirmation sheet (destructive action gated in UI + server)"
    - "ts-expect-error on untyped navigationRef.current?.navigate with nested screen params"

key-files:
  created:
    - backend/src/models/StayRequest.js
    - backend/src/controllers/requestController.js
    - backend/src/routes/requests.js
    - mobile/src/components/Listings/AddressRevealCard.tsx
    - mobile/src/components/Requests/RequestCard.tsx
    - mobile/src/screens/Requests/StayRequestComposeScreen.tsx
    - mobile/src/screens/Requests/RequestStatusScreen.tsx
    - mobile/src/screens/Requests/HostInboxScreen.tsx
    - mobile/src/navigation/navigationRef.ts
  modified:
    - backend/src/controllers/listingController.js (StayRequest import + address-reveal in getListingDetail)
    - backend/src/server.js (register /api/requests)
    - mobile/src/services/api.ts (createStayRequest, getHostInbox, updateStayRequestStatus)
    - mobile/src/screens/Housing/ListingDetailScreen.tsx (AddressRevealCard + wired "Request stay" button)
    - mobile/src/navigation/AppNavigator.tsx (HousingStackParamList extended + 3 new screens)
    - mobile/src/navigation/RootNavigator.tsx (attach navigationRef to NavigationContainer)
    - mobile/src/hooks/useFirebaseAuth.ts (stay_request deep-link handler)

key-decisions:
  - "Address reveal is a per-request, per-user server-side check: StayRequest.findOne for the specific guest+listing+status=accepted — never cached, never shared across users"
  - "guestUid derived from verified token in createRequest (T-02-03-04) — body never trusted for identity"
  - "Decline confirmation uses Alert.alert (native) rather than a bottom sheet Modal to keep Task 3 scope tight while still gating the destructive action"
  - "HostInboxScreen placed in HousingStackParamList (not a separate tab) to keep navigation flat in MVP"
  - "navigationRef uses @ts-expect-error for the nested navigate() call — untyped ref has no generic param; the alternative of fully typing TabParamList+HousingStackParamList through createNavigationContainerRef would require touching every existing screen's type import"
  - "TaskCard RequestCard component uses shortened guestUid display (first 8 chars) — display name fetch from /api/users/:uid is deferred to post-MVP"

metrics:
  duration: 7min
  completed: "2026-07-09"
  tasks: 3
  files: 16

status: complete
---

# Phase 02 Plan 03: Stay-Request Loop + Safety-Critical Address Reveal Summary

**StayRequest model + request API with push notifications; safety-critical server-side address reveal wired in getListingDetail (REQT-03); mobile compose, host inbox, status screens, AddressRevealCard, and push deep-link. Implements REQT-01..04.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-09T11:25:33Z
- **Completed:** 2026-07-09T11:32:xx Z
- **Tasks:** 3
- **Files created/modified:** 16

## Accomplishments

### Task 1: Backend — StayRequest model, request API with push, and address-reveal wiring

- Created `backend/src/models/StayRequest.js`: guestUid (indexed), hostUid (indexed), listingId (ObjectId ref Listing), checkIn, checkOut, intro (max 500), status (enum pending/accepted/declined, default pending, indexed), timestamps
- Created `backend/src/controllers/requestController.js`:
  - `createRequest`: validates listing exists; rejects 403 when guestUid === listing.ownerUid (T-02-03-03); validates dates (checkOut >= checkIn); validates intro (non-empty, max 500 — T-02-03-05); creates StayRequest; pushes host notification with data `{type:'stay_request', requestId}`
  - `getHostInbox`: host-scoped query (hostUid === req.user.uid), sorted newest first, safe field projection
  - `updateRequestStatus`: validates status in {accepted,declined}; rejects 403 unless request.hostUid === req.user.uid (T-02-03-02); increments hostsCount on host and tripsCount on guest when accepted; sends push to guest with `{type:'stay_request', requestId, status}`
- Modified `backend/src/controllers/listingController.js`:
  - Imports `StayRequest` at top
  - `getListingDetail` queries `StayRequest.findOne({listingId, guestUid: req.user.uid, status:'accepted'})` per-request; addressRevealed = Boolean(result); exactAddress included only when accepted (REQT-03 / T-02-03-01)
- Created `backend/src/routes/requests.js`: POST / → createRequest, GET /inbox → getHostInbox (static before dynamic), PATCH /:id → updateRequestStatus; all behind verifyFirebaseToken + requireVerified
- Registered `/api/requests` in `backend/src/server.js`
- Extended `mobile/src/services/api.ts`: `createStayRequest`, `getHostInbox`, `updateStayRequestStatus` with full TypeScript types

### Task 2: Mobile — stay request compose, guest-side status, AddressRevealCard

- Created `AddressRevealCard`: green (#e8f5e9/#2e7d32) card; Ionicons "checkmark-circle"; renders server-sent exactAddress; accessibilityRole="text" (the server is the gate — T-02-03-01)
- Updated `ListingDetailScreen`: "Request stay" wired to navigate `StayRequestCompose` with listingId; SafetyChip replaced by AddressRevealCard when addressRevealed=true (mutually exclusive)
- Created `StayRequestComposeScreen`: AvailabilityDatePicker pre-filled; multiline intro TextInput (max 500, live character count); submit disabled until dates+intro valid; "Requesting…" with ActivityIndicator while in-flight; inline error copy "Request not sent. Please try again."; navigates to RequestStatus on success
- Created `RequestStatusScreen`: read-only status view with requestId display; fetches listing detail via getListingDetail; shows AddressRevealCard when addressRevealed=true; "View listing details" link; handles requestId from push notification deep-link
- Created `RequestCard`: guest UID shortened (first 8 chars), date range, 2-line intro preview, Accept (accent #6200ea) and Decline (destructive #d32f2f, accessibilityLabel names consequence) buttons; accepted/declined badges replace action buttons
- Created `HostInboxScreen`: ProfileScreen fetch pattern; FlatList of RequestCard; Accept → immediate call; Decline → Alert confirmation ("Decline this request?" / "Yes, decline" destructive / "Cancel"); optimistic state update on success; pull-to-refresh; empty state "No stay requests yet"
- Extended `HousingStackParamList`: `StayRequestCompose: { listingId }`, `RequestStatus: { requestId; listingId? }`, `HostInbox: undefined`
- Registered all 3 new screens in HousingStackNavigator

### Task 3: Mobile — push notification deep-link for stay_request

- Created `mobile/src/navigation/navigationRef.ts`: `createNavigationContainerRef()` shared ref for imperative navigation from non-component contexts
- Updated `RootNavigator.tsx`: attaches `navigationRef` to `<NavigationContainer ref={navigationRef}>`
- Updated `useFirebaseAuth.ts` notification response handler:
  - `stay_request` with `data.status` present (accept/decline notification) → navigates to `Housing > RequestStatus` with `{requestId, listingId}`
  - `stay_request` without `data.status` (new request notification for host) → navigates to `Housing > HostInbox`
  - Existing verification_approved / verification_rejected handling unchanged

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: Backend + API | `16c9893` | StayRequest model, request API with push, address-reveal wiring |
| Task 2: Mobile screens | `e816966` | Mobile compose, host inbox, request status screens with AddressRevealCard |
| Task 3: Push deep-link | `81cf4b4` | Push deep-link for stay_request via navigationRef |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] navigationRef for push deep-link navigation**
- **Found during:** Task 3
- **Issue:** `useFirebaseAuth` hook has no access to the navigation stack — navigation.navigate() cannot be called from a hook without a navigation ref
- **Fix:** Added `navigationRef.ts` (createNavigationContainerRef), attached to NavigationContainer in RootNavigator, used in useFirebaseAuth with `@ts-expect-error` for untyped nested navigate
- **Files modified:** mobile/src/navigation/navigationRef.ts (new), mobile/src/navigation/RootNavigator.tsx, mobile/src/hooks/useFirebaseAuth.ts
- **Committed in:** 81cf4b4

**2. [Rule 2 - Missing] HostInboxScreen and RequestCard created in Task 2 commit**
- **Found during:** Task 2 (TypeScript compilation needed all HousingStackParamList screens to be importable)
- **Issue:** AppNavigator.tsx imports HostInboxScreen at the top of the file; TypeScript would fail if the file didn't exist when registering all stack screens
- **Fix:** Created HostInboxScreen and RequestCard in the Task 2 commit rather than waiting for Task 3 — all files are complete and correct either way
- **Committed in:** e816966

## Security Coverage (STRIDE Threat Register)

| Threat ID | Status | Evidence |
|-----------|--------|---------|
| T-02-03-01 (address reveal without accepted request) | Mitigated | `getListingDetail`: `StayRequest.findOne({listingId, guestUid: req.user.uid, status:'accepted'})` — per-user, per-request check; exactAddress conditional on Boolean result |
| T-02-03-02 (accept/decline another host's request) | Mitigated | `updateRequestStatus` 403 unless `request.hostUid === req.user.uid` |
| T-02-03-03 (self-request to bypass address gate) | Mitigated | `createRequest` 403 when `guestUid === listing.ownerUid` |
| T-02-03-04 (forged guestUid in body) | Mitigated | `guestUid = req.user.uid` — always from the verified Firebase token |
| T-02-03-05 (oversized intro DoS) | Mitigated | Schema `maxlength: 500` + controller `intro.length > 500` check |

## Known Stubs

- `RequestStatusScreen` shows a generic "Pending host response" status label — it does not poll for status updates. The screen shows the current state at mount time. Real-time status updates would require a separate polling or socket-based mechanism (deferred post-MVP).
- `RequestCard` guest display uses a shortened Firebase UID (first 8 chars) — display name resolution via `/api/users/:uid` is deferred to post-MVP.

## Threat Flags

No new security-relevant surface beyond the plan's threat model.

## Self-Check: PASSED

**Files verified on disk:**
- backend/src/models/StayRequest.js ✓
- backend/src/controllers/requestController.js ✓
- backend/src/controllers/listingController.js ✓
- backend/src/routes/requests.js ✓
- backend/src/server.js ✓
- mobile/src/components/Listings/AddressRevealCard.tsx ✓
- mobile/src/components/Requests/RequestCard.tsx ✓
- mobile/src/screens/Requests/StayRequestComposeScreen.tsx ✓
- mobile/src/screens/Requests/RequestStatusScreen.tsx ✓
- mobile/src/screens/Requests/HostInboxScreen.tsx ✓
- mobile/src/navigation/navigationRef.ts ✓
- mobile/src/navigation/AppNavigator.tsx ✓
- mobile/src/navigation/RootNavigator.tsx ✓
- mobile/src/hooks/useFirebaseAuth.ts ✓
- mobile/src/services/api.ts ✓
- mobile/src/screens/Housing/ListingDetailScreen.tsx ✓

**Commits verified in git history:**
- 16c9893 ✓
- e816966 ✓
- 81cf4b4 ✓

**TypeScript:** `cd mobile && npx tsc --noEmit` — exit 0 ✓
**Backend syntax:** `node --check` on all 5 backend files — OK ✓
**Security:** exactAddress conditional on per-user accepted StayRequest confirmed in listingController ✓

---
*Phase: 02-housing-core*
*Completed: 2026-07-09*
