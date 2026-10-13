# Phase 2: Housing Core — Pattern Map

**Mapped:** 2026-07-06
**Files analyzed:** 26 new/modified files
**Analogs found:** 24 / 26

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `backend/src/models/Listing.js` | model | CRUD | `backend/src/models/Report.js` | role-match |
| `backend/src/models/StayRequest.js` | model | CRUD | `backend/src/models/Report.js` | role-match |
| `backend/src/models/Conversation.js` | model | CRUD | `backend/src/models/Report.js` | role-match |
| `backend/src/models/Message.js` | model | event-driven | `backend/src/models/Report.js` | role-match |
| `backend/src/routes/listings.js` | route | request-response | `backend/src/routes/users.js` | exact |
| `backend/src/routes/requests.js` | route | request-response | `backend/src/routes/users.js` | exact |
| `backend/src/routes/conversations.js` | route | request-response | `backend/src/routes/users.js` | exact |
| `backend/src/controllers/listingController.js` | controller | CRUD + file-I/O | `backend/src/controllers/userController.js` | exact |
| `backend/src/controllers/requestController.js` | controller | CRUD | `backend/src/controllers/userController.js` | exact |
| `backend/src/controllers/conversationController.js` | controller | CRUD | `backend/src/controllers/userController.js` | exact |
| `backend/src/socket/chatHandler.js` | socket handler | event-driven | `backend/src/server.js` (io.on block) | partial (no full analog) |
| `backend/src/server.js` (modify) | config | event-driven | self | self |
| `mobile/src/store/listingStore.ts` | store | CRUD | `mobile/src/store/profileStore.ts` | exact |
| `mobile/src/store/conversationStore.ts` | store | event-driven | `mobile/src/store/authStore.ts` | role-match |
| `mobile/src/store/socketStore.ts` | store | event-driven | `mobile/src/store/authStore.ts` | role-match |
| `mobile/src/services/socketService.ts` | service | event-driven | `mobile/src/services/api.ts` | role-match |
| `mobile/src/services/api.ts` (extend) | service | request-response | self | self |
| `mobile/src/navigation/AppNavigator.tsx` (modify) | navigation | request-response | self | self |
| `mobile/src/screens/Housing/MapDiscoveryScreen.tsx` | screen | request-response | `mobile/src/screens/Profile/ProfileScreen.tsx` | role-match |
| `mobile/src/screens/Housing/ListingDetailScreen.tsx` | screen | request-response | `mobile/src/screens/Profile/ViewProfileScreen.tsx` | role-match |
| `mobile/src/screens/Housing/CreateListingScreen.tsx` | screen | file-I/O + CRUD | `mobile/src/screens/Profile/EditProfileScreen.tsx` | role-match |
| `mobile/src/screens/Requests/HostInboxScreen.tsx` | screen | CRUD | `mobile/src/screens/Profile/ProfileScreen.tsx` | role-match |
| `mobile/src/screens/Requests/RequestStatusScreen.tsx` | screen | CRUD | `mobile/src/screens/Profile/ViewProfileScreen.tsx` | role-match |
| `mobile/src/screens/Messages/ConversationListScreen.tsx` | screen | CRUD | `mobile/src/screens/Profile/ProfileScreen.tsx` | role-match |
| `mobile/src/screens/Messages/DirectMessageScreen.tsx` | screen | event-driven | no analog | none |
| `mobile/src/screens/Messages/CityGroupChatScreen.tsx` | screen | event-driven | no analog | none |

---

## Pattern Assignments

### `backend/src/models/Listing.js` (model, CRUD)

**Analog:** `backend/src/models/Report.js` — copy the Schema/model import pattern and `{ timestamps: true }`.

**Imports + module.exports pattern** (`Report.js` lines 1, 28):
```javascript
const { Schema, model } = require('mongoose');
// ... schema definition ...
module.exports = model('Listing', listingSchema);
```

