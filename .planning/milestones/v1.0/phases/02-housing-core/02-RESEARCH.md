# Phase 2: Housing Core — Research

**Researched:** 2026-07-06
**Domain:** Geo-enabled listings, real-time Socket.io messaging, stay requests, push notifications — on Expo 57 + Node.js/Express + MongoDB/Mongoose
**Confidence:** HIGH (core stack decisions verified from official docs; package legitimacy checked)

---

## Summary

Phase 2 builds on Phase 1's verified auth and user layer to add the full housing loop: listings on a map, stay requests, and real-time 1:1 + city-group messaging. Every new feature reuses the established patterns — Firebase token auth middleware, Mongoose models, multer + Firebase Storage for photos, expo-server-sdk push notifications, and Zustand stores on mobile.

The two most consequential technical decisions are already locked by project context: (1) **store-first messaging** — every message is written to MongoDB before the Socket.io emit, non-negotiable for data safety; and (2) **separate `messages` collection** — never embed messages in conversation documents due to the 16 MB MongoDB document limit.

The critical platform constraint for Phase 2 is push notifications: from Expo SDK 53 onwards, Expo push notifications on Android do NOT work in Expo Go — an EAS dev build is required. `react-native-maps` itself does work in Expo Go for development/testing, but with the Google Maps provider and API key configured via plugin, a dev build is needed for production-correct map rendering.

**Primary recommendation:** Build the socket authentication handshake and address-hiding projection layer first, as they are the security-critical paths. Everything else (map rendering, date filters, push) can be incrementally layered on top.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Listing geo storage + queries | API / Backend | Database (Mongoose + 2dsphere index) | All geo filtering is server-side; client receives safe neighbourhood centroid only |
| Address hiding / reveal | API / Backend | — | Exact address is NEVER sent to the client until StayRequest.status === 'accepted'; this is an API projection concern, not a client concern |
| Photo upload (listings) | API / Backend | Firebase Storage | Follows Phase 1 storageService.uploadFile pattern |
| Map rendering + user location | Browser/Client (mobile) | — | react-native-maps MapView + expo-location; purely client-side rendering |
| Socket.io real-time delivery | API / Backend | Browser/Client (mobile) | Server emits to rooms; client subscribes to room events |
| Message persistence | Database | — | MongoDB `messages` collection; written before emit (store-first) |
| Push notifications | API / Backend | CDN (Expo push service) | notificationService.sendPushNotification → Expo push API → device |
| Auth gate (all endpoints) | API / Backend | — | verifyFirebaseToken + requireVerified middleware; client gate is defence-in-depth |
| Socket auth | API / Backend | — | io.use() middleware verifies Firebase token before socket joins any room |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIST-01 | Verified user can create a free housing listing with title, description, availability dates, location, and house rules | Listing model design; multer + Firebase Storage photo upload; geo point storage |
| LIST-02 | User can upload multiple photos per listing | Phase 1 storageService.uploadFile reused; multer array upload; Firebase Storage paths `listings/{listingId}/photos/{index}` |
| LIST-03 | Listings appear on a map with a neighbourhood pin — exact address hidden until request accepted | Neighbourhood centroid in `location` field; exact address in separate `exactAddress` field; API projection strips `exactAddress` from non-accepted guests |
| LIST-04 | User can search and browse listings by geographic location | MongoDB `$geoNear` aggregation + 2dsphere index; backend endpoint returns centroid-only listings |
| LIST-05 | User can filter listing search results by availability dates | `$geoNear` `query:` param adds date overlap condition on `availabilityDates` |
| REQT-01 | Verified user can send a stay request with dates and intro message | StayRequest model; POST /api/listings/:id/requests; push notification to host |
| REQT-02 | Host can accept or decline a stay request from their inbox | PATCH /api/requests/:id; status enum: pending/accepted/declined |
| REQT-03 | Full host address revealed to guest only after host accepts | API returns `exactAddress` only when requesting user is the guest AND status === 'accepted' |
| REQT-04 | User receives push notification when request accepted or declined | notificationService.sendPushNotification reused from Phase 1 |
| MSG-01 | Verified user can send a direct message request to another verified user | Conversation model with `status: 'pending'`; MessageRequestBanner in UI |
| MSG-02 | Recipient can accept or decline a DM request | PATCH /api/conversations/:id/accept or /decline; store-first status update |
| MSG-03 | Accepted 1:1 conversations are real-time via Socket.io | Socket.io room `dm:{sortedUid1}_{sortedUid2}`; store-first message pattern |
| MSG-04 | Verified user can join and post in city-based group chats | Socket.io room `city:{citySlug}`; city derived from user.homeCity; no separate group-chat model needed |
| MSG-05 | Push notification on every new message in accepted conversation or group chat | notificationService batch sends; skip if recipient is online in the room |
</phase_requirements>

---

## Standard Stack

