# Domain Pitfalls

**Domain:** Women-only safety / housing / community mobile platform
**Researched:** 2026-07-02
**Confidence note:** Tool access was restricted to file reads only during this research session. All findings are from training knowledge (pre-August 2025 cutoff) synthesized from Expo/Firebase/MongoDB official docs, Socket.io architecture post-mortems, and documented failures of analogous platforms (Couchsurfing, HER, Bumble BFF, Airbnb). Technical claims are HIGH confidence; domain-specific trust/safety patterns are MEDIUM confidence where platform-specific evidence is limited.

---

## Critical Pitfalls

Mistakes that cause rewrites, safety incidents, or platform-destroying trust collapse.

---

### Pitfall 1: Verification Bottleneck Kills Day-1 Retention

**What goes wrong:** Manual ID document review becomes the critical path between signup and first value. If review takes more than 4-6 hours, the majority of new users churn before their account is unlocked — they signed up when motivated, came back to find themselves in a queue, and left. The platform dies before it grows.

**Why it happens:** Founders underestimate review volume. 100 signups per day = 100 ID images to manually inspect. At 5 minutes per review, that is 8+ hours of moderator time, daily, before doing anything else. It compounds: backlogs grow on weekends and holidays.

**Consequences:** Low activation rate makes the core metric ("verified users who find housing or community within 7 days") structurally impossible to hit. Churn before onboarding = no data on what works.

**Prevention:**
- Build the admin moderation panel in Phase 1, not Phase 3. It is as critical as user signup itself.
- Set a target: 90% of submissions reviewed within 2 hours during launch window.
- Use a queue dashboard with the submission timestamp visible so moderators can triage by age.
- Design the ID upload UX to maximize image quality on the first attempt (camera overlay, lighting instructions) — blurry/cropped submissions require a re-request cycle that doubles review time.
- Plan for a staged launch (invite-only beta with 50 users) to calibrate review capacity before opening signups.

**Detection (warning signs):**
- "Pending" user count in the database growing faster than "verified" count.
- Signup-to-verified conversion rate below 60% after 48 hours.
- Support messages: "I signed up but my account is not approved."

**Phase mapping:** Must be solved in Phase 1 (Auth + Verification). The admin panel is not optional infrastructure — it is a launch blocker.

---

### Pitfall 2: Gender Verification Bypass Methods

**What goes wrong:** Men gain access to a women-only space by bypassing the ID document check. This is the platform's existential risk: one credible safety incident destroys user trust permanently.

**Why it happens:** Common bypass vectors:
1. **Partner/family ID submission** — submits an ID photo of a female partner, sister, or mother. The face in the selfie does not match the ID, but if the reviewer is not checking carefully, it passes.
2. **Cropped/partial ID** — submits a document where the photo is obscured or cut off. Reviewer approves because the name is female.
3. **Account transfer** — a legitimate verified female account is sold or handed to a male. Platform has no mechanism to detect post-verification account change.
4. **Name-only gaming** — in countries where gender is not on ID documents, a male name that is gender-ambiguous passes review.

**Consequences:** A safety incident where a male user found a woman's address through the housing listing. Legal liability. Platform-destroying press coverage. Mass user exodus.

**Prevention:**
- The review protocol must require: (a) ID document with visible face photo, (b) a live selfie submitted alongside the ID for face-match check, (c) the reviewer explicitly comparing the two before approving.
- Document your review criteria in a written moderation checklist — not just "check if female," but specific instructions for handling edge cases.
- Add a "flag for secondary review" option so uncertain cases go to a second reviewer, not defaulting to approval.
- For countries where gender is not on national ID: accept alternative documents (passport, healthcare card) and use the face-match check as the primary signal.
- Monitor for post-verification anomalies: account that was verified by one email but now logs in from a very different device/location pattern.
- Re-verification trigger: if a user changes their profile photo to something that looks visually very different from their ID selfie, flag for review.

**Detection (warning signs):**
- Reports from users of "a man in the group chat" or "I felt unsafe with this host."
- Admin notices ID submissions where selfie and document face do not match, but the account was approved anyway (indicates reviewer fatigue/carelessness).

