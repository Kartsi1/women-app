---
phase: quick-261013-umq
plan: 01
quick_id: 261013-umq
slug: fix-phone-test-bugs-request-names-profil
mode: quick
created: 2026-10-13
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/services/userSummaryService.js
  - backend/src/controllers/messageRequestController.js
  - backend/src/controllers/conversationController.js
  - backend/src/controllers/userController.js
  - backend/src/socket/chatHandler.js
  - backend/src/server.js
  - Makefile
  - .gitignore
  - mobile/src/types/conversation.ts
  - mobile/src/store/conversationStore.ts
  - mobile/src/services/socketService.ts
  - mobile/src/services/push.ts
  - mobile/src/navigation/AppNavigator.tsx
  - mobile/src/screens/Messages/MessageRequestInboxScreen.tsx
  - mobile/src/screens/Messages/ConversationListScreen.tsx
  - mobile/src/screens/Messages/DirectMessageScreen.tsx
  - mobile/src/screens/Profile/ProfileScreen.tsx
  - mobile/App.tsx
  - mobile/src/navigation/useSafeStackScreenOptions.ts
  - mobile/src/navigation/AuthNavigator.tsx
  - mobile/src/navigation/VerificationNavigator.tsx
  - mobile/src/screens/Housing/MapDiscoveryScreen.tsx
  - mobile/src/components/Map/FilterSheet.tsx
  - mobile/src/screens/Messages/MessageRequestComposeScreen.tsx
  - mobile/src/screens/Messages/CityGroupChatScreen.tsx
  - mobile/src/screens/Housing/CreateListingScreen.tsx
  - mobile/src/screens/Housing/ListingDetailScreen.tsx
  - mobile/src/screens/Auth/DocumentUploadScreen.tsx
  - mobile/src/screens/Community/CommunityFeedScreen.tsx
  - mobile/src/screens/Community/CreatePostScreen.tsx
  - mobile/src/screens/Profile/EditProfileScreen.tsx
  - mobile/src/screens/Profile/ViewProfileScreen.tsx
  - mobile/src/screens/Requests/RequestStatusScreen.tsx
  - mobile/src/screens/Requests/HostInboxScreen.tsx
autonomous: true
requirements: [QUICK-261013-umq]

must_haves:
  truths:
    - "Message request inbox rows show the sender's display name (fallback 'A member') and avatar photo; no raw Firebase UID is visible anywhere on that screen (label, accessibility labels, decline modal)"
    - "Conversation list rows show the other participant's display name, a name-initial (not UID) avatar fallback, and their photo when they have one; the DM screen header shows that name"
    - "Own profile photo renders on ProfileScreen after editing the profile (PUT /api/users/profile returns the same projection as GET /api/users/me, with a signed photoURL) and ProfileScreen refetches on every tab focus"
    - "Sending a DM (or city chat message) shows exactly ONE bubble: the server echo replaces the optimistic 'sending' entry instead of being prepended next to it"
    - "When another member sends a message request while the app is open, the recipient instantly sees a RED circular count badge on the top-right corner of the 'Requests' pill in ConversationListScreen (white bold number, hidden at 0, '9+' above 9), a badge on the Messages tab, and a local system notification 'New message request from <name>'"
    - "The pending-request count is correct after app start, on Messages focus, and after accepting/declining a request"
    - "No screen's top buttons/headers draw under the Android status bar; screens are not double-padded; the Housing map and its floating top bar stay fully visible and tappable"
    - "Firebase emulator data (Auth users + Storage files) survives emulator restarts via --import/--export-on-exit, and the export dir is gitignored"
    - "A fresh release APK is built containing all mobile fixes"
  artifacts:
    - path: "backend/src/services/userSummaryService.js"
      provides: "getUserSummaries(uids) → { [firebaseUid]: { displayName, photoUrl } } with signed photo URLs"
      contains: "getUserSummaries"
    - path: "backend/src/controllers/messageRequestController.js"
      provides: "Inbox enrichment (senderDisplayName/senderPhotoUrl) + message_request:new emit to user:<recipientUid>"
      contains: "message_request:new"
    - path: "backend/src/controllers/conversationController.js"
      provides: "listConversations enrichment (otherUid/otherDisplayName/otherPhotoUrl)"
      contains: "otherDisplayName"
    - path: "backend/src/socket/chatHandler.js"
      provides: "Per-user room join on connection"
      contains: "user:${uid}"
    - path: "mobile/src/store/conversationStore.ts"
      provides: "Optimistic reconcile in appendMessage/appendCityMessage + pendingRequestCount state/actions"
      contains: "pendingRequestCount"
    - path: "mobile/src/navigation/useSafeStackScreenOptions.ts"
      provides: "Shared native-stack screenOptions applying the top safe-area inset"
      contains: "useSafeAreaInsets"
    - path: "mobile/android/app/build/outputs/apk/release/app-release.apk"
      provides: "Rebuilt release APK for sideloading (gitignored build output)"
  key_links:
    - from: "backend/src/server.js"
      to: "backend/src/controllers/messageRequestController.js"
      via: "app.set('io', io) → req.app.get('io')"
      pattern: "app.set\\('io'"
    - from: "backend/src/controllers/messageRequestController.js"
      to: "mobile/src/services/socketService.ts"
      via: "socket event message_request:new on room user:<recipientUid>"
      pattern: "message_request:new"
    - from: "mobile/src/services/socketService.ts"
      to: "mobile/src/store/conversationStore.ts"
      via: "incrementPendingRequestCount() + presentLocalNotification()"
      pattern: "incrementPendingRequestCount"
    - from: "mobile/src/store/conversationStore.ts"
      to: "mobile/src/screens/Messages/ConversationListScreen.tsx"
      via: "pendingRequestCount selector → red badge on Requests pill"
      pattern: "pendingRequestCount"
    - from: "mobile/App.tsx"
      to: "mobile/src/navigation/useSafeStackScreenOptions.ts"
      via: "SafeAreaProvider at root → useSafeAreaInsets in every stack"
      pattern: "SafeAreaProvider"