### Core (new for Phase 2 — backend)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mongoose (already installed) | 8.4.1 | Geo queries via 2dsphere index + $geoNear aggregation | Already in stack; Mongoose 8 fully supports GeoJSON schema types |
| socket.io (already installed) | 4.7.5 | Real-time 1:1 and group chat rooms | Already scaffolded in server.js; just needs auth middleware + room logic |
| expo-server-sdk (already installed) | 6.1.0 | Push notification delivery | Already used in notificationService.js; reuse sendPushNotification |
| multer (already installed) | 2.2.0 | Multi-photo listing uploads | Already used for verification docs + profile photos |

### Core (new for Phase 2 — mobile)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native-maps | 1.29.0 | MapView + Marker rendering | Official Expo-recommended map library; works in Expo Go (dev) and EAS build (prod) |
| expo-location | 57.0.2 | User location for "near me" search | Official Expo SDK package; provides foreground location permission and coordinates |
| @react-native-community/datetimepicker | 9.1.0 | Availability date pickers | Official React Native Community package; Expo-compatible; already vetted in UI-SPEC |
| socket.io-client | 4.8.3 | Mobile Socket.io client | Official client matching server's socket.io 4.7.5 (compatible); pure JS, no native module |

### Installation

```bash
# Mobile — run from /mobile directory
npx expo install react-native-maps expo-location @react-native-community/datetimepicker

# Mobile — socket.io-client (exact version, not via expo install)
npm install socket.io-client@4.8.3

# Backend — no new packages needed; all dependencies already installed
```

---

## Package Legitimacy Audit

> All packages verified via `gsd-tools query package-legitimacy check --ecosystem npm`.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| react-native-maps | npm | 8+ yrs (new version 2026-06-28) | 1.29M/wk | github.com/react-native-maps/react-native-maps | SUS (too-new version flag) | Approved — high download count + official Expo recommendation; "too-new" flag is for latest version release, not the package itself |
| expo-location | npm | 7+ yrs (new version 2026-07-03) | 2.34M/wk | github.com/expo/expo | SUS (too-new version flag) | Approved — official Expo SDK package from expo/expo monorepo; "too-new" is version bump, not new package |
| @react-native-community/datetimepicker | npm | 5+ yrs | 1.89M/wk | github.com/react-native-datetimepicker/datetimepicker | OK | Approved |
| socket.io-client | npm | 10+ yrs | 11.4M/wk | github.com/socketio/socket.io | OK | Approved |

**Packages removed due to SLOP verdict:** none

**Packages flagged as suspicious SUS:** react-native-maps and expo-location triggered the "too-new version" signal because they published new versions within the last 14 days. Both are official packages from well-known maintainers (react-native-maps community and expo/expo monorepo). The planner should add a `checkpoint:human-verify` task before installing them to confirm the latest version is compatible with Expo SDK 57.

**Registry verification:**
```
react-native-maps        → 1.29.0  (npm view)
expo-location            → 57.0.2  (npm view)  ← version matches Expo SDK 57 major
@react-native-community/datetimepicker → 9.1.0  (npm view)
socket.io-client         → 4.8.3  (npm view)
```

---

## Architecture Patterns

### System Architecture Diagram

```
Mobile App
  │
  ├── REST (Firebase Bearer token)
  │     └── /api/listings         → listingController → Listing model (MongoDB)
  │     └── /api/requests         → requestController → StayRequest model
  │     └── /api/conversations    → conversationController → Conversation + Message models
  │
  ├── Socket.io (auth handshake → Firebase token)
  │     ├── join room dm:{uid1}_{uid2}   → MessageEvent → [DB write] → emit to room
  │     └── join room city:{slug}        → GroupMessageEvent → [DB write] → emit to room
  │
  └── MapView (react-native-maps)
        └── Neighbourhood pins (centroid coords from /api/listings/search)
              └── NEVER exact address coords

Backend (Express + Socket.io)
  │
  ├── io.use() auth middleware  → getAuth().verifyIdToken(socket.handshake.auth.token)
  ├── socket.join(roomId) after auth
  ├── On message event: Message.create() THEN io.to(room).emit()  ← store-first (locked)
  └── sendPushNotification() for offline recipients after DB write

MongoDB
  ├── listings collection  (2dsphere index on location.coordinates)
  ├── stayRequests collection
  ├── conversations collection
  └── messages collection  (separate, NOT embedded)
```

### Recommended Project Structure (new files only)