**Phase mapping:** Review protocol design is Phase 1. Secondary review workflow can be Phase 2. Post-verification monitoring is Phase 3+.

---

### Pitfall 3: Socket.io Room Leaks and Zombie Connections

**What goes wrong:** Server-side Socket.io rooms grow unbounded. Every time a user joins a city group chat, their socket is added to that room. When they disconnect (background app, network loss), the socket is not cleaned up from the room because the `disconnect` event does not automatically fire a `leave` call for named rooms. Over days of operation, rooms accumulate thousands of dead socket entries. Memory grows, broadcast performance degrades.

**Why it happens:** Default Socket.io behavior: sockets leave the default room on disconnect, but named rooms (your city chat rooms) are only left if you explicitly call `socket.leave()`. On mobile, disconnect events arrive late or not at all due to TCP keepalive timeouts.

**Specific failure on mobile:** Mobile apps disconnect/reconnect constantly (subway, elevator, screen lock). Each reconnect creates a NEW socket, but the old socket's room memberships persist until the server-side timeout fires. A user who commutes for 30 minutes may accumulate 10+ zombie socket entries in every city room they joined.

**Consequences:** At 1,000 active users × 5 city rooms each = 5,000 room entries growing. After one week without cleanup, broadcasts to a room with 100 real listeners fan out to 800+ dead sockets. Memory leak causes server restarts. Messages missed during the restart gap.

**Prevention:**
- On every `disconnect` event, look up all rooms the socket was in and explicitly call `socket.leave(room)` for each:
```javascript
socket.on('disconnect', () => {
  const rooms = [...socket.rooms];
  rooms.forEach(room => {
    if (room !== socket.id) socket.leave(room);
  });
});
```
- Track `userId → Set<socketId>` in a server-side Map. On new connection from the same userId, check if old socket is still in rooms and clean up.
- Use Redis adapter (`@socket.io/redis-adapter`) from day one even with a single server — it enforces proper room accounting and is required the moment you scale to two server instances.
- Set aggressive ping/timeout values for mobile: `pingInterval: 10000, pingTimeout: 5000` instead of defaults (25000/5000) so dead connections are detected in 15 seconds, not 30+.
- City group chats: only subscribe the user to a city room when they navigate to that screen. Unsubscribe when they leave. Do not subscribe all users to all their cities on connection — this is the fastest path to the fanout explosion.

**Detection (warning signs):**
- `io.sockets.adapter.rooms` size growing monotonically (add a /admin/metrics endpoint that reports room sizes).
- Server memory increasing over time without increasing user count.
- Broadcast latency increasing (>100ms for a room with supposedly <100 members).

**Phase mapping:** Phase 2 (Real-time Chat MVP). Must be designed correctly from the first chat implementation — retrofitting room management is painful.

---

### Pitfall 4: Message Delivery Guarantee Theater

**What goes wrong:** The server emits the message to the room, the client UI shows it as "sent," but the message was never written to MongoDB. If the server process crashes between `io.to(room).emit()` and the `await Message.create()`, the message is silently lost. No error is shown. Users notice the other person "didn't respond" to a message they definitely sent.

**Why it happens:** Developers emit first because it feels faster (optimistic UI). The database write is treated as a secondary concern. Under any server pressure (restart, crash, OOM), the async gap becomes message loss.

**Consequences:** Lost messages in a housing coordination context are trust-breaking. "I sent her my address and she never showed up" when in reality the message was lost. Safety implications.

**Prevention:**
- Canonical ordering: **store first, emit after.**
```javascript
// WRONG
socket.on('message', async (data) => {
  io.to(room).emit('message', data);       // emit first
  await Message.create(data);              // store second — loss if crash here
});

// CORRECT
socket.on('message', async (data) => {
  const saved = await Message.create(data); // store first
  io.to(room).emit('message', saved);       // emit after confirmed write
});
```
- Add a message status field: `{ status: 'sent' | 'delivered' | 'read' }`. `sent` = stored in DB. `delivered` = recipient's socket received the emit and ACKed.
- Implement Socket.io acknowledgements: `socket.emit('message', data, (ack) => { /* update status to delivered */ })`. Without this, "delivered" is just a guess.
- On reconnect, fetch messages since last seen timestamp before rendering the chat. This is the catch-net for any in-flight messages lost during disconnect.