---

<objective>
Fix the bugs found while testing the release APK on a physical Android phone (PC = LAN server):
1. Message request inbox AND conversation list show Firebase UIDs instead of member names/photos.
2. Own profile photo does not render (raw storage path returned by PUT /api/users/profile; stale screen; emulator storage wiped on restart).
3. Sent DM appears twice until reload (optimistic entry never reconciled with the server echo).
4. Top buttons are untappable because content draws under the Android status bar (edge-to-edge is mandatory on Expo 57 / RN 0.86).
5. No in-app signal for incoming message requests — add a real-time socket path, a red count badge on the "Requests" pill (primary UI requirement), a Messages tab badge, and a local system notification.

Purpose: make the LAN phone build usable end-to-end for the next round of manual testing.
Output: backend enrichment + socket user rooms, mobile UI/store fixes, central safe-area handling, persistent emulator data, rebuilt release APK.

Root causes were already diagnosed by the orchestrator — do NOT re-investigate, implement the fixes below.
</objective>

<execution_context>
@/home/kartsi/PycharmProjects/women-app/.claude/gsd-core/workflows/execute-plan.md
@/home/kartsi/PycharmProjects/women-app/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@.claude/CLAUDE.md
@.planning/quick/261013-tu0-release-apk-for-lan-phone-testing-pc-as-/261013-tu0-SUMMARY.md