```
backend/src/
├── models/
│   ├── Listing.js          # GeoJSON Point, exactAddress, availabilityDates, photos
│   ├── StayRequest.js      # guest, host, listing, dates, intro, status
│   ├── Conversation.js     # participants, status (pending/accepted/declined), type
│   └── Message.js          # conversationId OR citySlug, senderUid, content, createdAt
├── controllers/
│   ├── listingController.js
│   ├── requestController.js
│   └── conversationController.js
├── routes/
│   ├── listings.js
│   ├── requests.js
│   └── conversations.js
└── socket/
    └── chatHandler.js      # io.use() auth + room join/leave + store-first message emit

mobile/src/
├── screens/
│   ├── Housing/
│   │   ├── MapDiscoveryScreen.tsx
│   │   ├── ListingDetailScreen.tsx
│   │   └── CreateListingScreen.tsx
│   ├── Requests/
│   │   ├── HostInboxScreen.tsx
│   │   └── RequestStatusScreen.tsx
│   └── Messages/
│       ├── ConversationListScreen.tsx
│       ├── DirectMessageScreen.tsx
│       └── CityGroupChatScreen.tsx
├── components/
│   ├── Map/
│   │   ├── NeighbourhoodPin.tsx
│   │   └── FilterSheet.tsx
│   ├── Listings/
│   │   ├── ListingCard.tsx
│   │   ├── AddressRevealCard.tsx
│   │   └── SafetyChip.tsx
│   ├── Chat/
│   │   ├── MessageBubble.tsx
│   │   ├── MessageRequestBanner.tsx
│   │   └── ChatInput.tsx
│   ├── Requests/
│   │   └── RequestCard.tsx
│   └── Common/
│       ├── UnreadBadge.tsx
│       ├── OnlineIndicator.tsx
│       ├── AvailabilityDatePicker.tsx
│       └── PhotoGridUploader.tsx
├── store/
│   ├── listingStore.ts
│   ├── conversationStore.ts
│   └── socketStore.ts       # socket instance + connection state
└── services/
    ├── socketService.ts      # connect(), joinRoom(), leaveRoom(), disconnect()
    └── api.ts                # extend with listing/request/conversation API calls
```

---

### Pattern 1: Listing Model with Geo + Address Hiding

```javascript
// Source: official Mongoose GeoJSON docs + MongoDB 2dsphere docs
const listingSchema = new Schema({
  ownerUid: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, maxlength: 2000 },
  houseRules: { type: String, maxlength: 1000 },
  // Neighbourhood centroid — SENT TO ALL CLIENTS (safe, approximate)
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: { type: [Number], required: true }, // [lng, lat] — longitude FIRST
  },
  // Exact address — NEVER sent to client until StayRequest accepted
  exactAddress: { type: String, required: true },
  citySlug: { type: String, required: true, index: true },  // for group chat join
  photos: [{ type: String }],   // Firebase Storage paths: listings/{id}/photos/{i}
  availabilityDates: [
    {
      from: { type: Date, required: true },
      to:   { type: Date, required: true },
    }
  ],
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

// 2dsphere index REQUIRED for $near / $geoNear queries
listingSchema.index({ location: '2dsphere' });
```

**Critical:** `exactAddress` field MUST be excluded from all list/search/detail API responses unless the requesting user has an accepted StayRequest for this listing. This is an API projection concern — handled in the controller, not the client.

### Pattern 2: Address Hiding Projection in Controller

```javascript
// Source: Phase 1 pattern (getProfile explicit projection)
// In listingController.getListingDetail:
async function getListingDetail(req, res) {
  const listing = await Listing.findById(req.params.id).lean();
  if (!listing) return res.status(404).json({ error: 'Not found' });

  // Check if requester has an accepted stay request for this listing
  const acceptedRequest = await StayRequest.findOne({
    listingId: listing._id,
    guestUid: req.user.uid,
    status: 'accepted',
  });

  // Build explicit projection — exactAddress only revealed if accepted guest
  const data = {
    id: listing._id,
    title: listing.title,
    description: listing.description,
    houseRules: listing.houseRules,
    ownerUid: listing.ownerUid,
    // location = neighbourhood centroid, always safe to send
    neighbourhoodCoords: listing.location.coordinates,
    photos: listing.photos,   // resolve to signed URLs here
    availabilityDates: listing.availabilityDates,
    // CONDITIONAL: exact address only after acceptance
    exactAddress: acceptedRequest ? listing.exactAddress : null,
    addressRevealed: !!acceptedRequest,
  };

  res.json({ data });
}
```

### Pattern 3: Geo Search with Date Filter

```javascript
// Source: MongoDB $geoNear aggregation docs + Mongoose aggregation
// GET /api/listings/search?lat=55.75&lng=37.62&radiusM=10000&fromDate=...&toDate=...
async function searchListings(req, res) {
  const { lat, lng, radiusM = 10000, fromDate, toDate } = req.query;

  const matchFilter = { isActive: true };
  if (fromDate && toDate) {
    // Listing has at least one availability window overlapping the requested dates
    matchFilter['availabilityDates'] = {
      $elemMatch: {
        from: { $lte: new Date(toDate) },
        to:   { $gte: new Date(fromDate) },
      }
    };
  }

  const listings = await Listing.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        distanceField: 'distance',
        maxDistance: parseInt(radiusM),
        spherical: true,
        query: matchFilter,   // filter combined with geo
      }
    },
    { $limit: 50 },
    {
      // Explicit projection — NEVER include exactAddress in search results
      $project: {
        title: 1, description: 1, ownerUid: 1,
        photos: { $slice: ['$photos', 1] },  // first photo only for card
        availabilityDates: 1, distance: 1,
        // neighbourhood centroid coordinates — safe to send
        'location.coordinates': 1,
        // exactAddress deliberately OMITTED
      }
    }
  ]);

  res.json({ data: listings });
}
```