**Detection (warning signs):**
- Users reporting "messages I sent are gone."
- DB message count and "messages sent" counter in your analytics diverge.

**Phase mapping:** Phase 2 (Chat). Non-negotiable from first chat implementation.

---

### Pitfall 5: Firebase Auth Persistence Loss on App Restart

**What goes wrong:** The Firebase Web SDK's default auth persistence uses `localStorage`, which does not exist in React Native. If you initialize Firebase with `getAuth(app)` without explicitly configuring persistence, auth state is stored in memory only. Every app restart = user is logged out. Users think the app is broken.

**Why it happens:** The official Firebase JS SDK docs are written for web. The React Native setup requires an additional step that is easy to miss.

**Specific code failure:**
```javascript
// WRONG — loses auth state on restart
const auth = getAuth(app);

// CORRECT — persists auth state
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
```

**Consequences:** Users must log in every time the app is opened. In a housing platform context, they also lose the verification flow state. Support load spikes. Users abandon the app.

**Detection (warning signs):**
- Users reporting "I keep getting logged out."
- Testing: close app from recent apps, reopen — if login screen appears, persistence is not configured.

**Phase mapping:** Phase 1 (Auth). This must be correct before any other feature is built.

---

### Pitfall 6: Firebase ID Token Expiry Breaking Backend API Calls

**What goes wrong:** Firebase ID tokens expire after exactly 1 hour. If your backend validates Firebase tokens (`admin.auth().verifyIdToken(token)`), an API call made after 60 minutes of idle returns 401. The mobile app has no retry/refresh logic, so the user sees an error or a white screen instead of their chat or listings.

**Why it happens:** Developers test with tokens that are minutes old. The 1-hour expiry only surfaces in production when real users leave the app idle (notifications, cooking dinner, etc.) and return.

**Prevention:**
- Always call `await user.getIdToken()` (not `user.getIdToken(false)`) before each backend API request. The SDK auto-refreshes when less than 5 minutes remain.
- Create a single `getAuthHeader()` helper that all API service calls go through:
```javascript
async function getAuthHeader() {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```
- On the backend, if `verifyIdToken` throws `auth/id-token-expired`, return 401 with a specific error code so the mobile client knows to refresh the token (not just show "server error").

**Detection (warning signs):**
- Backend logs showing bursts of 401 errors approximately 60 minutes after login spikes.
- Users reporting "the app shows an error after I leave it for a while."

**Phase mapping:** Phase 1 (Auth) / Phase 2 (first protected API calls). Must be in the first API service layer built.

---

### Pitfall 7: Firebase Push Notifications Conflict with Expo Notifications

**What goes wrong:** In Expo managed workflow, you cannot use `@react-native-firebase/messaging` for push notifications. This is a native module that requires bare workflow. If you install it in managed workflow and try to build with EAS, the build fails or the notifications silently stop working.

**The correct model for this project:**
- `expo-notifications` handles all push notification delivery in managed workflow.
- Firebase Auth and Firebase Storage can use the Firebase Web JS SDK (`firebase` npm package) — no native Firebase SDK.
- Push delivery path: your backend → Expo Push API → Expo servers → FCM/APNs → device.

**What breaks if you mix them:**
- Installing `@react-native-firebase/messaging` alongside `expo-notifications` causes duplicate handling: both try to intercept the same FCM message, resulting in either double notifications or silent failures depending on which handler wins.
- EAS Build may fail at the native linking stage with cryptic errors.

**Prevention:**
- Commit to one model: Expo Push API exclusively for MVP.
- When requesting a push token, use `Notifications.getExpoPushTokenAsync()`, not `messaging().getToken()`.
- Store the Expo push token (not an FCM token) on your backend, associated with the userId.
- Send pushes from backend using the Expo Push API endpoint.

**Detection (warning signs):**
- EAS Build failing with native module errors mentioning `@react-native-firebase`.
- Notifications delivered in development but not in production builds.
- Double notifications on a test device.

**Phase mapping:** Phase 2 (Notifications). Architecture decision must be locked before implementing any notification sending.