**Core model pattern** (copy field style from `Report.js`, add geo index per RESEARCH Pattern 1):
```javascript
const listingSchema = new Schema({
  ownerUid:    { type: String, required: true, index: true },
  title:       { type: String, required: true, trim: true },
  description: { type: String, maxlength: 2000 },
  houseRules:  { type: String, maxlength: 1000 },
  // Neighbourhood centroid — always safe to send to clients
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true }, // [lng, lat] — longitude FIRST
  },
  exactAddress: { type: String, required: true }, // NEVER sent in API responses (see controller)
  citySlug:    { type: String, required: true, index: true },
  photos:      [{ type: String }],
  availabilityDates: [{
    from: { type: Date, required: true },
    to:   { type: Date, required: true },
  }],
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

// REQUIRED for $geoNear — must be declared in schema (not a later migration)
listingSchema.index({ location: '2dsphere' });
```

**What to change vs Report.js:** Add GeoJSON `location` field, `exactAddress`, `availabilityDates` array, `isActive`, and the 2dsphere index call. Remove `reporterUid`, `status`, `reason`.

---

### `backend/src/models/StayRequest.js` (model, CRUD)

**Analog:** `backend/src/models/Report.js`

**Core pattern** (enum + default copied from `Report.js` lines 22–26, adapted per RESEARCH Pattern 6):
```javascript
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

**What to change:** Replace `reporterUid`/`reason` fields with housing-specific fields. `Schema.Types.ObjectId` ref is new — not in Report.js, but is standard Mongoose.

---

### `backend/src/models/Conversation.js` + `backend/src/models/Message.js` (model, event-driven)

**Analog:** `backend/src/models/Report.js` (enum/default style)

**Conversation core** (RESEARCH Pattern 7):
```javascript
const conversationSchema = new Schema({
  type: { type: String, enum: ['dm', 'group'], required: true },
  participants: [{ type: String }],   // Firebase UIDs
  citySlug: { type: String },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  lastMessageAt: { type: Date },
  lastMessagePreview: { type: String },
}, { timestamps: true });
```

**Message core** (RESEARCH Pattern 7 — note compound indexes):
```javascript
const messageSchema = new Schema({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', index: true },
  citySlug: { type: String, index: true },
  senderUid: { type: String, required: true },
  content: { type: String, required: true, maxlength: 2000 },
  type: { type: String, enum: ['dm', 'group'], required: true },
}, { timestamps: true });
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ citySlug: 1, createdAt: -1 });
```

---

### `backend/src/routes/listings.js` (route, request-response)

**Analog:** `backend/src/routes/users.js` — copy the entire file structure.

**Imports pattern** (`users.js` lines 1–4):
```javascript
const router = require('express').Router();
const multer = require('multer');
const { verifyFirebaseToken, requireVerified } = require('../middleware/auth');
const listingController = require('../controllers/listingController');
```

**Multer for multi-photo uploads** (adapt from `users.js` lines 14–20 — use `.array()` instead of `.fields()`):
```javascript
const uploadPhotos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
}).array('photos', 10); // max 10 photos per listing
```

**Route pattern** (`users.js` lines 29, 59, 113 — auth middleware chain):
```javascript
// All listing routes require verified auth
router.get('/search', verifyFirebaseToken, requireVerified, listingController.searchListings);
router.post('/', verifyFirebaseToken, requireVerified, uploadPhotos, listingController.createListing);
router.get('/:id', verifyFirebaseToken, requireVerified, listingController.getListingDetail);
router.patch('/:id', verifyFirebaseToken, requireVerified, listingController.updateListing);
router.delete('/:id', verifyFirebaseToken, requireVerified, listingController.deleteListing);

module.exports = router;
```

**What to change:** Swap `userController` for `listingController`. Use `.array('photos', 10)` not `.fields()`. Add `GET /search` before `GET /:id` (static before dynamic — pattern from `users.js` comments at line 68–70).

---

### `backend/src/routes/requests.js` (route, request-response)

**Analog:** `backend/src/routes/users.js`

```javascript
const router = require('express').Router();
const { verifyFirebaseToken, requireVerified } = require('../middleware/auth');
const requestController = require('../controllers/requestController');