### Pattern 4: Socket.io Auth Middleware (Firebase token)

```javascript
// Source: Socket.io v4 middleware docs (socket.handshake.auth)
// backend/src/socket/chatHandler.js

const { getAuth } = require('firebase-admin/auth');
const User = require('../models/User');
const Message = require('../models/Message');

function registerSocketHandlers(io) {
  // Auth middleware — runs for every connection before any event handler
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Missing auth token'));
    try {
      const decoded = await getAuth().verifyIdToken(token);
      if (!decoded.isVerified) return next(new Error('User not verified'));
      socket.data.uid = decoded.uid;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const { uid } = socket.data;

    // Join DM room
    socket.on('join:dm', ({ otherUid }) => {
      const sorted = [uid, otherUid].sort();
      const room = `dm:${sorted[0]}_${sorted[1]}`;
      socket.join(room);
    });

    // Join city group chat room
    socket.on('join:city', ({ citySlug }) => {
      socket.join(`city:${citySlug}`);
    });

    // STORE-FIRST: write to DB before emitting (locked decision)
    socket.on('message:dm', async ({ otherUid, content }) => {
      const sorted = [uid, otherUid].sort();
      const room = `dm:${sorted[0]}_${sorted[1]}`;
      try {
        const msg = await Message.create({
          type: 'dm',
          room,
          senderUid: uid,
          content,
        });
        // Emit ONLY after successful DB write
        io.to(room).emit('message:new', {
          _id: msg._id, senderUid: uid, content, createdAt: msg.createdAt,
        });
        // Push notification for offline recipients (async, non-blocking)
        notifyOfflineRecipients(room, uid, content).catch(console.error);
      } catch (err) {
        socket.emit('message:error', { error: 'Message not saved' });
      }
    });

    // Sockets auto-leave all rooms on disconnect — no manual socket.leave needed
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}

module.exports = { registerSocketHandlers };
```

### Pattern 5: Socket.io Client (Mobile, Zustand)

```typescript
// Source: socket.io-client docs + Phase 1 Zustand pattern
// mobile/src/services/socketService.ts

import { io, Socket } from 'socket.io-client';
import { auth } from '../config/firebase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;
  const token = await auth.currentUser?.getIdToken();
  socket = io(API_BASE_URL, {
    auth: { token },           // passed via socket.handshake.auth on server
    transports: ['websocket'], // skip polling for mobile performance
    reconnection: true,
    reconnectionDelay: 1000,
  });
  return socket;
}

export function getSocket(): Socket | null { return socket; }

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
```

### Pattern 6: StayRequest Model

```javascript
// Source: project design + Phase 1 model conventions
const stayRequestSchema = new Schema({
  guestUid:  { type: String, required: true, index: true },
  hostUid:   { type: String, required: true, index: true },
  listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
  checkIn:   { type: Date, required: true },
  checkOut:  { type: Date, required: true },
  intro:     { type: String, required: true, maxlength: 500 },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending',
    index: true,
  },
}, { timestamps: true });
```

On `PATCH /api/requests/:id` with `{ status: 'accepted' }`:
1. Update `StayRequest.status` in MongoDB
2. If accepted: `User.findOneAndUpdate({ firebaseUid: hostUid }, { $inc: { hostsCount: 1 } })` + guest's `tripsCount`
3. `sendPushNotification(guestToken, 'Stay request accepted', '...')` from notificationService

### Pattern 7: Conversation + Message Models

```javascript
// Source: locked decision (STATE.md) — separate collection, store-first
const conversationSchema = new Schema({
  type: { type: String, enum: ['dm', 'group'], required: true },
  participants: [{ type: String }],  // Firebase UIDs for DMs; empty for group
  citySlug: { type: String },        // set for group type
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending',
  },
  lastMessageAt: { type: Date },
  lastMessagePreview: { type: String },
}, { timestamps: true });

const messageSchema = new Schema({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', index: true },
  citySlug: { type: String, index: true },  // for group messages (no conversation doc)
  senderUid: { type: String, required: true },
  content: { type: String, required: true, maxlength: 2000 },
  type: { type: String, enum: ['dm', 'group'], required: true },
}, { timestamps: true });
// Compound index for efficient history fetch
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ citySlug: 1, createdAt: -1 });
```

### Pattern 8: app.json Plugin for Maps + Location

```json
{
  "expo": {
    "plugins": [
      ["expo-notifications", { "icon": "./assets/icon.png", "color": "#E6F4FE" }],
      ["react-native-maps", {
        "androidGoogleMapsApiKey": "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY"
      }],
      ["expo-location", {
        "locationWhenInUsePermission": "WomenApp uses your location to show nearby housing listings."
      }]
    ],
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY"
        }
      }
    }
  }
}
```

The API key value must be injected at build time from `.env` via `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`. Never hardcode the key in source.

### Pattern 9: MapView with Neighbourhood Pin