---

### Pitfall 8: Google Maps API Key Exposed in App Bundle

**What goes wrong:** The Google Maps API key is placed in `app.json` under `expo.android.config.googleMaps.apiKey`. This file is committed to git. Anyone who clones the repo or decompiles the APK has the key. It is then used to run up your Maps API bill.

**Why it matters more than other exposed secrets:** Google Maps API keys without application restrictions have no upper bound on spend. A single key scraper bot can spend $1,000+ in 24 hours on your account before you notice.

**Prevention:**
- Never put the Maps API key directly in `app.json`. Use EAS Build environment variables and `app.config.js` (the dynamic config variant):
```javascript
// app.config.js
export default {
  expo: {
    android: {
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY
        }
      }
    }
  }
};
```
- Store the actual key in EAS Secrets (set via `eas secret:create`), never in the repo.
- Restrict the key in Google Cloud Console to your app's package name and SHA-1 certificate fingerprint. This ensures the key only works when called from your signed app binary.
- Set a Google Cloud billing budget alert at $20/month with email notification. This is a 5-minute setup that prevents surprise bills.

**Detection (warning signs):**
- `app.json` contains a string that looks like `AIzaSy...`.
- Google Cloud Console shows Maps API calls from IP addresses that are not your backend or known test devices.

**Phase mapping:** Phase 1 setup (before any Maps feature). Key management must be correct before the key ever exists.

---

### Pitfall 9: Google Maps Places Autocomplete Cost Explosion

**What goes wrong:** City/address search with autocomplete sends a request to the Places Autocomplete API on every keystroke. A user typing "San Francisco" triggers 13 keystrokes = 13 API calls. At $0.00283 per request × 10,000 searches/day = $367/day. This is the most common Maps cost spike for mobile apps.

**Prevention:**
- Debounce the input: wait 300-500ms after the last keystroke before sending a request.
- Set `minCharacters: 3` — do not query until at least 3 characters are entered.
- Cache results in the app's local state: if the user types "San", gets results, then types "San F", first check if "San" results can be re-filtered before making a new request.
- For city-only search (not full address), consider using a free geocoding alternative for the city picker (local database of major cities) and only use Places API for precise address lookup in listing creation.

**Detection (warning signs):**
- Google Cloud Console showing Places API calls 10-20x higher than your user count.
- Watching network tab in dev tools: API calls firing on every keystroke.

**Phase mapping:** Phase 3 (Maps/Listings). Must be in the initial implementation, not retrofitted.

---

### Pitfall 10: MongoDB Embedding Messages in Conversation Documents

**What goes wrong:** The schema stores messages as an array inside the conversation document:
```javascript
// WRONG
{
  _id: conversationId,
  participants: [...],
  messages: [{ text, sender, createdAt }, ...] // grows forever
}
```
MongoDB documents have a hard 16MB size limit. A busy group chat with images/links hits this limit in days, not months. At that point, all writes to the conversation fail with an error, and the chat is bricked.

**Why it happens:** The embedded array pattern looks natural and avoids joins. Works fine for small data. Tutorials often show this pattern without warning about the size limit.

**Prevention:**
- Use a separate `messages` collection from day one:
```javascript
// conversations collection
{ _id, participants, type: 'dm'|'group', lastMessage, createdAt }

// messages collection
{ _id, conversationId, senderId, text, createdAt, deletedAt }
```
- Add compound index immediately: `db.messages.createIndex({ conversationId: 1, createdAt: -1 })`.

**Detection (warning signs):**
- MongoDB error: `Document exceeds 16MB limit`.
- Write errors on conversations that are months old and have been very active.

**Phase mapping:** Phase 2 (Chat schema). Cannot be migrated easily after launch — must be right from the start.

---

### Pitfall 11: Missing GeoJSON Schema for Location Search

**What goes wrong:** Housing listings store location as:
```javascript
{ lat: 48.8566, lng: 2.3522 }
```
MongoDB's geospatial operators (`$near`, `$geoWithin`) require GeoJSON format with a `2dsphere` index. Without this, location-based listing search requires fetching all listings and calculating distance in application code — which does not scale.

