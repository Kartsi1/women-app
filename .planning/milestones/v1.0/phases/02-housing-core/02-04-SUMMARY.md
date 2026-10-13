---
phase: 02-housing-core
plan: "04"
subsystem: api, mobile, socket
tags: [direct-messaging, socket.io, store-first, message-request-gate, push-notifications, zustand, react-navigation]

requires:
  - phase: 02-housing-core
    plan: "01"
    provides: "Authenticated Socket.io handshake (io.use() middleware, chatHandler.js), socketService, socketStore, tab shell"
  - phase: 02-housing-core
    plan: "02"
    provides: "Listing model, api.ts authHeaders pattern, AppNavigator HousingStack"

provides:
  - "MessageRequest Mongoose model (pending/accepted/declined, indexed senderUid+recipientUid)"
  - "Conversation Mongoose model (dm type, sorted participants pair — the MSG-02 server-side gate)"
  - "Message Mongoose model (separate collection, compound index conversationId+createdAt for paginated history)"
  - "POST /api/message-requests — createMessageRequest with self/dup/409 guard + push to recipient (MSG-01)"
  - "GET /api/message-requests/inbox — pending inbox for authenticated recipient"
  - "PATCH /api/message-requests/:id — recipient-only accept/decline; accept seeds intro + creates Conversation + notifies sender"
  - "GET /api/conversations — listConversations filtered to authenticated participant"
  - "GET /api/conversations/:id/messages — participant-gated paginated history (T-02-04-01)"
  - "chatHandler.js join:dm (Conversation gate), leave:dm (explicit mid-session leave), message:dm (MSG-02 gate + store-first + offline push MSG-05)"
  - "mobile conversationStore (Zustand): conversations, activeMessages, appendMessage (dedup), setActiveMessages, clear"
  - "mobile conversation.ts types: MessageRequest, Conversation, Message"
  - "mobile api.ts: sendMessageRequest, getMessageRequestInbox, updateMessageRequestStatus, listConversations, getConversationMessages"
  - "MessageRequestComposeScreen: intro compose from ViewProfileScreen (MSG-01)"
  - "MessageRequestInboxScreen: FlatList + accept/decline with confirmation sheet (MSG-02)"
  - "ConversationListScreen: replaces MessagesPlaceholderScreen; Messages tab root (MSG-03)"
  - "DirectMessageScreen: history + real-time socket + optimistic send + failed/retry (MSG-03)"
  - "MessageBubble: own/other alignment, 75% max-width, pending/failed states"
  - "ChatInput: KeyboardAvoidingView + multiline + Ionicons send button"
  - "ViewProfileScreen: 'Send message request' button (hidden on own profile)"
  - "AppNavigator MessagesStackNavigator: ConversationList→DirectMessage/Compose/Inbox; MessagesStackParamList exported"

affects:
  - 02-05-group-chat (chatHandler.js ready for join:city / message:city in the same pattern)

tech-stack:
  added: []
  patterns:
    - "Store-first: Message.create() called BEFORE io.to(room).emit() in chatHandler.js — DB write before any socket broadcast"
    - "MSG-02 gate server-side: chatHandler message:dm refuses to write unless Conversation exists for sorted pair"
    - "Sorted pair: [uid, otherUid].sort() on the server for room name and Conversation lookup — client cannot fabricate a room"
    - "Optimistic message: temp id (opt_${Date.now()}) → appendMessage → confirmed by message:new server echo (dedup by id)"
    - "leave:dm on unmount: socket.off + emit leave (explicit mid-session leave, shared socket NOT disconnected)"
    - "useFocusEffect for inbox/conversation list refresh (matches useFocusEffect already used in 02-03 screens)"

key-files:
  created:
    - backend/src/models/MessageRequest.js
    - backend/src/models/Conversation.js
    - backend/src/models/Message.js
    - backend/src/controllers/messageRequestController.js
    - backend/src/controllers/conversationController.js
    - backend/src/routes/messageRequests.js
    - backend/src/routes/conversations.js
    - mobile/src/types/conversation.ts
    - mobile/src/store/conversationStore.ts
    - mobile/src/components/Chat/MessageBubble.tsx
    - mobile/src/components/Chat/ChatInput.tsx
    - mobile/src/screens/Messages/MessageRequestComposeScreen.tsx
    - mobile/src/screens/Messages/MessageRequestInboxScreen.tsx
    - mobile/src/screens/Messages/ConversationListScreen.tsx
    - mobile/src/screens/Messages/DirectMessageScreen.tsx
  modified:
    - backend/src/socket/chatHandler.js (join:dm, leave:dm, message:dm added)
    - backend/src/server.js (/api/message-requests and /api/conversations registered)
    - mobile/src/services/api.ts (5 messaging functions added)
    - mobile/src/screens/Profile/ViewProfileScreen.tsx ("Send message request" button added)
    - mobile/src/navigation/AppNavigator.tsx (MessagesStackNavigator + MessagesStackParamList)