```typescript
// Source: Expo v57 react-native-maps docs + react-native-maps GitHub
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';

// Request permission before getting location
const { status } = await Location.requestForegroundPermissionsAsync();
if (status !== 'granted') { /* show error */ return; }
const loc = await Location.getCurrentPositionAsync({
  accuracy: Location.Accuracy.Balanced,
});

// MapView usage
<MapView
  provider={PROVIDER_GOOGLE}
  style={StyleSheet.absoluteFillObject}
  showsUserLocation={true}
  initialRegion={{
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    latitudeDelta: 0.05,   // ~5km zoom
    longitudeDelta: 0.05,
  }}
  onRegionChangeComplete={(region) => fetchListingsInView(region)}
>
  {listings.map((listing) => (
    <Marker
      key={listing._id}
      coordinate={{
        latitude: listing.location.coordinates[1],   // lat is index 1
        longitude: listing.location.coordinates[0],  // lng is index 0
      }}
      onPress={() => setSelectedListing(listing)}
    >
      <NeighbourhoodPin selected={selectedListing?._id === listing._id} />
    </Marker>
  ))}
</MapView>
```

### Anti-Patterns to Avoid

- **Embedding messages in Conversation document:** Hard MongoDB 16 MB limit. Use separate `messages` collection (locked decision).
- **Emit before DB write:** If socket.io emits before `Message.create()` resolves and the DB write fails, the client shows a message that was never saved (locked decision: store-first always).
- **Sending exactAddress in search/list endpoints:** Even if a user has an accepted request, the search list should never include exact addresses — these are only visible on the detail screen after an auth check.
- **Latitude-first in GeoJSON coordinates:** MongoDB GeoJSON is `[longitude, latitude]` (longitude first). This is the most common geo bug.
- **Using `socket.leave()` manually in most cases:** Socket.io 4.x auto-leaves all rooms on disconnect. Manual `socket.leave()` is only needed for intentional room changes mid-session (e.g., user changes city).
- **Omitting 2dsphere index creation:** `$near` and `$geoNear` will throw errors without the index. Use `listingSchema.index({ location: '2dsphere' })` in the model definition, not a later migration.
- **Hardcoding socket room names:** DM rooms must use sorted UIDs to guarantee a single deterministic room name regardless of who initiates. Use `[uid1, uid2].sort().join('_')` with the `dm:` prefix.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Geo-within-radius queries | Custom haversine distance filter in JS | MongoDB `$geoNear` + 2dsphere index | DB-level filtering is orders of magnitude faster; haversine in JS scans all documents |
| Real-time message delivery | Polling endpoint every N seconds | Socket.io rooms (already scaffolded) | Polling adds latency, load, and complexity; Socket.io is already in server.js |
| Push notification batching | Manual loop over user tokens | expo-server-sdk chunk API (`expo.chunkPushNotifications`) | Expo SDK handles chunking (100 msgs/batch limit), errors per-token, and retry |
| Date-range overlap check | Complex JS date comparison in controller | MongoDB `$elemMatch` with `from/$lte` + `to/$gte` | Single indexed query; JS-side filtering requires loading all listings |
| Firebase token verification in Socket.io | Custom JWT decode | `getAuth().verifyIdToken()` (Phase 1 pattern) | Firebase Admin SDK handles key rotation and token expiry correctly |
| Neighbourhood centroid calculation | Client-side reverse geocoding | Server stores pre-computed centroid (submitted by host on listing creation) | Avoids API call latency on map load; host provides neighbourhood name, server geocodes once |

---

## Common Pitfalls

### Pitfall 1: Push Notifications Don't Work in Expo Go on Android (SDK 53+)

**What goes wrong:** Developer tests push notifications in Expo Go on Android device; nothing arrives. No error in console.

**Why it happens:** From Expo SDK 53 onwards, Expo push notifications on Android require a dev build or EAS Build. Expo Go on Android silently drops push registration. [VERIFIED: docs.expo.dev/versions/v57.0.0/sdk/notifications]

**How to avoid:** EAS Build configuration is already flagged as a Phase 2 blocker in STATE.md. Plan a Wave 0 task to run `eas build:configure` and create a dev build for Android before any push notification testing. The `getExpoPushTokenAsync` call in `push.ts` already guards against missing `projectId`.

**Warning signs:** `Notifications.getExpoPushTokenAsync()` returns a token but push never arrives on device; no error thrown.

### Pitfall 2: GeoJSON Coordinates are [longitude, latitude], Not [latitude, longitude]

**What goes wrong:** Markers appear in wrong location; `$geoNear` returns wrong results. Often shifted by thousands of km.

**Why it happens:** GeoJSON spec (and MongoDB) use `[longitude, latitude]`. React Native (and Google Maps) use `{ latitude, longitude }`. Developers mix them up. [VERIFIED: mongodb.com/docs/manual/geospatial-queries]

**How to avoid:** In all MongoDB writes: `coordinates: [lng, lat]`. In all MapView `<Marker coordinate={}>`: extract as `latitude: coords[1], longitude: coords[0]`. Add a comment at each usage site.

**Warning signs:** Pins appear in ocean; `$geoNear` returns empty results for a valid city.

### Pitfall 3: Missing 2dsphere Index Causes Query Failure