**Prevention:**
- Store coordinates as GeoJSON from day one:
```javascript
location: {
  type: "Point",
  coordinates: [2.3522, 48.8566] // NOTE: [longitude, latitude] order — counterintuitive
}
```
- Create the index: `db.listings.createIndex({ location: "2dsphere" })`.
- Note the coordinate order: GeoJSON uses `[longitude, latitude]`, not `[latitude, longitude]`. This is a silent bug if reversed — queries will return wrong results.

**Detection (warning signs):**
- Location-based queries returning listings in the wrong city.
- Query performance degrading as listing count grows.

**Phase mapping:** Phase 3 (Listings). Schema must be designed before first listing is created.

---

### Pitfall 12: Expo Managed Workflow OTA Update False Confidence

**What goes wrong:** Expo's OTA updates (expo-updates) push JavaScript bundle changes to users without a Play Store submission. This creates a false sense of agility: "we can push fixes instantly." However, OTA updates cannot update native code. If you discover mid-MVP that you need a native library (e.g., a background geolocation library, a native biometric auth module), you need a full Play Store binary update — which takes 1-3 days for review.

**The trap:** You plan the MVP around the assumption that you can iterate quickly via OTA, then discover a required feature needs native code, and your release velocity drops to Play Store timelines.

**Prevention:**
- Before committing to a feature, check whether its required library is in Expo's SDK (the managed workflow approved library set). If it requires a bare workflow module, plan for that feature to come after a potential ejection decision.
- For MVP, stick entirely to `expo-*` namespaced SDK libraries plus Firebase Web JS SDK. Do not add any `react-native-*` packages that are not in Expo's managed SDK.
- Do not plan "we can always push a fix" for features that will need native modules. Plan for Play Store cycles.
- If you need anything beyond the managed SDK — eject to bare workflow early, before you have production users, not after.

**Detection (warning signs):**
- A package.json dependency that is `react-native-X` (not `expo-X`) that is not listed in Expo's supported libraries list.
- EAS Build failing with "package X requires bare workflow."

**Phase mapping:** Every phase. Technology selection must be checked against managed workflow support before committing.

---

### Pitfall 13: File Upload from Expo Returns Content:// URI That Cannot Be Directly Uploaded

**What goes wrong:** `expo-image-picker` on Android returns a `content://` URI (e.g., `content://com.android.providers.media.documents/document/image%3A12345`). If you pass this URI directly to `fetch()` as the body of a PUT/POST request, the upload silently fails or throws a network error on some Android versions. This affects both ID document photo upload and profile photo upload.

**Prevention:**
- Use `expo-file-system` to convert the URI to a local file before uploading:
```javascript
import * as FileSystem from 'expo-file-system';

const fileInfo = await FileSystem.getInfoAsync(result.assets[0].uri);
// Use FileSystem.uploadAsync() instead of fetch() for reliable upload
const response = await FileSystem.uploadAsync(uploadUrl, result.assets[0].uri, {
  httpMethod: 'POST',
  uploadType: FileSystem.FileSystemUploadType.MULTIPART,
  fieldName: 'document',
});
```
- Alternatively, read the file as base64 and send as JSON — but this increases payload size 33% and is not recommended for document photos.
- Test on a physical Android device, not just the emulator — the emulator often handles content:// URIs differently.

**Detection (warning signs):**
- Upload appears to succeed (no error shown) but no file appears on the server.
- Network error or 400 response from the backend when submitting ID document.
- Works on iOS simulator, fails on Android device.

**Phase mapping:** Phase 1 (ID document upload). Must be tested on a real Android device before calling it done.

---

## Moderate Pitfalls

---

### Pitfall 14: Housing Platform Contact Info Harvest

**What goes wrong:** A bad actor creates a verified account (or buys one), browses housing listings, messages hosts under the pretext of booking, gets the host's phone number / home address, then continues contact outside the platform. The platform is used as a targeting mechanism, not a housing marketplace.

**Prevention:**
- In the MVP, messaging is in-app only. The UI should not prompt users to "share your phone number to coordinate." Instead, the in-app chat handles all coordination.
- Phone number / home address should only be exchanged when there is a confirmed booking. Design the listing flow so the host's precise address is only revealed after they accept a request.
- Add reporting: "This user asked me to move off-platform" should be a reportable behavior, triggering admin review.
- Rate-limit housing requests per user per day (e.g., max 5 new host messages per day for new accounts).

