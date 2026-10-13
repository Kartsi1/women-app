---
phase: 02-housing-core
plan: "05"
subsystem: messaging/city-group-chat
status: complete
tags: [city-chat, group-messaging, socket-io, mongodb, push-notifications, security]

dependency_graph:
  requires:
    - 02-01  # socket auth middleware (Firebase handshake)
    - 02-04  # Message model, chatHandler DM machinery, conversationStore, MessageBubble
  provides:
    - MSG-04  # city group chat real-time messaging
    - MSG-05  # group-chat push notification path
  affects:
    - backend/src/models/User.js
    - backend/src/controllers/userController.js
    - backend/src/models/Message.js
    - backend/src/controllers/conversationController.js
    - backend/src/routes/conversations.js
    - backend/src/socket/chatHandler.js
    - mobile/src/types/conversation.ts
    - mobile/src/store/conversationStore.ts
    - mobile/src/services/api.ts
    - mobile/src/components/Chat/MessageBubble.tsx
    - mobile/src/screens/Messages/CityGroupChatScreen.tsx
    - mobile/src/screens/Messages/ConversationListScreen.tsx
    - mobile/src/navigation/AppNavigator.tsx

tech_stack:
  added:
    - citySlug field on User model (indexed, server-derived from homeCity)
    - Message type:'group' discriminator + citySlug + senderName fields + compound index
    - getCityInfo / getCityMessages REST endpoints (GET /api/conversations/city[/messages])
    - join:city / leave:city / message:city Socket.io handlers with store-first + skip-if-online push
    - CityGroupChatScreen (new mobile screen)
    - CityInfo TypeScript interface
    - cityMessages / cityInfo Zustand state + appendCityMessage action
    - getCityInfo / getCityMessages api.ts methods
    - MessageBubble senderName optional prop (Label/14px, #777777)
  patterns:
    - store-first (MongoDB write before socket emit) — locked decision from 02-04
    - server-derived citySlug (NEVER from client payload) — city-room authorization gate
    - scope discriminator (type:'dm' vs type:'group') — structural DM/group isolation (T-02-05-04)
    - skip-if-online push fan-out (io.in(room).fetchSockets()) — MSG-05 pattern from 02-04
    - cursor-based pagination (nextBefore ISO cursor) — mirrors 02-04 getMessages shape
    - explicit socket.leave() on unmount — zombie-room prevention (locked decision)

key_files:
  created:
    - mobile/src/screens/Messages/CityGroupChatScreen.tsx
  modified:
    - backend/src/models/User.js
    - backend/src/controllers/userController.js
    - backend/src/models/Message.js
    - backend/src/controllers/conversationController.js
    - backend/src/routes/conversations.js
    - backend/src/socket/chatHandler.js
    - mobile/src/types/conversation.ts
    - mobile/src/store/conversationStore.ts
    - mobile/src/services/api.ts
    - mobile/src/components/Chat/MessageBubble.tsx
    - mobile/src/screens/Messages/ConversationListScreen.tsx
    - mobile/src/navigation/AppNavigator.tsx

decisions:
  - key: server-derived-cityslug
    text: "citySlug is ALWAYS derived server-side from the authenticated user's profile (join:city, message:city, getCityInfo, getCityMessages) — never from the client payload. This single rule closes the unauthorized-city-room threat class (T-02-05-01)."
  - key: message-collection-discriminator
    text: "Reuse the single messages collection with type:'group' + citySlug discriminator. DM queries filter {conversationId}; city queries filter {citySlug, type:'group'}. Scope leakage is structurally impossible at the query level (T-02-05-04)."
  - key: senderName-denormalized
    text: "senderName is denormalised onto each group Message at create time from socket.data.displayName (cached at join:city). History reads need no join; MessageBubble receives an optional senderName prop."
  - key: push-fan-out-cap
    text: "Per-message rate limiting and expo chunk batching deferred to Phase 3 (MVP assumption: small cities). Fan-out capped at 200 recipients per message. Documented inline in chatHandler.js (RESEARCH Pitfall 7)."

metrics:
  duration: "6 minutes"
  completed_date: "2026-07-09"
  tasks_completed: 3
  files_created: 1
  files_modified: 12
---

# Phase 02 Plan 05: City Group Chat Summary

**One-liner:** Real-time city group chat with store-first messages, server-gated city rooms (citySlug always server-derived), scope-isolated DM/group Message collection, and offline-member push fan-out.

## What Was Built

Delivered the complete city group chat slice end-to-end (MSG-04 + group-chat path of MSG-05), completing ROADMAP Phase 2 success criterion 5.

### Backend (Task 1)

**User.js** — added `citySlug: { type: String, index: true }` alongside the existing `homeCity` field.

**userController.updateProfile** — when `homeCity` is provided, computes `citySlug = homeCity.toLowerCase().trim().replace(/\s+/g,'-')` and sets both fields atomically. Empty homeCity clears citySlug. This ensures every city room has one deterministic name (RESEARCH Open Question 4).

**Message.js** — extended with the group discriminator:
- `type` enum is now `['dm', 'group']` (was `['dm']`)
- `citySlug: { type: String, index: true }` — set only for group messages
- `senderName: { type: String }` — denormalised display name for group messages
- Compound index `{ citySlug: 1, createdAt: -1 }` for paginated city history reads
- Existing DM fields (`conversationId`, compound DM index) are untouched

**conversationController.js** — added two new functions:
- `getCityInfo`: loads the caller's User by firebaseUid, responds with `{ citySlug, homeCity }`. NEVER reads city from the request.
- `getCityMessages`: derives citySlug from the caller's profile; 400 if unset; paginates `{ citySlug, type:'group' }` messages with cursor (`before` param); mirrors getMessages pagination shape exactly.

**routes/conversations.js** — `GET /city` and `GET /city/messages` declared BEFORE the dynamic `/:id/messages` route so Express does not capture 'city' as an `:id` parameter. Both protected by `verifyFirebaseToken + requireVerified`.

**chatHandler.js** — added three city handlers inside the same `io.on('connection')` block alongside the existing DM handlers (02-04 DM handlers are untouched):
- `join:city`: ignores any client slug; loads citySlug from the User profile; caches `socket.data.citySlug` and `socket.data.displayName`; joins `city:{citySlug}`; emits `join:error` if no homeCity.
- `leave:city`: `socket.leave('city:'+socket.data.citySlug)` using the cached server-derived slug.
- `message:city`: validates content (2000 char cap); derives citySlug from `socket.data.citySlug` (never from the payload); **store-first** `Message.create({ type:'group', citySlug, senderUid, senderName, content })`; then `io.to(room).emit('message:new', { ..., citySlug })`; then non-blocking push fan-out to offline city members (fetchSockets → skip online UIDs + sender → cap 200 → sendPushNotification per member).

### Mobile (Tasks 2 & 3)

**types/conversation.ts** — added `senderName?: string` and `citySlug?: string` to `Message`; made `conversationId` optional (absent for group messages); added `CityInfo` interface `{ citySlug: string|null; homeCity: string|null }`.

**conversationStore.ts** — added separate city state: `cityInfo`, `cityMessages`, `setCityInfo`, `setCityMessages`, `appendCityMessage` (dedupes by id, same pattern as `appendMessage`). `clear()` now resets both DM and city state on sign-out. DM state is unchanged.

**api.ts** — added `getCityInfo()` and `getCityMessages(before?)`. Neither function sends a citySlug from the client — the server derives it.

**MessageBubble.tsx** — added optional `senderName?: string` prop; renders a small muted label (14px, #777777) above non-own group bubbles when present. DM rendering is visually unchanged (prop is not passed from DirectMessageScreen).

**CityGroupChatScreen.tsx** (new) — mirrors DirectMessageScreen structure:
- Fetches `getCityInfo` → if `citySlug` is null, renders "Set your home city to join the chat" empty state and stops (no socket work).
- Fetches `getCityMessages` → `setCityMessages`.
- `connectSocket()` → `socket.emit('join:city')` (no slug, T-02-05-01).
- `message:new` listener: filters by `event.citySlug === own citySlug` before calling `appendCityMessage` (T-02-05-04 scope isolation).
- Send: appends optimistic bubble, emits `message:city { content }` (no citySlug).
- `message:error`: marks latest 'sending' city message as 'failed'; tap-to-retry affordance.
- Unmount: `socket.off` both listeners, `socket.emit('leave:city')`, does NOT call `disconnectSocket`.
- Handles `joined:city` data with optional `memberCount` display.

**ConversationListScreen.tsx** — added "City chat" entry row above the conversations list; navigates to `CityGroupChat`.

**AppNavigator.tsx** — added `CityGroupChat: undefined` to `MessagesStackParamList`; registered `CityGroupChatScreen` in `MessagesStack.Navigator`.

## Commits

| Hash | Description |
|------|-------------|
| `74c8c1f` | feat(02-05): city group chat backend — citySlug norm, group Message, city REST+socket |
| `24179e8` | feat(02-05): mobile city chat plumbing — CityInfo type, city store state, api city methods, MessageBubble senderName |
| `57fac1a` | feat(02-05): CityGroupChatScreen, ConversationList city entry, AppNavigator CityGroupChat |

## Security Properties

| Threat | Mitigation | Where |
|--------|-----------|-------|
| T-02-05-01: user posts in another city's room | citySlug derived server-side from profile in join:city, message:city, getCityInfo, getCityMessages — client-supplied slug is never read | chatHandler.js, conversationController.js |
| T-02-05-02: forged sender identity | senderUid + senderName from socket.data (set by Firebase-token auth middleware), never from client payload | chatHandler.js |
| T-02-05-03: push fan-out abuse / content spam | content capped at 2000 chars; push only to members NOT in the room (fetchSockets skip-if-online); fan-out capped at 200; rate limiting deferred to Phase 3 | chatHandler.js |
| T-02-05-04: DM ↔ city message scope leakage | group Messages carry type:'group'+citySlug (no conversationId); city queries filter {citySlug,type:'group'}; DM queries filter {conversationId}; mobile scope-filters message:new by citySlug | Message.js, conversationController.js, CityGroupChatScreen.tsx |

## Deviations from Plan

None — plan executed exactly as written.

The plan note about `nested_repo_hazard` (saying `mobile/` has its own `.git/`) does not apply: per the MONOREPO constraint confirmed in the system prompt and CLAUDE.md, `mobile/` has been absorbed into the root repository via `git subtree`. All commits were made from the repo root.

## Known Stubs

None — all functionality is fully wired. The Phase 3 deferrals (per-message rate limiting, expo chunk batching for large city fan-out) are intentional MVP scope decisions documented inline in `chatHandler.js` and in the threat model.

## Self-Check: PASSED

- `backend/src/models/User.js` — exists, has citySlug field
- `backend/src/models/Message.js` — exists, has type:'group' + citySlug + senderName + compound index
- `backend/src/controllers/conversationController.js` — exports getCityInfo + getCityMessages
- `backend/src/routes/conversations.js` — /city routes declared before /:id/messages
- `backend/src/socket/chatHandler.js` — join:city / leave:city / message:city handlers present
- `mobile/src/screens/Messages/CityGroupChatScreen.tsx` — new file created
- `mobile/src/types/conversation.ts` — CityInfo interface + senderName/citySlug on Message
- `mobile/src/store/conversationStore.ts` — cityInfo/cityMessages/appendCityMessage
- `mobile/src/services/api.ts` — getCityInfo/getCityMessages
- `mobile/src/components/Chat/MessageBubble.tsx` — senderName prop
- `mobile/src/navigation/AppNavigator.tsx` — CityGroupChat in stack
- Commits: 74c8c1f, 24179e8, 57fac1a all present
- `node --check` on all 6 backend files: PASSED
- `npx tsc --noEmit` in mobile: PASSED