**What goes wrong:** `$near` or `$geoNear` aggregation throws `MongoServerError: $geoNear requires a 2d index`. API returns 500.

**Why it happens:** 2dsphere index must exist on the collection before geo queries run. Mongoose schema index declarations are created on first connection but only if the collection doesn't already exist without the index. [VERIFIED: mongoosejs.com/docs/geojson.html]

**How to avoid:** Declare `listingSchema.index({ location: '2dsphere' })` in the model. In development, drop the collection and reconnect to force index creation if the collection was created before the schema was finalized.

**Warning signs:** Error on first search request after deployment to a new DB instance.

### Pitfall 4: CORS is Currently '*' — Socket.io Will Be Blocked in Production

**What goes wrong:** Browser/native client connects in dev with CORS `*`; in production, more restrictive CORS either blocks or causes confusion about which origin to whitelist for a mobile app.

**Why it happens:** `server.js` sets `origin: '*'` for both Express CORS and Socket.io. Noted as a critical issue in CLAUDE.md.

**How to avoid:** For mobile apps, CORS is not strictly enforced by the OS (no browser Same-Origin Policy). However, restrict CORS to the backend's own domain for any web-facing admin panel, and avoid `*` in production. Minimal fix: set `origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']`.

**Warning signs:** Admin panel CORS errors after adding the new origin restriction.

### Pitfall 5: Address Leak via API Response

**What goes wrong:** `exactAddress` accidentally included in listing search results or the listing detail for a non-accepted guest because it wasn't explicitly projected out.

**Why it happens:** MongoDB `.lean()` returns all fields unless you project. A `.find()` without `{ exactAddress: 0 }` returns the full document.

**How to avoid:** Every listing API response must be built from an explicit projection object — never spread the raw Mongoose document. Follow the Phase 1 `getProfile` pattern (explicit `data = { field1, field2, ... }` — no object spread). Add a safety comment `// exactAddress deliberately omitted` at every listing endpoint.

**Warning signs:** Mobile client receives `exactAddress` even though there is no accepted request; grep for `exactAddress` in API response objects.

### Pitfall 6: react-native-maps Expo Go vs. EAS Build — Correct Understanding

**What actually happens (Expo SDK 57):** react-native-maps works in Expo Go for rendering and testing. However, the `androidGoogleMapsApiKey` from `app.json` plugins is only injected during a build — in Expo Go, the map renders with no API key (Apple Maps on iOS, or a limited Google Maps mode on Android). For production map quality and to avoid "for development purposes only" watermark, an EAS build is needed. [VERIFIED: docs.expo.dev/versions/v57.0.0/sdk/map-view]

**How to handle:** Use Expo Go for initial development and UI testing. Create an EAS dev build before the Phase 2 demo / verification. This aligns with the existing EAS Build blocker in STATE.md.

### Pitfall 7: Group Chat Push Fan-Out Cost

**What goes wrong:** City with 500+ members triggers 500 push notifications for every message. Expo push service rate-limits batch sends; large groups become unusable.

**Why it happens:** Naive implementation sends a push token lookup + notification for every group member.

**How to avoid:** For city group chats, only send push to members who are NOT currently connected to the Socket.io room (use `io.in(room).fetchSockets()` to count online members). For MVP with small user counts this is fine; document the scale limit.

---

## Address Hiding Strategy (Safety-Critical)

The core safety requirement (LIST-03, REQT-03) needs a defence-in-depth implementation:

**Layer 1 — Data model:** Listing stores two location fields:
- `location` (GeoJSON Point): neighbourhood centroid — slightly offset from exact address, at the centre of the postal/neighbourhood area. This is what appears on the map as the pin.
- `exactAddress`: the full street address string. Never a GeoJSON coordinate (prevent triangulation).

**Layer 2 — Backend projection:** Every controller method that returns listing data must explicitly include or exclude `exactAddress` based on the requester's StayRequest status. Use the getListingDetail pattern above. Never return `exactAddress` in search/list endpoints even for accepted guests (they must view the detail screen, which triggers the per-request auth check).

**Layer 3 — Mobile client:** `AddressRevealCard` is only rendered when `data.addressRevealed === true` AND `data.exactAddress != null`. The client does not attempt to infer address from coordinates. SafetyChip is always shown when `addressRevealed === false`.

---

## EAS Build Configuration (Phase 2 Blocker)

From STATE.md: "Phase 2: EAS Build configuration needed before push notifications work on physical devices."

Required steps (Wave 0 task):
```bash
# In /mobile directory
npm install -g eas-cli    # if not already installed
eas login
eas init                  # populates extra.eas.projectId in app.json
eas build:configure       # creates eas.json with build profiles
eas build --platform android --profile development  # creates dev build APK
```

The `push.ts` service already checks for `projectId` and warns if it's still set to `'YOUR_EAS_PROJECT_ID'` — no code change needed for push, only the EAS configuration.

---

## Socket.io CORS Fix (Required for Phase 2)

Current state: `new Server(httpServer, { cors: { origin: '*' } })` in `server.js`.