**Phase mapping:** Phase 3 (Listings). The request/accept flow must have address privacy built in from the start.

---

### Pitfall 15: Socket.io Multiple Connections Per User on Mobile

**What goes wrong:** React Native apps fire the `AppState` `active`/`background` events when the user switches apps or locks the screen. If you create a new Socket.io connection on every `active` event without checking if one already exists, the user ends up with 3-5 active socket connections. Each connection is in the same rooms. The user receives 3-5 copies of every message. The app feels broken.

**Prevention:**
- Manage socket as a singleton: one global socket instance, created once on auth, destroyed on sign-out.
- On `AppState` change to `active`, check `socket.connected` before reconnecting — the existing socket usually reconnects automatically.
- Track the socket in Zustand store or a module-level variable, not inside a component's `useEffect`.

**Phase mapping:** Phase 2 (Chat). Must be part of the socket architecture design.

---

### Pitfall 16: Community Feed Becoming a Housing Board

**What goes wrong:** Without content categories, users post housing requests ("Need a couch in Berlin for next week") directly in the community feed. The feed fills with housing requests and real community content (trip tips, recommendations, discussions) gets buried. Users who came for community disengage because all they see is requests.

**Prevention:**
- Separate concerns at the data model level from the start: `listings` collection is separate from `feed_posts` collection.
- Do not provide a free-text post that allows housing requests in the community feed. If a user wants to post a housing request, it goes through the listings flow, not the feed post flow.
- Add post types with explicit categories so the feed can be filtered.

**Phase mapping:** Phase 4 (Community). Category enforcement must be in the data model, not just UI validation.

---

### Pitfall 17: Review/Rating Gaming by Hosts

**What goes wrong:** A host who receives a negative review contacts the guest and pressures them to delete or modify it. Or a host leaves a retaliatory negative review for a guest who left them a bad review. Ratings become unreliable, which undermines the safety layer they are supposed to provide.

**Prevention:**
- Reviews are one-directional per stay: host rates guest, guest rates host. After both submit or after a 7-day window closes, both ratings are published simultaneously. Neither party can see the other's rating until both have submitted (blind review).
- Do not allow review deletion by the reviewer — only admin can remove reviews.
- No editing of reviews after publication.
- If a user reports retaliatory review pressure, that is an admin case with potential account suspension.

**Phase mapping:** Phase 3 (Listings / Ratings). Blind review must be built into the ratings schema.

---

### Pitfall 18: Unverified Users Accumulate in Database Forever

**What goes wrong:** Users who start the signup flow but whose documents are never approved (rejected, abandoned, never uploaded) accumulate in the `users` collection forever. At scale, the users collection has millions of dead records, slowing queries that touch it.

**Prevention:**
- Add a TTL (Time To Live) index on pending user records:
```javascript
db.users.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 2592000, // 30 days
    partialFilterExpression: { verificationStatus: 'pending' } }
);
```
- Rejected users should be soft-deleted (set `deletedAt`) rather than left active.
- Email the user after 7 days of pending status: "Your verification is pending — please resubmit a clearer photo."

**Phase mapping:** Phase 1 (Verification). Add the TTL index when creating the users schema.

---

## Minor Pitfalls

---

### Pitfall 19: Moderator Burnout at 500+ Users

**What goes wrong:** A single moderator (often the founder) handles all ID verifications, reported posts, and housing disputes. At 500 active users, this is 40+ hours per week of moderation work, even before building new features.

**Prevention:**
- Build the moderation queue with multi-moderator support from the start (admin role, not just a single admin flag).
- Track SLA: time from submission to decision. Dashboards should surface items older than 4 hours.
- Document the moderation playbook early so onboarding additional moderators is fast.

**Phase mapping:** Phase 1 admin panel design. Multi-user admin panel from day one.

---

### Pitfall 20: CORS Wildcard Left Open in Production

**What goes wrong:** The existing `server.js` has `app.use(cors())` and `new Server(httpServer, { cors: { origin: '*' } })`. This is already flagged in CONCERNS.md. If it ships to production, any website or bot can make authenticated requests to the API.