router.post('/', verifyFirebaseToken, requireVerified, requestController.createRequest);
router.get('/inbox', verifyFirebaseToken, requireVerified, requestController.getHostInbox);
router.patch('/:id', verifyFirebaseToken, requireVerified, requestController.updateRequestStatus);

module.exports = router;
```

---

### `backend/src/routes/conversations.js` (route, request-response)

**Analog:** `backend/src/routes/users.js`

```javascript
const router = require('express').Router();
const { verifyFirebaseToken, requireVerified } = require('../middleware/auth');
const conversationController = require('../controllers/conversationController');

router.post('/', verifyFirebaseToken, requireVerified, conversationController.createConversation);
router.get('/', verifyFirebaseToken, requireVerified, conversationController.listConversations);
router.patch('/:id/accept', verifyFirebaseToken, requireVerified, conversationController.acceptConversation);
router.patch('/:id/decline', verifyFirebaseToken, requireVerified, conversationController.declineConversation);
router.get('/:id/messages', verifyFirebaseToken, requireVerified, conversationController.getMessages);

module.exports = router;
```

---

### `backend/src/controllers/listingController.js` (controller, CRUD + file-I/O)

**Analog:** `backend/src/controllers/userController.js` — copy the entire controller shape.

**Imports pattern** (`userController.js` lines 1–3):
```javascript
const Listing = require('../models/Listing');
const StayRequest = require('../models/StayRequest');
const { uploadFile, getSignedUrl } = require('../services/storageService');
const { sendPushNotification } = require('../services/notificationService');
```

**Try/catch + console.error pattern** (`userController.js` lines 22–59, every function):
```javascript
async function createListing(req, res) {
  try {
    // ... validation and business logic ...
    res.status(201).json({ data: listing });
  } catch (err) {
    console.error('[createListing]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

**Explicit projection pattern** (`userController.js` lines 155–169 — `getProfile` builds `data = {}` explicitly):
```javascript
// In getListingDetail — NEVER spread raw Mongoose document
const data = {
  id: listing._id,
  title: listing.title,
  // ... other safe fields ...
  exactAddress: acceptedRequest ? listing.exactAddress : null, // address hiding
  addressRevealed: !!acceptedRequest,
  // exactAddress deliberately omitted from search endpoints
};
res.json({ data });
```

**Ownership guard** (new pattern — no direct analog, but derived from `blockUser` self-check at `userController.js` line 244):
```javascript
if (listing.ownerUid !== req.user.uid) {
  return res.status(403).json({ error: 'Not authorized' });
}
```

**Photo upload pattern** — copy from `uploadProfilePhoto` (`userController.js` lines 192–218), change path to `listings/{listingId}/photos/{i}`:
```javascript
const storagePath = `listings/${listing._id}/photos/${i}`;
await uploadFile(storagePath, file.buffer, file.mimetype);
```

**module.exports** (`userController.js` lines 299–307):
```javascript
module.exports = { createListing, searchListings, getListingDetail, updateListing, deleteListing };
```

---

### `backend/src/controllers/requestController.js` (controller, CRUD)

**Analog:** `backend/src/controllers/userController.js`

**Key pattern — status update + push notification** (derived from `savePushToken` + `notificationService` usage):
```javascript
async function updateRequestStatus(req, res) {
  try {
    const { status } = req.body;
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const request = await StayRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Not found' });
    if (request.hostUid !== req.user.uid) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    request.status = status;
    await request.save();

    // Push notification to guest
    const guest = await User.findOne({ firebaseUid: request.guestUid });
    await sendPushNotification(
      guest?.expoPushToken,
      status === 'accepted' ? 'Stay request accepted' : 'Stay request declined',
      status === 'accepted' ? 'Your request was accepted!' : 'Your request was declined.',
      { type: 'stay_request', requestId: String(request._id), status }
    );
    res.json({ data: request });
  } catch (err) {
    console.error('[updateRequestStatus]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

---

### `backend/src/controllers/conversationController.js` (controller, CRUD)

**Analog:** `backend/src/controllers/userController.js`

**Accept/decline pattern** (mirrors `updateRequestStatus`, same try/catch + ownership guard shape):
```javascript
async function acceptConversation(req, res) {
  try {
    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ error: 'Not found' });
    if (!convo.participants.includes(req.user.uid)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    convo.status = 'accepted';
    await convo.save();
    res.json({ data: convo });
  } catch (err) {
    console.error('[acceptConversation]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

---

### `backend/src/socket/chatHandler.js` (socket handler, event-driven)

**Analog:** `backend/src/server.js` lines 25–28 (existing `io.on('connection')` block) — extend, do not replace.

**No full analog exists** — chatHandler is the first real Socket.io handler in this codebase. Use RESEARCH Pattern 4 as the implementation blueprint.

**Integration point in `server.js`** — add after existing `io.on` block (lines 25–28):
```javascript
// Replace the placeholder io.on block with:
const { registerSocketHandlers } = require('./socket/chatHandler');
registerSocketHandlers(io);
```

**chatHandler.js full pattern** (RESEARCH Pattern 4):
```javascript
const { getAuth } = require('firebase-admin/auth');
const Message = require('../models/Message');
const { sendPushNotification } = require('../services/notificationService');

function registerSocketHandlers(io) {
  // Auth middleware — runs for EVERY connection before any event
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Missing auth token'));
    try {
      const decoded = await getAuth().verifyIdToken(token);
      socket.data.uid = decoded.uid;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { uid } = socket.data;

    socket.on('join:dm', ({ otherUid }) => {
      const room = `dm:${[uid, otherUid].sort().join('_')}`; // sorted = deterministic
      socket.join(room);
    });

    socket.on('join:city', ({ citySlug }) => {
      socket.join(`city:${citySlug}`);
    });

    // STORE-FIRST (locked decision): DB write MUST precede emit
    socket.on('message:dm', async ({ otherUid, content }) => {
      const room = `dm:${[uid, otherUid].sort().join('_')}`;
      try {
        const msg = await Message.create({ type: 'dm', room, senderUid: uid, content });
        io.to(room).emit('message:new', { _id: msg._id, senderUid: uid, content, createdAt: msg.createdAt });
      } catch {
        socket.emit('message:error', { error: 'Message not saved' });
      }
    });

    socket.on('message:city', async ({ citySlug, content }) => {
      const room = `city:${citySlug}`;
      try {
        const msg = await Message.create({ type: 'group', citySlug, senderUid: uid, content });
        io.to(room).emit('message:new', { _id: msg._id, senderUid: uid, content, createdAt: msg.createdAt });
      } catch {
        socket.emit('message:error', { error: 'Message not saved' });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}

module.exports = { registerSocketHandlers };
```

---

### `backend/src/server.js` (modify — route registration + CORS fix)

**Analog:** self — add three new route imports and fix CORS.

**Add route registrations** (after line 21, following the pattern of lines 19–21):
```javascript
const listingsRouter   = require('./routes/listings');
const requestsRouter   = require('./routes/requests');
const conversationsRouter = require('./routes/conversations');
// ...
app.use('/api/listings',      listingsRouter);
app.use('/api/requests',      requestsRouter);
app.use('/api/conversations', conversationsRouter);
```

**CORS fix** (line 14 — replace `origin: '*'`):
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

---

### `mobile/src/store/listingStore.ts` (store, CRUD)

**Analog:** `mobile/src/store/profileStore.ts` — exact copy of structure.

**Imports + create pattern** (`profileStore.ts` lines 1, 30–34):
```typescript
import { create } from 'zustand';

interface ListingState {
  listings: Listing[];
  selectedListing: Listing | null;
  setListings: (listings: Listing[]) => void;
  setSelectedListing: (listing: Listing | null) => void;
  clear: () => void;
}

export const useListingStore = create<ListingState>()((set) => ({
  listings: [],
  selectedListing: null,
  setListings: (listings) => set({ listings }),
  setSelectedListing: (selectedListing) => set({ selectedListing }),
  clear: () => set({ listings: [], selectedListing: null }),
}));
```

**What to change:** Replace `Profile` type with `Listing` type. Add `listings[]` array (profileStore only holds one profile).

---

### `mobile/src/store/conversationStore.ts` (store, event-driven)

**Analog:** `mobile/src/store/authStore.ts` — copy the multi-field state + action shape (`authStore.ts` lines 17–35).

**Pattern:**
```typescript
import { create } from 'zustand';

interface ConversationState {
  conversations: Conversation[];
  activeMessages: Message[];
  setConversations: (convos: Conversation[]) => void;
  appendMessage: (msg: Message) => void;
  clear: () => void;
}

export const useConversationStore = create<ConversationState>()((set) => ({
  conversations: [],
  activeMessages: [],
  setConversations: (conversations) => set({ conversations }),
  appendMessage: (msg) => set((s) => ({ activeMessages: [...s.activeMessages, msg] })),
  clear: () => set({ conversations: [], activeMessages: [] }),
}));
```

---

### `mobile/src/store/socketStore.ts` (store, event-driven)

**Analog:** `mobile/src/store/authStore.ts` (nullable singleton + setter pattern)

```typescript
import { create } from 'zustand';
import type { Socket } from 'socket.io-client';

interface SocketState {
  socket: Socket | null;
  connected: boolean;
  setSocket: (socket: Socket | null) => void;
  setConnected: (connected: boolean) => void;
  clear: () => void;
}

export const useSocketStore = create<SocketState>()((set) => ({
  socket: null,
  connected: false,
  setSocket: (socket) => set({ socket }),
  setConnected: (connected) => set({ connected }),
  clear: () => set({ socket: null, connected: false }),
}));
```

---

### `mobile/src/services/socketService.ts` (service, event-driven)

**Analog:** `mobile/src/services/api.ts` — copy `authHeaders` token pattern (lines 5–11), adapted for socket auth.

**Token acquisition** (`api.ts` lines 5–11):
```typescript
import { auth } from '../config/firebase';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
```

**Full service pattern** (RESEARCH Pattern 5):
```typescript
import { io, Socket } from 'socket.io-client';
import { auth } from '../config/firebase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;
  const token = await auth.currentUser?.getIdToken();
  socket = io(API_BASE_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
  });
  return socket;
}

export function getSocket(): Socket | null { return socket; }
export function disconnectSocket(): void { socket?.disconnect(); socket = null; }
```

---

### `mobile/src/services/api.ts` (extend with new API calls)

**Analog:** self — follow the exact pattern of every existing function (lines 17–152).

**Pattern to copy for each new endpoint** (e.g. `getUserProfile` at lines 88–93):
```typescript
export async function searchListings(params: {
  lat: number; lng: number; radiusM?: number; fromDate?: string; toDate?: string;
}): Promise<unknown> {
  const headers = await authHeaders();
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  const res = await fetch(`${API_BASE_URL}/api/listings/search?${qs}`, { headers });
  return res.json();
}

export async function createListing(body: CreateListingPayload): Promise<unknown> {
  const token = await auth.currentUser?.getIdToken();
  // multipart — same pattern as uploadVerificationDocs (lines 27–38)
  const formData = new FormData();
  // append fields + photos
  const res = await fetch(`${API_BASE_URL}/api/listings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return res.json();
}
```

**Multipart upload:** copy the `uploadVerificationDocs` pattern exactly (`api.ts` lines 27–38) — no `Content-Type` header, let FormData set the boundary.

---

### `mobile/src/navigation/AppNavigator.tsx` (modify — add Housing/Requests/Messages tabs)

**Analog:** self (`AppNavigator.tsx` lines 1–38) — extend the existing `AppStackParamList` and `Stack.Navigator`.

**ParamList extension pattern** (`AppNavigator.tsx` lines 13–17):
```typescript
export type AppStackParamList = {
  // existing:
  Profile: undefined;
  EditProfile: undefined;
  ViewProfile: { uid: string };
  // new for Phase 2:
  MapDiscovery: undefined;
  ListingDetail: { listingId: string };
  CreateListing: undefined;
  HostInbox: undefined;
  RequestStatus: { requestId: string };
  ConversationList: undefined;
  DirectMessage: { conversationId: string; otherUid: string };
  CityGroupChat: { citySlug: string };
};
```

**Screen registration** (`AppNavigator.tsx` lines 29–37 — add new `Stack.Screen` entries):
```typescript
<Stack.Screen name="MapDiscovery" component={MapDiscoveryScreen} />
<Stack.Screen name="ListingDetail" component={ListingDetailScreen} />
// ... etc
```

**Consider converting to bottom-tab navigator** wrapping stack navigators per domain (Housing, Requests, Messages, Profile) — no existing analog for tabs, use `@react-navigation/bottom-tabs` pattern from React Navigation docs.

---

### Mobile Screens — Common Pattern

**Analog for all screens:** `mobile/src/screens/Profile/ProfileScreen.tsx` (data-display) or `mobile/src/screens/Profile/EditProfileScreen.tsx` (form/mutation).

**Screen structure pattern** (`ProfileScreen.tsx` lines 1–57):
```typescript
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../navigation/AppNavigator';
import { useListingStore } from '../../store/listingStore';
import { searchListings } from '../../services/api';

type Props = NativeStackScreenProps<AppStackParamList, 'MapDiscovery'>;

export default function MapDiscoveryScreen({ navigation }: Props) {
  const { listings, setListings } = useListingStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await searchListings({ lat: 0, lng: 0 }) as { data?: Listing[]; error?: string };
      if (res.data) setListings(res.data);
      else if (res.error) setError(res.error);
    } catch {
      setError('Failed to load listings. Please try again.');
    } finally {
      setLoading(false);
    }
  }
  // ...
}
```

**Form mutation pattern** (`EditProfileScreen.tsx` — loading state + API call + navigation):
- Copy `useState` for each form field
- Copy `try/catch` with `setError` on failure and `navigation.goBack()` on success
- Copy `ActivityIndicator` while loading

---

### `mobile/src/screens/Messages/DirectMessageScreen.tsx` + `CityGroupChatScreen.tsx` (no analog)

**No existing analog** — first real-time Socket.io screens in the codebase.

**Guidance:** These screens must:
1. Call `connectSocket()` from `socketService.ts` on mount
2. Emit `join:dm` or `join:city` immediately after connect
3. Listen for `message:new` events and call `conversationStore.appendMessage()`
4. On send: emit `message:dm` or `message:city` (server writes to DB first, then echoes back via `message:new`)
5. Call `disconnectSocket()` or `socket.emit('leave:room')` on unmount only if intentionally leaving mid-session

Use `useEffect` cleanup pattern consistent with `ProfileScreen.tsx` (no complex cleanup needed there, but `DirectMessageScreen` must remove socket listeners in cleanup):
```typescript
useEffect(() => {
  const sock = await connectSocket(); // async — use IIFE or separate async fn
  sock.emit('join:dm', { otherUid });
  sock.on('message:new', (msg) => appendMessage(msg));
  return () => { sock.off('message:new'); };
}, []);
```

---

## Shared Patterns

### Authentication — All Backend Routes

**Source:** `backend/src/middleware/auth.js` (lines 3–29)
**Apply to:** All new route files (`listings.js`, `requests.js`, `conversations.js`)

```javascript
const { verifyFirebaseToken, requireVerified } = require('../middleware/auth');
// Every new protected route:
router.verb('/path', verifyFirebaseToken, requireVerified, controller.handler);
```

Both middlewares are required on all Phase 2 routes — `verifyFirebaseToken` alone is not sufficient (must also confirm `isVerified`).

---

### Error Handling — All Backend Controllers

**Source:** `backend/src/controllers/userController.js` (every function, e.g. lines 22–59)
**Apply to:** All new controller files

```javascript
async function handlerName(req, res) {
  try {
    // business logic
    res.json({ data: result });
  } catch (err) {
    console.error('[handlerName]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

Consistent label format: `[functionName]` in `console.error` call.

---

### Explicit API Projection — All Listing Endpoints

**Source:** `backend/src/controllers/userController.js` lines 155–169 (`getProfile`)
**Apply to:** `listingController.js` — every function that returns listing data

Never spread the raw Mongoose document. Build `data = { field1, field2, ... }` explicitly. Add comment `// exactAddress deliberately omitted` on every listing list/search response.

---

### Push Notification — After Status Changes

**Source:** `backend/src/services/notificationService.js` (lines 14–17)
**Apply to:** `requestController.js` (on accept/decline), `conversationController.js` (on new message)

```javascript
const { sendPushNotification } = require('../services/notificationService');
// After DB write:
await sendPushNotification(user.expoPushToken, title, body, { type: '...', id: '...' });
```

`sendPushNotification` is a no-op if token is null/invalid — safe to call unconditionally.

---

### Mobile Auth Token — All New API Calls

**Source:** `mobile/src/services/api.ts` lines 5–11 (`authHeaders`)
**Apply to:** All new functions added to `api.ts`

```typescript
async function authHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}
```

For multipart requests: use `Authorization` only (no `Content-Type`) — `api.ts` lines 27–38.

---

### Zustand Store Structure — All New Stores

**Source:** `mobile/src/store/profileStore.ts` (lines 1–34)
**Apply to:** `listingStore.ts`, `conversationStore.ts`, `socketStore.ts`

Pattern: `create<StateInterface>()((set) => ({ ...initialState, ...actions }))`. Always include a `clear()` action for sign-out cleanup. Export named hook `use<Name>Store`.

---

### Navigation TypeScript Param List

**Source:** `mobile/src/navigation/AppNavigator.tsx` lines 13–17
**Apply to:** All new screen files

Each screen types its props with:
```typescript
type Props = NativeStackScreenProps<AppStackParamList, 'ScreenName'>;
export default function ScreenName({ navigation, route }: Props) { ... }
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `mobile/src/screens/Messages/DirectMessageScreen.tsx` | screen | event-driven | No Socket.io screens exist yet |
| `mobile/src/screens/Messages/CityGroupChatScreen.tsx` | screen | event-driven | No Socket.io screens exist yet |

Use RESEARCH Patterns 4 and 5 as implementation blueprint for both. The store-first pattern (DB write before emit) is enforced server-side; the client just listens for `message:new` events.

---

## Critical Constraints (from RESEARCH + CLAUDE.md)

| Constraint | Where Enforced | Pattern Source |
|------------|----------------|----------------|
| `exactAddress` never in search/list responses | `listingController.js` explicit projection | `userController.getProfile` lines 155–169 |
| Store-first: DB write before socket emit | `chatHandler.js` `message:dm` / `message:city` handlers | RESEARCH Pattern 4 |
| GeoJSON coordinates: `[longitude, latitude]` (longitude FIRST) | `Listing.js` schema + `listingController.searchListings` | RESEARCH Pitfall 2 |
| 2dsphere index declared in schema (not migration) | `Listing.js` `listingSchema.index(...)` call | RESEARCH Pitfall 3 |
| DM room name: sorted UIDs — `dm:{uid1}_{uid2}` | `chatHandler.js` `join:dm` + `message:dm` handlers | RESEARCH Pattern 4 |
| Separate `messages` collection — never embed | `Message.js` standalone model | RESEARCH locked decision |
| Socket auth via `getAuth().verifyIdToken()` | `chatHandler.js` `io.use()` middleware | `auth.js` lines 10–11 |
| Multer `memoryStorage` + `resumable: false` for uploads | `listings.js` multer config + `storageService.js` | `storageService.js` lines 24–27 |

---

## Metadata

**Analog search scope:** `backend/src/models/`, `backend/src/routes/`, `backend/src/controllers/`, `backend/src/services/`, `backend/src/middleware/`, `backend/src/server.js`, `mobile/src/store/`, `mobile/src/services/`, `mobile/src/navigation/`, `mobile/src/screens/Profile/`
**Files scanned:** 16
**Pattern extraction date:** 2026-07-06