Required fix before Phase 2 socket connections from a real device:
```javascript
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
});
```

For mobile clients, CORS is not enforced by the OS, but scoping reduces attack surface. Add `ALLOWED_ORIGINS` to `.env.example`.

---

## Security Domain

> `security_enforcement: true` in config.json (level 1, block on high).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Firebase token verification via `getAuth().verifyIdToken()` — reuse Phase 1 `verifyFirebaseToken` + `requireVerified` middleware on all new routes |
| V3 Session Management | yes (Socket.io) | Socket.io auth middleware verifies Firebase token on connection; no server-side session state |
| V4 Access Control | yes | `requireVerified` middleware; host-only operations guarded by checking `listing.ownerUid === req.user.uid`; guest address reveal only when accepted request exists |
| V5 Input Validation | yes | Validate lat/lng range, radius bounds, intro message length (max 500), listing description (max 2000), coordinate format before Mongoose save |
| V6 Cryptography | no | No custom crypto; Firebase handles token signing; no passwords stored in Phase 2 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Address leak via API | Information Disclosure | Explicit projection in every listing controller; exactAddress excluded unless accepted request exists for requesting user |
| Unauthorized stay request on own listing | Elevation of Privilege | listingController rejects if `guestUid === listing.ownerUid` |
| Socket room message injection (wrong room) | Tampering | Socket only joins rooms after auth; DM room name uses server-sorted UIDs — client cannot fabricate a different room name without both UIDs |
| Large payload message | DoS | `content` field limited to 2000 chars in Mongoose schema; no binary via socket (photos go through REST + Firebase Storage) |
| Geo query manipulation (negative radius, invalid coords) | Tampering | Validate lat (-90..90), lng (-180..180), radiusM (1..50000) in controller before aggregation |
| Mass push notification spam (forged group message) | DoS | Socket auth middleware verifies token; message must pass DB write (rate limiting can be added in Phase 3) |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend runtime | ✓ | (checked via npm) | — |
| MongoDB | All data | ✓ (via MONGODB_URI in .env) | — | — |
| Firebase Admin SDK | Token verification | ✓ (firebase-admin 14.1.0 installed) | 14.1.0 | — |
| EAS CLI | Android push notifications | ✗ (not yet configured — see STATE.md blocker) | — | Use Expo Go for dev testing; push not functional until EAS configured |
| Google Maps API key | Map rendering with API key | ✗ (not yet obtained) | — | Map renders without key in Expo Go (watermarked); key needed for EAS build |
| socket.io-client | Mobile real-time chat | ✗ (not yet installed in /mobile) | 4.8.3 | — |
| react-native-maps | Mobile map screen | ✗ (not yet installed in /mobile) | 1.29.0 | — |
| expo-location | User location | ✗ (not yet installed in /mobile) | 57.0.2 | — |
| @react-native-community/datetimepicker | Date pickers | ✗ (not yet installed in /mobile) | 9.1.0 | — |

**Missing dependencies with no fallback:**
- `socket.io-client`, `react-native-maps`, `expo-location`, `@react-native-community/datetimepicker` — must be installed in /mobile before any Phase 2 mobile screens work
- Google Maps API key — required for production map rendering; obtainable from Google Cloud Console
- EAS Build configuration — required for Android push notifications on physical devices

**Missing dependencies with fallback:**
- EAS CLI: Expo Go can be used for map + UI testing (push notifications will not work on Android until EAS dev build is created)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Embed messages in conversation document | Separate `messages` collection | MVP design decision (locked) | Avoids 16 MB document limit; enables efficient cursor-based pagination |
| Expo Go for all native module testing | EAS Dev Build for modules requiring native config | Expo SDK 53 | Push notifications on Android require dev build; maps work in Expo Go |
| Manual socket.leave() on disconnect | Auto-leave (Socket.io 4.x) | Socket.io 4.0 | Sockets auto-leave all rooms on disconnect; manual leave only for mid-session room changes |
| `$near` query operator | `$geoNear` aggregation stage | MongoDB 4.x | `$geoNear` supports combining geo distance with additional filter conditions in one pass |
| Polling for new messages | Socket.io rooms | Phase 1 design | Socket.io already scaffolded; zero additional backend infrastructure |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Neighbourhood centroid coordinates are provided by the host at listing creation time (not computed via geocoding API) | Architecture Patterns | If geocoding is expected, a third-party geocoding API needs to be integrated; adds dependency and cost |
| A2 | City group chat membership is implicit (user joins city chat based on their `homeCity` profile field) — no explicit join/leave model | Standard Stack | If explicit membership is needed, a GroupChatMember collection must be added |
| A3 | The `homeCity` field on User model stores the city slug needed for `city:{citySlug}` Socket.io room naming | Architecture Patterns | If homeCity is a display name (not a slug), a normalization step is needed at room join time |
| A4 | react-native-maps in Expo Go renders acceptably for development and testing without an EAS build | Environment Availability | If the map doesn't render usably in Expo Go on the target Android device, an EAS dev build must be created sooner |

---

## Open Questions