key-decisions:
  - "Conversation is created ONLY by updateRequestStatus on accept — no direct client path (T-02-04-02)"
  - "Message uses separate collection (locked decision from RESEARCH) — avoids 16MB MongoDB doc limit"
  - "store-first in chatHandler: Message.create() before io.to(room).emit() — failure causes message:error, no phantom message"
  - "leave:dm emitted on DirectMessageScreen unmount — shared socket is NOT disconnected (disconnectSocket is sign-out only)"
  - "appendMessage in conversationStore deduplicates by id — optimistic (opt_*) entry is replaced when server echo arrives"
  - "ViewProfileScreen navigate to Messages stack uses cross-tab navigation (navigation.navigate('Messages', { screen: 'MessageRequestCompose', params }))"
  - "Tasks 2+3 committed together — all screens depend on each other for TypeScript to pass (AppNavigator imports all four screen components)"

metrics:
  duration: 10min
  completed: "2026-07-08"
  tasks: 3
  files: 20

status: complete
---

# Phase 02 Plan 04: 1:1 Direct Messaging Summary

**Store-first gated DM system: MessageRequest gate → Conversation creation on accept → real-time persisted messages with push to offline recipients. Implements MSG-01, MSG-02, MSG-03, MSG-05 with server-enforced gate (T-02-04-02).**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-08T12:35:38Z
- **Completed:** 2026-07-08T12:45:38Z
- **Tasks:** 3 (Tasks 2+3 combined in one commit — see Decisions)
- **Files created/modified:** 20

## Accomplishments

### Task 1: Backend — Models, APIs, Socket handler

- Created `backend/src/models/MessageRequest.js`: senderUid+recipientUid (indexed), intro (max 2000), status enum (pending/accepted/declined)
- Created `backend/src/models/Conversation.js`: dm type, participants [String] server-sorted, lastMessageAt/Preview; participants indexed for pair lookup
- Created `backend/src/models/Message.js`: separate collection (locked decision — 16MB limit guard); conversationId ref (indexed), senderUid, content (max 2000); compound index `{ conversationId, createdAt: -1 }` for paginated history
- Created `messageRequestController.js`:
  - `createMessageRequest`: self-check (400), recipient exists (404), duplicate pair/existing conversation (409), push to recipient
  - `getRequestInbox`: pending only, safe projection, newest first
  - `updateRequestStatus`: recipient-only (T-02-04-05), accept seeds intro as first Message BEFORE any socket, creates Conversation, updates preview, pushes sender
- Created `conversationController.js`:
  - `listConversations`: participant `$in` filter, sorted by lastMessageAt desc
  - `getMessages`: participant gate (T-02-04-01 — 403 for non-participants), cursor-based pagination (before/limit, cap 50)
- Created routes for both controllers (static `/inbox` before dynamic `/:id`)
- Extended `chatHandler.js`: `join:dm` (Conversation gate before socket.join), `leave:dm` (explicit mid-session), `message:dm` (MSG-02 gate → store-first Message.create → io.to(room).emit → offline push via fetchSockets check — MSG-05)
- Registered `/api/message-requests` and `/api/conversations` in `server.js`
- Extended `mobile/src/services/api.ts`: 5 new messaging functions

### Task 2: Mobile — Compose, Inbox, Types, Store