**Prevention:**
- Before the backend serves any real user data, restrict CORS to known origins. For a mobile app, the REST API only needs to be called from the Expo dev server (development) and directly from the mobile app (production). In production, the React Native app calls the backend without CORS headers — CORS restriction primarily protects the API from browser-based attacks.
- Set `origin: process.env.ALLOWED_ORIGINS?.split(',') || false` — in production, set `ALLOWED_ORIGINS` to the empty string or a specific domain, not `*`.

**Phase mapping:** Phase 1. This must be fixed before the backend is deployed anywhere.

---

### Pitfall 21: bcryptjs Performance at Scale

**What goes wrong:** `bcryptjs` (pure JS) is already in the dependencies. Password hashing with bcrypt cost factor 12 takes ~250ms in native C (`bcrypt`) but ~900ms in pure JS (`bcryptjs`). At login time, this is noticeable but acceptable. The real problem is bulk operations (batch password resets, import of users) where N hashes at 900ms each become minutes.

**Prevention:**
- For MVP with Firebase Auth, passwords are not handled by the backend at all — Firebase handles them. If bcryptjs is in the package.json but no custom password hashing is needed (because Firebase Auth is the auth system), remove it to avoid confusion.
- If a custom password flow is ever needed post-MVP, switch to native `bcrypt` at that point.

**Phase mapping:** Phase 1. Clarify whether bcryptjs is even needed given Firebase Auth is the auth provider. If not, remove the dependency.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Auth + Firebase setup | Auth persistence loss on restart | Use `initializeAuth` with `getReactNativePersistence(AsyncStorage)` |
| ID document upload | content:// URI upload failure on Android | Use `expo-file-system` `uploadAsync`, test on real device |
| Admin moderation panel | Single bottleneck, burnout | Multi-user admin queue with SLA tracking built in |
| Verification review protocol | Gender bypass via family ID or face-mismatch | Selfie + ID face-match check required, written checklist |
| First backend API | Token expiry causes 401 | Auto-refresh token before every API call via `getIdToken()` |
| Push notifications | Conflict between expo-notifications and Firebase messaging | Use Expo Push API exclusively in managed workflow |
| Maps API key | Key exposed in app.json → theft and billing explosion | EAS Secrets + App restrictions in Google Cloud Console |
| City group chat | Room leaks + zombie connections | Explicit leave on disconnect + Redis adapter |
| Chat message send | Delivery guarantee theater | Store in MongoDB first, emit after confirmed write |
| Chat schema | Embedded messages hit 16MB document limit | Separate `messages` collection from day one |
| Listings schema | Coordinate format incompatible with geospatial queries | GeoJSON `[lng, lat]` format + `2dsphere` index |
| Listings flow | Address harvested before booking confirmed | Reveal host address only after accept, not in listing preview |
| Community feed | Housing requests flood community content | Separate collections + post type enforcement at API level |
| Ratings | Review coercion and retaliation | Blind simultaneous reveal after both parties submit |
| Autocomplete search | Places API cost explosion | Debounce 300ms, min 3 chars, consider local city DB for city picker |
| OTA updates | False confidence that fixes can always be pushed instantly | Verify all required libraries are in managed SDK before planning |

---

## Sources

All findings from training knowledge (pre-August 2025 cutoff). Live web search was unavailable during this session.

- Expo managed workflow documentation: `https://docs.expo.dev/versions/v57.0.0/`
- Firebase Auth React Native setup: `https://firebase.google.com/docs/auth/web/custom-dependencies`
- Socket.io documentation: `https://socket.io/docs/v4/`
- MongoDB schema design best practices: `https://www.mongodb.com/docs/manual/data-modeling/`
- Google Maps Platform pricing: `https://developers.google.com/maps/documentation/places/web-service/usage-and-billing`
- Platform trust/safety patterns: synthesized from public documentation of Couchsurfing, HER, Airbnb and analogous platform post-mortems
- Confidence: HIGH for technical claims (Expo, Firebase, MongoDB, Socket.io, Maps); MEDIUM for trust/safety domain patterns