1. **Google Maps API key procurement**
   - What we know: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` must be set in `.env` and `app.json`
   - What's unclear: Who obtains and manages this key? Is it already provisioned?
   - Recommendation: Add Wave 0 task to confirm key availability before map screen work begins

2. **EAS projectId configuration**
   - What we know: `app.json` still has `"projectId": "YOUR_EAS_PROJECT_ID"`; `push.ts` warns on startup
   - What's unclear: Has `eas init` been run in /mobile? Without it, push tokens cannot be registered.
   - Recommendation: Make `eas build:configure` the first task in Wave 0 of Phase 2

3. **Neighbourhood centroid source**
   - What we know: The map must show a neighbourhood pin, not exact address
   - What's unclear: Does the host enter an approximate location on the map (tap to place pin), or do they type an address and the system geocodes + offsets?
   - Recommendation: Simplest MVP approach: host taps on map to place the neighbourhood pin; the exact address is a separate text field. No geocoding API needed.

4. **City slug normalisation**
   - What we know: Socket.io group chat room is `city:{citySlug}`; User.homeCity is a string
   - What's unclear: How is `homeCity` ("New York", "new-york", "new_york") normalised to a slug?
   - Recommendation: Normalise on write in updateProfile controller: `citySlug = homeCity.toLowerCase().replace(/\s+/g, '-')`. Store both `homeCity` (display) and `citySlug` (room join) on the User model, or derive slug client-side consistently.

---

## Sources

### Primary (MEDIUM confidence — WebFetch from official docs)
- `docs.expo.dev/versions/v57.0.0/sdk/map-view/` — react-native-maps Expo Go support, app.json plugin config, PROVIDER_GOOGLE
- `docs.expo.dev/versions/v57.0.0/sdk/location/` — expo-location installation, permission APIs, accuracy levels
- `docs.expo.dev/versions/v57.0.0/sdk/notifications/` — Android push requires dev build from SDK 53, notification response handling
- `mongodb.com/docs/manual/geospatial-queries/` — $geoNear aggregation, $geoWithin, GeoJSON Point format, longitude-first convention
- `mongoosejs.com/docs/geojson.html` — 2dsphere index schema declaration, pointSchema pattern
- `socket.io/docs/v4/middlewares/` — io.use() auth middleware, socket.handshake.auth.token pattern
- `socket.io/docs/v4/rooms/` — join/leave, emit to room, auto-leave on disconnect

### Secondary (MEDIUM confidence — npm registry)
- npm view react-native-maps → 1.29.0
- npm view expo-location → 57.0.2
- npm view @react-native-community/datetimepicker → 9.1.0
- npm view socket.io-client → 4.8.3

### Tertiary (LOW confidence — codebase read)
- Phase 1 source: `backend/src/middleware/auth.js`, `backend/src/models/User.js`, `backend/src/services/notificationService.js`, `backend/src/services/storageService.js`, `backend/src/controllers/userController.js`, `mobile/src/services/api.ts`, `mobile/src/store/authStore.ts`, `mobile/src/navigation/AppNavigator.tsx`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via npm view; packages confirmed on correct registry
- Architecture: HIGH — directly derived from Phase 1 patterns in codebase + official docs for new components
- Pitfalls: HIGH — geo coordinate ordering, push on Expo Go, address leak vectors all verified from official sources
- Socket.io patterns: MEDIUM — socket.io middleware verified from official docs; DM room naming is a known pattern (project-specified in UI-SPEC)

**Research date:** 2026-07-06
**Valid until:** 2026-08-06 (30-day window; Expo SDK and react-native-maps release frequently)

---

## Project Constraints (from CLAUDE.md)

| Constraint | Source | Impact on Phase 2 |
|------------|--------|-------------------|
| Android-first; Expo managed workflow (no bare ejection) | CLAUDE.md constraints | Must use `npx expo install` for native packages; no manual linking |
| Firebase Authentication only | CLAUDE.md constraints | Socket.io auth middleware must use `getAuth().verifyIdToken()` — no custom JWT for sockets |
| MongoDB / Mongoose | CLAUDE.md constraints | All persistence via Mongoose models; geo via 2dsphere index |
| Socket.io already scaffolded | CLAUDE.md constraints | Extend `server.js` io instance; do not instantiate a second Server |
| Google Maps API (key management required) | CLAUDE.md constraints | Key via `.env` + `app.json` plugin; never hardcoded |
| Manual moderation in MVP | CLAUDE.md constraints | No automated address verification; host provides address on trust |
| No payments in MVP | CLAUDE.md constraints | All listings are free stays; no price fields in Listing model |
| Store-first messaging pattern | STATE.md locked decision | DB write MUST precede socket emit; non-negotiable |
| Separate `messages` collection | STATE.md locked decision | Never embed messages in conversation/listing documents |
| EAS Build before end of Phase 2 | STATE.md blocker | Push notification testing on Android blocked without dev build |
| Socket.io zombie connections | STATE.md concern | Socket.io 4.x auto-leaves rooms on disconnect; manual leave only for mid-session changes |