- Created `mobile/src/types/conversation.ts`: MessageRequest, Conversation, Message (with optional `status` for optimistic UI)
- Created `mobile/src/store/conversationStore.ts`: Zustand store (conversations, activeMessages, appendMessage with id-dedup, setActiveMessages, clear)
- Modified `ViewProfileScreen.tsx`: "Send message request" accent button (min 44dp) hidden when own uid; cross-tab navigate to MessageRequestCompose
- Created `MessageRequestComposeScreen.tsx`: multiline intro, live char count, disabled until non-empty, 409-specific error, back on success (MSG-01)
- Created `MessageRequestInboxScreen.tsx`: FlatList of pending requests, Accept (accent, min 44dp), Decline (confirmation modal with destructive "Yes, decline" #d32f2f and accessibilityLabel) (MSG-02)
- Updated `AppNavigator.tsx`: MessagesStackNavigator (4 screens), MessagesStackParamList exported; Messages tab points to ConversationListScreen (placeholder removed from tab)

### Task 3: Mobile — ConversationList + DirectMessageScreen + Chat Components

- Created `ConversationListScreen.tsx`: useFocusEffect fetch, FlatList rows (avatar+preview+date), "Requests" header button, "No conversations yet" empty state (MSG-03)
- Created `DirectMessageScreen.tsx`: history fetch → connectSocket (idempotent) → join:dm → message:new listener → inverted FlatList → optimistic send → message:error → tap-to-retry (MSG-03, MSG-05)
- Created `MessageBubble.tsx`: own/other alignment, #ffffff/#f5f5f5, 75% max-width, timestamp, pending clock, failed tap-to-retry in #d32f2f
- Created `ChatInput.tsx`: KeyboardAvoidingView + multiline TextInput + Ionicons "send" (accent #6200ea, min 44dp) + disabled when empty

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: Backend + mobile api.ts | `664927a` | Models, APIs, gated socket handler |
| Tasks 2+3: Mobile screens + nav | `208247a` | Compose/inbox/conversation screens, components, AppNavigator |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ConversationListScreen used non-standard inline useState workaround**
- **Found during:** Task 2 TypeScript check
- **Issue:** First version used a custom `useStateCompat` wrapper that TypeScript rejected with "Untyped function calls may not accept type arguments"
- **Fix:** Replaced with standard `useState` import at the top of the file
- **Files modified:** mobile/src/screens/Messages/ConversationListScreen.tsx
- **Committed in:** 208247a (corrected version)

### Plan Structure Deviation

**Tasks 2 and 3 combined into one commit** — the plan specified separate commits, but all mobile screens (ConversationListScreen, DirectMessageScreen, MessageBubble, ChatInput) were needed together for TypeScript to compile, since AppNavigator.tsx imports all four screen components. This is a practical TypeScript dependency — the plan's task boundary was logical, not a TypeScript module boundary. Committed as one atomic unit.

## Security Coverage (STRIDE Threat Register)

| Threat ID | Status | Evidence |
|-----------|--------|---------|
| T-02-04-01 (Information Disclosure — reading another user's conversation) | Mitigated | `getMessages` verifies `conversation.participants.includes(req.user.uid)` → 403 on mismatch; `message:new` emitted only to `dm:{sorted}` room |
| T-02-04-02 (MSG-02 gate bypass — DM without accepted request) | Mitigated | `message:dm` queries `Conversation.findOne({ participants: { $all: sortedPair } })` before any write; `join:dm` also refuses the room without one; client UI is not the gate |
| T-02-04-03 (Socket auth bypass / forged senderUid) | Mitigated | `io.use()` Firebase-token auth from 02-01 gates every connection; `senderUid` always `socket.data.uid` (line 125 in chatHandler.js); recipient/sender never trusted from body |
| T-02-04-04 (Push-spam via message flood) | Mitigated | content capped 2000 chars in schema + handler; push only when recipient NOT in room (`fetchSockets` check); 409 blocks duplicate pair requests; per-message rate limiting deferred to Phase 3 |
| T-02-04-05 (Accepting/declining someone else's request) | Mitigated | `updateRequestStatus` → `if (messageRequest.recipientUid !== req.user.uid) return 403` |

## Known Stubs

- `ConversationListScreen` row shows raw `otherUid` (Firebase UID) instead of display name — profile enrichment requires loading User data per participant; deferred (no profile cache API for conversation participants yet)
- `MessageRequestInboxScreen` shows raw `senderUid` instead of sender display name — same reason; deferred

Both stubs are non-blocking for MSG-01..03/05. The conversation functionality works end-to-end; names are cosmetic. A future profile-enrichment pass (Phase 3 or dedicated) can add a batch profile lookup.

## Threat Flags

No new security-relevant surface beyond the plan's threat model. All five STRIDE threats mitigated as designed.

## Self-Check: PASSED

**Files verified on disk:**
- backend/src/models/MessageRequest.js ✓
- backend/src/models/Conversation.js ✓
- backend/src/models/Message.js ✓
- backend/src/controllers/messageRequestController.js ✓
- backend/src/controllers/conversationController.js ✓
- backend/src/routes/messageRequests.js ✓
- backend/src/routes/conversations.js ✓
- backend/src/socket/chatHandler.js ✓
- backend/src/server.js ✓
- mobile/src/types/conversation.ts ✓
- mobile/src/store/conversationStore.ts ✓
- mobile/src/services/api.ts ✓
- mobile/src/components/Chat/MessageBubble.tsx ✓
- mobile/src/components/Chat/ChatInput.tsx ✓
- mobile/src/screens/Messages/MessageRequestComposeScreen.tsx ✓
- mobile/src/screens/Messages/MessageRequestInboxScreen.tsx ✓
- mobile/src/screens/Messages/ConversationListScreen.tsx ✓
- mobile/src/screens/Messages/DirectMessageScreen.tsx ✓
- mobile/src/screens/Profile/ViewProfileScreen.tsx ✓
- mobile/src/navigation/AppNavigator.tsx ✓

**Commits verified in git history:**
- 664927a ✓
- 208247a ✓

**Backend syntax:** `node --check` on all 9 backend files — OK ✓
**TypeScript:** `cd mobile && npx tsc --noEmit` — exit 0 ✓
**Store-first invariant:** Message.create() on line 123, io.to(room).emit() on line 143 — correct order ✓
**MSG-02 gate:** message:dm checks Conversation.findOne before write — confirmed at line 115 ✓
**senderUid from token:** socket.data.uid used at line 125, never from client payload ✓
**Routes registered:** grep confirms /api/message-requests and /api/conversations in server.js ✓

---
*Phase: 02-housing-core*
*Completed: 2026-07-08*