Key facts gathered during planning (trust these, avoid re-reading whole files):
- Expo v57 / RN 0.86: edge-to-edge is always on. react-native-safe-area-context ~5.7.0, expo-notifications ~57.0.3, expo-status-bar ~57.0.0 and @react-navigation v7 (native-stack, bottom-tabs) are already installed — NO new packages, NO native config change, so `expo prebuild` is NOT needed.
- expo-notifications v57 (docs.expo.dev/versions/v57.0.0/sdk/notifications): immediate local notification = `scheduleNotificationAsync({ content, trigger: null })`; to target an Android channel immediately use the ChannelAwareTriggerInput shape `trigger: { channelId: 'default' }`. App.tsx already calls `Notifications.setNotificationHandler` (shouldShowBanner/shouldShowList true) so foreground notifications display. push.ts `registerForPushNotifications()` (called from hooks/useFirebaseAuth.ts on login) already creates Android channel 'default' and requests permission BEFORE bailing on the placeholder EAS projectId — reuse that channel + permission; do not touch remote push.
- backend storageService exports `getSignedUrl(path)` (lazy getStorage — safe to require without Firebase init). Pattern to mirror: postController.js lines ~96-105 (batch `User.find({ firebaseUid: { $in } }).select('firebaseUid displayName photoURL').lean()` + per-user try/catch getSignedUrl).
- backend chatHandler.js `io.use` sets `socket.data.uid` from the verified Firebase token; `io.on('connection')` emits 'connected'.
- backend userController.js: `updateProfile` returns the raw User document (`res.json({ data: user })`); `getOwnProfile` builds an explicit projection {uid, displayName, bio, homeCity, photoURL(signed), isVerified, hostsCount, tripsCount, verificationStatus, rejectionReason}.
- mobile conversationStore: `activeMessages` and `cityMessages` are NEWEST-FIRST (new entries are prepended). Optimistic ids: DM `opt_<ts>`, city `opt_city_<ts>`, status 'sending' (flipped to 'failed' on message:error). Server trims content before saving and echoes `message:new` with Mongo `_id`; the screens map that to status 'delivered' and call appendMessage / appendCityMessage.
- mobile socketService.connectSocket() creates the single shared socket (called from AppNavigator useEffect on `user`); RootNavigator calls disconnectSocket() on sign-out.
- MessagesStackParamList.DirectMessage is `{ conversationId; otherUid }`; DirectMessage is navigated to only from ConversationListScreen (navigate) and MessageRequestInboxScreen (replace after accept).
- ConversationListScreen header: "Requests" TouchableOpacity uses styles.inboxButton (light-purple #f3f0ff pill, borderRadius 8) inside a row header with paddingHorizontal 20.
- Many screens carry hard-coded status-bar compensation top padding (48 or 52) — these MUST be reduced once the stack applies the real inset, otherwise screens get double-padded. Exact locations are listed in Task 3.
- `.planning/config.json` has an unrelated user modification — NEVER stage it. Stage files explicitly by path for every commit. commit_docs is false.
- Do NOT restart the running backend or emulators: nodemon hot-reloads the backend; the Makefile change applies on the next emulator start.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Backend — name/photo enrichment, own-profile projection, per-user socket room + request emit, persistent emulator data</name>
  <files>backend/src/services/userSummaryService.js, backend/src/controllers/messageRequestController.js, backend/src/controllers/conversationController.js, backend/src/controllers/userController.js, backend/src/socket/chatHandler.js, backend/src/server.js, Makefile, .gitignore</files>
  <action>
1. Create backend/src/services/userSummaryService.js (CommonJS, 2-space, semicolons) exporting `getUserSummaries(uids)`: dedupe + drop falsy uids; return {} early when empty; query `User.find({ firebaseUid: { $in: unique } }).select('firebaseUid displayName photoURL').lean()` (explicit projection — never return other User fields); for each user resolve `photoUrl` via `getSignedUrl(user.photoURL)` from './storageService' inside try/catch (failure → null); return a plain object keyed by firebaseUid → `{ displayName: user.displayName || null, photoUrl }`. Short JSDoc noting it mirrors the postController author join.

2. messageRequestController.js:
   - getRequestInbox: keep the same filter, projection and sort, add `.lean()`, call getUserSummaries on the rows' senderUid values, and return each row spread with `senderDisplayName` (summary displayName or null) and `senderPhotoUrl` (summary photoUrl or null). `_id` stays in each row (the client maps `_id` → id). Update the JSDoc success-response line.
   - createMessageRequest: right after `MessageRequest.create(...)` and BEFORE the existing `sendPushNotification` call, emit the real-time event inside its own try/catch so a socket failure can never turn the 201 into a 500: look up the sender with `User.findOne({ firebaseUid: senderUid }).select('displayName').lean()`, then `const io = req.app.get('io');` and if io exists, `io.to(\`user:${recipientUid}\`).emit('message_request:new', { requestId: messageRequest._id.toString(), senderUid, senderDisplayName: sender?.displayName || null, intro: messageRequest.intro.slice(0, 140) })`. senderUid/recipientUid already come from the verified token / validated recipient lookup — keep that. Leave the remote push call exactly as is (it cannot work in the LAN setup, intentionally untouched).

3. conversationController.js listConversations: same query/projection/sort plus `.lean()`; per conversation compute `otherUid = participants.find((p) => p !== req.user.uid) || null`; one getUserSummaries call over all otherUids; return rows spread with `otherUid`, `otherDisplayName`, `otherPhotoUrl` (null fallbacks). Update the JSDoc row description.

4. userController.js: extract a module-level async helper `buildOwnProfileData(user)` that returns exactly the projection getOwnProfile builds today (signed photoURL via getSignedUrl, verificationStatus, rejectionReason ?? null, etc.). Make getOwnProfile use it, and change updateProfile to respond `{ data: await buildOwnProfileData(user) }` instead of the raw document. This fixes the broken own-profile Image (raw storage path was being stored in profileStore) and stops returning private fields (email, verification doc paths, blockedUsers, expoPushToken). Validation logic is unchanged.

5. chatHandler.js: in `io.on('connection')`, immediately after reading uid, call `socket.join(\`user:${uid}\`)` with a comment: per-user room for server-pushed events (message_request:new); uid comes from the verified token in io.use so a client can only ever be in its own user room — no client-facing join event is added. Add a line about it to the top-of-file JSDoc.

6. server.js: right after `const io = new Server(...)`, add `app.set('io', io);` with a one-line comment (controllers emit via req.app.get('io')).

7. Root Makefile:
   - emulators target: `mkdir -p .firebase-emulator-data` then `npx -y firebase-tools emulators:start --import=./.firebase-emulator-data --export-on-exit` (two recipe lines, or joined with &&).
   - dev target: the emulators subshell becomes `( mkdir -p .firebase-emulator-data && npx -y firebase-tools emulators:start --import=./.firebase-emulator-data --export-on-exit ) &`.
   - Update the header comment / help text line for emulators to mention that data persists in .firebase-emulator-data/ (export on exit, import on start). mkdir -p is required because --import must point at an existing directory.
8. Root .gitignore: append `.firebase-emulator-data/` (it contains emulator Auth users and uploaded verification ID photos — must never be committed).

Do not restart backend/emulators. Commit (stage these 8 paths explicitly, never .planning/config.json): `fix(backend): enrich request inbox + conversations with member names, own-profile projection on update, user socket room for message requests`.
  </action>
  <verify>
    <automated>cd /home/kartsi/PycharmProjects/women-app/backend && for f in src/services/userSummaryService.js src/controllers/messageRequestController.js src/controllers/conversationController.js src/controllers/userController.js src/socket/chatHandler.js src/server.js; do node --check "$f" || exit 1; done && node -e "const s=require('./src/services/userSummaryService'); if(typeof s.getUserSummaries!=='function') process.exit(1); require('./src/controllers/messageRequestController'); require('./src/controllers/conversationController'); require('./src/controllers/userController'); console.log('require-ok')" && grep -q "message_request:new" src/controllers/messageRequestController.js && grep -q "app.set('io'" src/server.js && grep -q 'user:${uid}' src/socket/chatHandler.js && grep -q "otherDisplayName" src/controllers/conversationController.js && grep -q "senderDisplayName" src/controllers/messageRequestController.js && cd .. && make -n emulators | grep -q -- "--import=./.firebase-emulator-data --export-on-exit" && make -n dev | grep -q -- "--export-on-exit" && git check-ignore -q .firebase-emulator-data/ && (curl -sf http://localhost:3000/health || echo "backend not running locally - skipped health check")</automated>
  </verify>
  <done>All changed backend files pass node --check and load via require without listening; GET /api/message-requests/inbox rows carry senderDisplayName/senderPhotoUrl; GET /api/conversations rows carry otherUid/otherDisplayName/otherPhotoUrl; PUT /api/users/profile returns the same projection as GET /api/users/me (signed photoURL, no private fields); every authenticated socket joins `user:<uid>`; creating a message request emits `message_request:new` to the recipient's room without affecting the 201 response; `make emulators` / `make dev` start the emulators with --import/--export-on-exit after mkdir -p; `.firebase-emulator-data/` is gitignored; nodemon reloaded the running backend without crashing (health check OK if it is running).</done>
</task>

<task type="auto">
  <name>Task 2: Mobile — names/avatars, red request badge + tab badge + local notification, DM/city duplicate fix, profile refresh on focus</name>
  <files>mobile/src/types/conversation.ts, mobile/src/store/conversationStore.ts, mobile/src/services/push.ts, mobile/src/services/socketService.ts, mobile/src/navigation/AppNavigator.tsx, mobile/src/screens/Messages/MessageRequestInboxScreen.tsx, mobile/src/screens/Messages/ConversationListScreen.tsx, mobile/src/screens/Messages/DirectMessageScreen.tsx, mobile/src/screens/Profile/ProfileScreen.tsx</files>
  <action>
A. Types (mobile/src/types/conversation.ts): add optional `senderDisplayName?: string | null` and `senderPhotoUrl?: string | null` to MessageRequest; add optional `otherUid?: string`, `otherDisplayName?: string | null`, `otherPhotoUrl?: string | null` to Conversation. Update the doc comments (server-enriched fields).

B. conversationStore.ts:
   1. Duplicate fix — add a module-level pure helper (e.g. `mergeIncoming(list, message)`) used by BOTH appendMessage and appendCityMessage: (a) if an entry with the same id exists, replace it in place (current behaviour); (b) else, if the incoming id does NOT start with the optimistic prefix 'opt_' (i.e. it is a server echo), look for optimistic entries whose id starts with 'opt_', whose status is 'sending' or 'failed', whose senderUid equals the incoming senderUid, and whose content trimmed equals the incoming content trimmed (the server trims before saving); because lists are newest-first, pick the OLDEST such entry = the match with the highest index (use a manual reverse for-loop, not findLastIndex), and replace it in place with the incoming message; (c) otherwise prepend. Update the store's header comment to describe the reconcile. The screens' existing message:new listeners already pass status 'delivered' — DirectMessageScreen/CityGroupChatScreen listener code needs no change for this.
   2. Request count — add `pendingRequestCount: number` (initial 0), `setPendingRequestCount(n)`, `incrementPendingRequestCount()`, and `refreshPendingRequestCount(): Promise<void>` which calls `getMessageRequestInbox()` from '../services/api' and sets the count to the returned data array length (ignore errors — keep previous value). `clear()` also resets pendingRequestCount to 0.

C. push.ts: add exported `presentLocalNotification(title: string, body: string, data?: Record<string, unknown>): Promise<void>` — wrapped in try/catch (log + swallow); on Android ensure the 'default' channel exists (same setNotificationChannelAsync call/params already used in registerForPushNotifications — factor it into a small shared `ensureDefaultChannel()` used by both); check `getPermissionsAsync()` and return silently if not granted (do NOT prompt here — permission is requested at login); then `Notifications.scheduleNotificationAsync({ content: { title, body, data }, trigger: Platform.OS === 'android' ? { channelId: 'default' } : null })`.

D. socketService.ts: in connectSocket(), next to the existing 'connected' handler on the freshly created socket, register ONE global listener `socket.on('message_request:new', ...)` (this is the single global registration point — no per-screen listeners): call `useConversationStore.getState().incrementPendingRequestCount()` and `presentLocalNotification('New message request', \`New message request from ${payload.senderDisplayName || 'a member'}\`, { type: 'message_request', requestId: payload.requestId })`. Type the payload inline ({ requestId: string; senderUid: string; senderDisplayName: string | null; intro: string }).

E. AppNavigator.tsx:
   - MessagesStackParamList.DirectMessage becomes `{ conversationId: string; otherUid: string; otherName?: string }`.
   - In the existing `user` useEffect, after connectSocket() is kicked off, also call `useConversationStore.getState().refreshPendingRequestCount()` (initial count once the verified shell mounts).
   - Read `const pendingRequestCount = useConversationStore((s) => s.pendingRequestCount);` in AppNavigator and set on the Messages Tab.Screen options: `tabBarBadge: pendingRequestCount > 0 ? (pendingRequestCount > 9 ? '9+' : pendingRequestCount) : undefined` and `tabBarBadgeStyle: { backgroundColor: '#d32f2f', color: '#fff' }`.

F. ConversationListScreen.tsx:
   - PRIMARY UI REQUIREMENT (user spec): on the "Requests" pill (styles.inboxButton) render a RED circular badge with the pending count as an absolutely positioned child overlapping the pill's top-right corner — new styles e.g. `requestBadge` { position: 'absolute', top: -7, right: -7, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: '#d32f2f', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' } and `requestBadgeText` { color: '#fff', fontSize: 11, fontWeight: '700' }. Text is '9+' when count > 9, otherwise the number. Render nothing when count is 0. Make sure inboxButton keeps overflow visible (add `overflow: 'visible'`) so the badge is not clipped. Count comes from `useConversationStore((s) => s.pendingRequestCount)`. Update the button accessibilityLabel to include the count when > 0 (e.g. "Open message requests inbox, 3 pending").
   - In the existing useFocusEffect, also call refreshPendingRequestCount() (store action).
   - Map the new server fields in loadConversations (otherUid with fallback to the existing getOtherUid logic, otherDisplayName, otherPhotoUrl).
   - Row rendering: title = otherDisplayName || 'A member'; avatar = Image with `source={{ uri: mediaUri(item.otherPhotoUrl) }}` (import mediaUri from '../../utils/media', Image from react-native; add an `avatarImage` style with the same size/borderRadius as styles.avatar) when otherPhotoUrl is set, otherwise the existing avatar circle showing the FIRST LETTER of the display name uppercased ('?' when no name) — remove the two-letter UID-derived initials; accessibilityLabel uses the name; navigate to DirectMessage with `{ conversationId, otherUid, otherName: item.otherDisplayName ?? undefined }`.

G. MessageRequestInboxScreen.tsx:
   - Map senderDisplayName / senderPhotoUrl in loadInbox; after mapping call `useConversationStore.getState().setPendingRequestCount(mapped.length)` so the badge matches the inbox (this also covers decline, which already reloads the inbox).
   - After a successful accept (conversationId returned) call `refreshPendingRequestCount()` before `navigation.replace`, and pass `otherName: request.senderDisplayName ?? undefined` in the DirectMessage params.
   - Card: add a small avatar (36px circle — Image via mediaUri(senderPhotoUrl) or initial-letter fallback) next to the sender name; the visible label, BOTH Accept/Decline accessibilityLabels and the decline-confirmation modal text must use `item.senderDisplayName || 'A member'` (declineTarget for the modal). The raw sender UID must no longer be rendered anywhere in JSX or labels — it stays only in the data mapping and as the DirectMessage otherUid param. Update the header doc comment (remove the "placeholder until profile-enriched" note).

H. DirectMessageScreen.tsx: read `otherName` from route.params; header right-side text shows otherName when present, otherwise the existing 'View profile' text; accessibilityLabel `View ${otherName ?? 'member'} profile`. No other change (dedupe is handled in the store).

I. ProfileScreen.tsx: replace the mount-only `useEffect(() => { loadProfile(); loadReviews(); }, [])` with `useFocusEffect(useCallback(() => { loadProfile(); loadReviews(); }, []))` (import from '@react-navigation/native' / 'react') so the profile and its 15-minute signed photo URL refresh every time the tab regains focus. If the render shows a full-screen spinner whenever `loading` is true, only show it when no profile is loaded yet, so refocus does not flash a spinner. EditProfileScreen needs no change: the backend PUT now returns the same projection as GET /me (Task 1), and returning to ProfileScreen refetches anyway.

Run `npx tsc --noEmit` in mobile/ and fix all errors. Commit (explicit paths only): `fix(mobile): member names in requests/conversations, request badge + local notification, dedupe optimistic messages, refresh profile on focus`.
  </action>
  <verify>
    <automated>cd /home/kartsi/PycharmProjects/women-app/mobile && npx tsc --noEmit && test "$(grep -c 'senderUid}' src/screens/Messages/MessageRequestInboxScreen.tsx)" = "0" && test "$(grep -c 'otherUid.slice' src/screens/Messages/ConversationListScreen.tsx)" = "0" && grep -q "pendingRequestCount" src/store/conversationStore.ts && grep -q "pendingRequestCount" src/navigation/AppNavigator.tsx && grep -q "tabBarBadge" src/navigation/AppNavigator.tsx && grep -q "pendingRequestCount" src/screens/Messages/ConversationListScreen.tsx && grep -q "'9+'" src/screens/Messages/ConversationListScreen.tsx && grep -q "#d32f2f" src/screens/Messages/ConversationListScreen.tsx && grep -q "message_request:new" src/services/socketService.ts && grep -q "scheduleNotificationAsync" src/services/push.ts && grep -q "useFocusEffect" src/screens/Profile/ProfileScreen.tsx && grep -q "otherName" src/screens/Messages/DirectMessageScreen.tsx && grep -q "mediaUri" src/screens/Messages/MessageRequestInboxScreen.tsx && grep -q "mediaUri" src/screens/Messages/ConversationListScreen.tsx</automated>
  </verify>
  <done>tsc passes with zero errors; inbox and conversation list render display names + photo/initial avatars with no UID text; DM header shows the member name; appendMessage/appendCityMessage replace the oldest matching optimistic entry with the server echo (one bubble per send); a single global socket listener increments pendingRequestCount and shows a local notification; the Requests pill shows a red top-right corner badge (white bold count, hidden at 0, '9+' over 9) and the Messages tab shows a matching badge; count refreshes on shell mount, on Messages focus and after accept/decline; ProfileScreen reloads on every focus.</done>
</task>

<task type="auto">
  <name>Task 3: Mobile — central top safe-area inset for all stacks, remove status-bar padding hacks, rebuild release APK</name>
  <files>mobile/App.tsx, mobile/src/navigation/useSafeStackScreenOptions.ts, mobile/src/navigation/AppNavigator.tsx, mobile/src/navigation/AuthNavigator.tsx, mobile/src/navigation/VerificationNavigator.tsx, mobile/src/screens/Housing/MapDiscoveryScreen.tsx, mobile/src/components/Map/FilterSheet.tsx, mobile/src/screens/Messages/MessageRequestComposeScreen.tsx, mobile/src/screens/Messages/CityGroupChatScreen.tsx, mobile/src/screens/Messages/ConversationListScreen.tsx, mobile/src/screens/Housing/CreateListingScreen.tsx, mobile/src/screens/Housing/ListingDetailScreen.tsx, mobile/src/screens/Auth/DocumentUploadScreen.tsx, mobile/src/screens/Community/CommunityFeedScreen.tsx, mobile/src/screens/Community/CreatePostScreen.tsx, mobile/src/screens/Profile/ProfileScreen.tsx, mobile/src/screens/Profile/EditProfileScreen.tsx, mobile/src/screens/Profile/ViewProfileScreen.tsx, mobile/src/screens/Requests/RequestStatusScreen.tsx, mobile/src/screens/Requests/HostInboxScreen.tsx</files>
  <action>
Expo 57 / RN 0.86 always render edge-to-edge, and every stack uses headerShown false, so screens draw from y=0 under the status bar. Fix it centrally (no per-screen wrappers):

1. App.tsx: wrap the tree in `SafeAreaProvider` from 'react-native-safe-area-context' and render `<StatusBar style="dark" />` from 'expo-status-bar' inside it (dark icons on the white top area). Keep the module-scope setNotificationHandler and useFirebaseAuth() exactly as they are.

2. New mobile/src/navigation/useSafeStackScreenOptions.ts: export `useSafeStackScreenOptions(): NativeStackNavigationOptions` (type from '@react-navigation/native-stack') that reads `useSafeAreaInsets()` and returns (memoised on insets.top) `{ headerShown: false, contentStyle: { paddingTop: insets.top, backgroundColor: '#fff' } }`. Short comment explaining edge-to-edge and that the bottom tab bar already handles the bottom inset. If on-device testing showed contentStyle not applying, the fallback is the v7 navigator `screenLayout` prop wrapping children in a View with the same paddingTop — use contentStyle first.

3. Use it as `screenOptions` in all six native stacks: HousingStackNavigator, MessagesStackNavigator, CommunityStackNavigator, ProfileStackNavigator (AppNavigator.tsx — call the hook inside each navigator function component), AuthNavigator (keep initialRouteName="SignIn"), and VerificationNavigator — there the hook MUST be called at the top of the component, before the existing early return that renders the loading spinner (rules of hooks). Leave the bottom Tab.Navigator screenOptions untouched apart from what Task 2 added.

4. Remove the now-double status-bar compensation. Change the hard-coded top padding of 48 / 52 to 12 in these styles (they sit at the top of a screen that the stack now insets):
   - container styles (48 → 12): MessageRequestComposeScreen, CreateListingScreen, DocumentUploadScreen, ProfileScreen, EditProfileScreen, ViewProfileScreen
   - header-type styles (48/52 → 12): CommunityFeedScreen `header`, ListingDetailScreen `headerBackButton`, RequestStatusScreen `headerBack`, HostInboxScreen `header`, CreatePostScreen `navHeader`, ConversationListScreen `header`, CityGroupChatScreen `header`
   Leave CityGroupChatScreen `emptyState` top padding of 60 alone (vertical centering, not a status-bar hack). Do not touch any other style.

5. MapDiscoveryScreen.tsx: the three usages of the react-native safe-area view component (location-error state ~line 151, loading state ~line 168, floating top bar ~line 211) become plain `View` (keep their styles and `pointerEvents="box-none"` on the top bar) and remove that component from the react-native import. It is a no-op on Android and would double-pad on iOS now that the stack applies the inset. The map keeps StyleSheet.absoluteFill and the top bar keeps `top: 0` — both are now relative to the inset content area, so the map starts just below the status bar and the "Find housing" / Filter bar is fully tappable.
<!-- planner-discipline-allow: SafeAreaView -->
   FilterSheet.tsx: replace the react-native SafeAreaView sheet container with a plain `View` and apply the bottom inset from `useSafeAreaInsets()` (paddingBottom: Math.max(existing sheet bottom padding, insets.bottom) — read styles.sheet for the existing value) so the Apply button clears the Android gesture/navigation bar; remove SafeAreaView from the react-native import.

6. Run `npx tsc --noEmit`, then commit (explicit paths only, never .planning/config.json): `fix(mobile): apply top safe-area inset centrally for edge-to-edge Android, drop status-bar padding hacks`.

7. Rebuild the release APK (no native config changed → NO prebuild). Export the two values from mobile/.env (EXPO_PUBLIC_API_BASE_URL — the LAN URL — and EXPO_PUBLIC_USE_EMULATORS=true) and run, from mobile/android: `EXPO_PUBLIC_API_BASE_URL=<value from mobile/.env> EXPO_PUBLIC_USE_EMULATORS=true ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a --no-daemon` (same invocation that worked in quick task 261013-tu0). The build takes several minutes — use a 600000 ms timeout or run it in the background and wait for completion. Confirm app-release.apk has a fresh modification time. android/ and the APK are gitignored — nothing to commit from the build.
  </action>
  <verify>
    <automated>cd /home/kartsi/PycharmProjects/women-app/mobile && npx tsc --noEmit && grep -q "SafeAreaProvider" App.tsx && grep -q "useSafeAreaInsets" src/navigation/useSafeStackScreenOptions.ts && test "$(grep -c 'useSafeStackScreenOptions()' src/navigation/AppNavigator.tsx)" -ge 4 && grep -q "useSafeStackScreenOptions()" src/navigation/AuthNavigator.tsx && grep -q "useSafeStackScreenOptions()" src/navigation/VerificationNavigator.tsx && test "$(grep -c 'SafeAreaView' src/screens/Housing/MapDiscoveryScreen.tsx)" = "0" && test "$(grep -c 'SafeAreaView' src/components/Map/FilterSheet.tsx)" = "0" && test "$(grep -rnE 'paddingTop: (48|52),' src/screens | wc -l)" = "0" && test -n "$(find android/app/build/outputs/apk/release/app-release.apk -mmin -60 2>/dev/null)" && echo APK-fresh</automated>
    <human-check>Install the APK on the phone (adb install -r .../app-release.apk), then: (1) every screen's top header/back/Requests/Filter buttons sit below the status bar and are tappable; no screen has an oversized top gap; Housing map is visible with the top bar fully tappable. (2) From a second account send a message request → red badge with count appears on the Requests pill top-right corner, Messages tab shows a badge, and a system notification "New message request from <name>" appears. (3) Inbox and conversation list show names/photos, not UIDs; DM header shows the name. (4) Sending a DM shows one bubble. (5) Re-upload own profile photo once (old emulator files were wiped) → it shows on Profile and still shows after switching tabs and coming back.</human-check>
  </verify>
  <done>SafeAreaProvider wraps the app; all six native stacks apply the top inset via the shared hook; the 13 hard-coded status-bar paddings are reduced to 12; MapDiscoveryScreen/FilterSheet no longer use the react-native safe-area view (FilterSheet pads the bottom inset); tsc passes; a fresh app-release.apk exists in mobile/android/app/build/outputs/apk/release/.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| mobile → REST API | Inbox / conversations / profile responses now carry other members' names + signed photo URLs |
| mobile → Socket.io | Authenticated socket now auto-joins a per-user room that receives server-pushed request events |
| server → device notification | Socket payload text (name, intro) is rendered into a local system notification |
| repo → git remote | Emulator export directory holds emulator Auth users and uploaded verification ID photos |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-umq-01 | Information disclosure | userSummaryService.getUserSummaries (inbox + conversations enrichment) | medium | mitigate | Explicit `.select('firebaseUid displayName photoURL')` projection; only returned to the request recipient (existing recipientUid filter) or a conversation participant (existing participants filter); photo exposed only as a short-lived signed URL |
| T-umq-02 | Spoofing / Elevation | chatHandler per-user room `user:<uid>` | high | mitigate | Room name built server-side from `socket.data.uid` set by the Firebase-token io.use middleware (verified + isVerified claim); no client-callable join event exists, so a client cannot subscribe to another user's room |
| T-umq-03 | Information disclosure | userController.updateProfile response | medium | mitigate | Replace raw User document response with buildOwnProfileData projection (drops email, verification doc paths, blockedUsers, expoPushToken) |
| T-umq-04 | Tampering | message_request:new payload → local notification | low | mitigate | senderUid/senderDisplayName taken from the verified token + DB, never the client body; intro truncated to 140 chars server-side; notification renders plain text only |
| T-umq-05 | Information disclosure | .firebase-emulator-data/ (emulator users + verification ID photos) | high | mitigate | Added to root .gitignore; verified with `git check-ignore`; executor stages files by explicit path only |
| T-umq-06 | Denial of service | Request notification spam | low | accept | Existing 409 guard allows only one pending/accepted request per pair; local notification only fires while the app holds a live socket |
| T-umq-07 | Tampering | Client optimistic-message reconcile | low | accept | Display-only client state; server remains source of truth and a reload restores the canonical list |
</threat_model>

<verification>
- Backend: node --check + require smoke on all changed backend files; grep gates for the emit, io registration, user room, enrichment fields; `make -n` shows --import/--export-on-exit; `.firebase-emulator-data/` ignored.
- Mobile: `npx tsc --noEmit` clean after Task 2 and Task 3; grep gates confirm no UID rendering, badge logic, socket listener, focus refresh, central inset, no padding hacks.
- APK rebuilt (fresh mtime) — no prebuild needed (no native config change).
- End-of-phase human check on the phone (Task 3 human-check list).
- `.planning/config.json` never staged (check `git show --stat` of each commit).
</verification>

<success_criteria>
- All 5 reported bugs plus the conversation-list UID bug are fixed in code and covered by the automated gates above.
- The red corner badge on the Requests pill (primary requirement), the Messages tab badge and the local notification all appear when a request arrives in real time.
- A new release APK is ready to sideload.
- SUMMARY tells the user: (1) previously uploaded profile photos were lost when the in-memory Storage emulator restarted — re-upload once; (2) restart emulators via `make emulators` / `make dev` (Ctrl+C exports data) to activate persistence; (3) remote push is still intentionally inactive in the LAN setup (placeholder EAS projectId) — the in-app path is socket + local notification while the app is open.
</success_criteria>

<output>
Create `.planning/quick/261013-umq-fix-phone-test-bugs-request-names-profil/261013-umq-SUMMARY.md` when done
</output>
