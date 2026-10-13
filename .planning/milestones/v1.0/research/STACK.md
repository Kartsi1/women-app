# Stack Research: WomenApp

**Project:** Women-only safety/travel/housing platform
**Researched:** 2026-07-02
**Basis:** Training knowledge through August 2025 + project scaffold context
**Expo version:** 57.0.1 (React Native 0.86.0, React 19.2.3)
**Workflow constraint:** Expo managed workflow — no bare ejection for MVP

---

## Navigation

**Recommendation: React Navigation 7 (NOT Expo Router)**

Use `@react-navigation/native` v7 + Native Stack + Bottom Tabs.

**Why React Navigation over Expo Router:**
- The existing scaffold has `src/navigation/` — this is the React Navigation pattern; changing to Expo Router's `app/` directory convention would require restructuring the entire project
- Auth gates (unverified user vs. verified user vs. admin) are dramatically cleaner to implement with code-based conditional routing than file-based routing
- Expo Router is optimal for web-hybrid apps where URL-addressability matters; this is an Android-first mobile app
- React Navigation v7 introduced the Static API which provides full TypeScript type safety for navigation props — matching the project's `strict: true` tsconfig

**Nav structure for this app:**
```
RootNavigator (Stack)
  ├── AuthStack (Stack) — for unauthenticated / unverified users
  │   ├── Splash
  │   ├── Login
  │   ├── Register
  │   └── VerificationPending
  └── MainTabs (Bottom Tabs) — for verified users only
      ├── Feed (Stack)
      ├── Listings (Stack)
      ├── Chat (Stack)  
      ├── Events (Stack)
      └── Profile (Stack)
```

**Packages:**
```bash
npx expo install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context
```

| Package | Version | Purpose |
|---------|---------|---------|
| `@react-navigation/native` | ^7.x | Core navigation library |
| `@react-navigation/native-stack` | ^7.x | Native-performance stack navigator (uses `react-native-screens`) |
| `@react-navigation/bottom-tabs` | ^7.x | Bottom tab bar for main app |
| `react-native-screens` | ^4.x | Native screen containers — required peer dep, managed-workflow compatible |
| `react-native-safe-area-context` | ^5.x | Safe area insets — required peer dep |

**Confidence: HIGH** — React Navigation 7 is the stable industry standard; its compatibility with Expo 57 managed workflow is well-established.

---

## State Management

**Recommendation: Zustand 5 (already decided in PROJECT.md — confirmed correct)**

Zustand is the right call for this scope. No boilerplate, no provider wrapping, small bundle.

**Store structure:**
| Store | Contents |
|-------|----------|
| `authStore` | Firebase user object, verification status, Firebase ID token |
| `listingsStore` | listing browse list, active listing, search filters, map region |
| `chatStore` | conversations list, active conversation, message list, socket connection status |
| `notificationsStore` | unread counts, notification list |
| `uiStore` | loading states, modal visibility, toast queue |

**Package:**
```bash
npx expo install zustand
```

| Package | Version | Purpose |
|---------|---------|---------|
| `zustand` | ^5.0 | Global state management |

**Note on Zustand 5 vs 4:** Zustand 5 (October 2024) requires React 18+. This project uses React 19.2.3, so v5 is correct. The API is nearly identical to v4 with some TypeScript improvements. If any instability is encountered at time of install, `zustand@^4.5` is a safe fallback — same API.

**Confidence: HIGH**

---

## UI Library

**Recommendation: React Native Paper v5 (Material Design 3)**

**Why React Native Paper:**
- Works in Expo managed workflow out of the box — no config plugin, no native modules
- Material Design 3 (Material You) — modern, accessible, clean
- Provides all needed components: Cards, Lists, FABs, Dialogs, Chips, TextInput, Button, Avatar, BottomNavigation
- Theming system supports the warm, safety-focused brand palette the app needs
- Uses `@expo/vector-icons` (already in Expo 57 SDK) — no additional icon setup
- Large community, actively maintained

**What NOT to use:**
- NativeBase — deprecated, do not use
- Gluestack UI — the NativeBase successor; technically valid but setup complexity is higher than Paper for MVP
- NativeWind v4 — Tailwind for RN is compelling but adds a build-step and learning curve; save for when you have a dedicated designer who writes Tailwind; Paper is faster for MVP

**Package:**
```bash
npx expo install react-native-paper react-native-vector-icons
```

| Package | Version | Purpose |
|---------|---------|---------|
| `react-native-paper` | ^5.x | Material Design 3 component library |
| `@expo/vector-icons` | already in Expo 57 | Icon set (Paper uses this when available) |

**Configuration in App.tsx:**
```typescript
import { PaperProvider } from 'react-native-paper';
// Wrap root with <PaperProvider theme={customTheme}>
```

**Confidence: HIGH**

---

## Authentication (Firebase)

**Recommendation: Firebase JS SDK v11 (NOT @react-native-firebase)**

**Critical distinction — two Firebase SDKs exist:**

| SDK | Expo managed? | Setup |
|-----|--------------|-------|
| `firebase` (JS SDK) | YES — pure JS, no native modules | `npx expo install firebase` |
| `@react-native-firebase` | NO — requires bare workflow or config plugin + EAS Build | Complex |

For Expo 57 managed workflow: use the JS SDK (`firebase` v11). It is pure JavaScript and works identically to the web SDK.

**Required setup — auth persistence in React Native:**

The Firebase JS SDK defaults to in-memory auth state (lost on app restart). You MUST configure AsyncStorage persistence:

```typescript
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const app = initializeApp(firebaseConfig);

// CRITICAL: use initializeAuth, NOT getAuth, in React Native
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
```

**Auth methods for this app:**
| Method | Package | Notes |
|--------|---------|-------|
| Email + password | `firebase/auth` | Primary signup method |
| Google Sign-In | `expo-auth-session` + `expo-web-browser` | OAuth via browser redirect |
| Phone auth | NOT recommended for MVP | Requires reCAPTCHA handling in RN — complex; email is simpler |

**Token flow for backend:**
```typescript
// Get Firebase ID token to authenticate backend API calls
const token = await auth.currentUser.getIdToken();
// Send as: Authorization: Bearer <token>
// Backend: use firebase-admin to verify token
```

**Backend: Firebase Admin SDK for token verification:**
```bash
npm install firebase-admin
```

**Packages:**
```bash
npx expo install firebase @react-native-async-storage/async-storage expo-auth-session expo-web-browser
```

| Package | Version | Purpose |
|---------|---------|---------|
| `firebase` | ^11.x | Firebase JS SDK (auth, storage) |
| `@react-native-async-storage/async-storage` | ^2.x | Auth state persistence |
| `expo-auth-session` | SDK 57 | OAuth session handling (Google Sign-In) |
| `expo-web-browser` | SDK 57 | Browser redirect for OAuth |
| `firebase-admin` (backend) | ^12.x | Token verification + FCM on backend |

**Confidence: HIGH** — Firebase JS SDK v11 in Expo managed workflow is a well-documented, standard pattern.

---

## Maps

**Recommendation: react-native-maps v1.x with Google Maps provider (NOT expo-maps)**

**Why NOT expo-maps:**
- `expo-maps` is a new Expo SDK package (introduced ~Expo 51-52) but as of mid-2025 remains in active development with a less stable API
- Fewer community examples and troubleshooting resources
- Uses Apple Maps on iOS by default; Google Maps requires additional config
- Not yet production-battle-tested at scale

**Why react-native-maps:**
- Industry standard with massive community (14k+ GitHub stars)
- Explicit `PROVIDER_GOOGLE` prop ensures Google Maps on both Android and iOS
- Cluster support via `react-native-map-clustering` or similar
- Expo managed workflow support via `npx expo install` (config plugin built-in since Expo 51)
- Google Maps API key injection via `app.json` without touching native files

**Installation:**
```bash
npx expo install react-native-maps
```

**app.json configuration:**
```json
{
  "expo": {
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "$(GOOGLE_MAPS_ANDROID_KEY)"
        }
      }
    },
    "ios": {
      "config": {
        "googleMapsApiKey": "$(GOOGLE_MAPS_IOS_KEY)"
      }
    }
  }
}
```

**API key security:** Store keys in `.env` + EAS Secrets for builds. NEVER hardcode in source. Use `expo-constants` to access `Constants.expoConfig.extra` in app code for the web-facing key (for reverse geocoding API calls).

**Usage pattern:**
```typescript
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

<MapView
  provider={PROVIDER_GOOGLE}
  style={{ flex: 1 }}
  initialRegion={region}
>
  {listings.map(listing => (
    <Marker key={listing._id} coordinate={listing.location.coordinates} />
  ))}
</MapView>
```

| Package | Version | Purpose |
|---------|---------|---------|
| `react-native-maps` | ^1.10 | Map rendering, markers, clustering support |

**Confidence: MEDIUM-HIGH** — react-native-maps is stable; however, Expo's managed workflow config plugin behavior with v1.10+ in Expo 57 specifically should be tested early (potential version pin required). expo-maps is not yet production-ready.

---

## Real-time / Chat

**Recommendation: socket.io-client v4.7 (matches backend Socket.io 4.7.5 already scaffolded)**

The backend already has Socket.io 4.7.5. The client must match the major version.

**Key patterns for React Native:**

**1. Always use WebSocket transport (skip polling):**
```typescript
import { io, Socket } from 'socket.io-client';

const socket = io(BACKEND_URL, {
  auth: { token: firebaseIdToken },
  transports: ['websocket'], // CRITICAL: skip long-polling on mobile
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
```

Defaulting to `['polling', 'websocket']` causes unnecessary HTTP overhead on mobile and delays real-time delivery. Websocket-first is mandatory.

**2. Backend: authenticate socket connections with Firebase tokens:**
```javascript
// backend/src/socket/middleware.js
const { admin } = require('../config/firebase');

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Unauthorized'));
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    socket.userId = decoded.uid;
    next();
  } catch (e) {
    next(new Error('Invalid token'));
  }
});
```

**3. Namespace + room structure:**
```javascript
// backend/src/socket/chat.js
const chatNs = io.of('/chat');

chatNs.on('connection', (socket) => {
  // Direct message room
  socket.on('join_dm', (conversationId) => {
    socket.join(`dm:${conversationId}`);
  });
  
  // City group chat room
  socket.on('join_city', (citySlug) => {
    socket.join(`city:${citySlug}`);
  });
  
  socket.on('send_message', async (data) => {
    // 1. Save to MongoDB (source of truth)
    const message = await Message.create(data);
    // 2. Emit to room
    chatNs.to(data.roomId).emit('new_message', message);
  });
});
```

**4. Mobile: manage socket lifecycle with AppState:**
```typescript
import { AppState } from 'react-native';

// Disconnect when app goes to background to save battery
AppState.addEventListener('change', (state) => {
  if (state === 'background') socket.disconnect();
  if (state === 'active') socket.connect();
});
```

**5. Message storage is in MongoDB — Socket.io only for real-time delivery.** On reconnect, always fetch missed messages from the REST API, not from socket.

**Packages:**
```bash
npx expo install socket.io-client
```

| Package | Version | Purpose |
|---------|---------|---------|
| `socket.io-client` | ^4.7 | Real-time client (must match backend major version) |

**Confidence: HIGH** — Socket.io 4.x is mature; the patterns above are standard and well-tested.

---

## File Upload / Media

**Expo managed workflow constraints:** No direct filesystem access beyond sandboxed app directory. Must use Expo APIs for file picking.

**Recommendation: expo-image-picker + expo-document-picker → Firebase Storage**

**Why Firebase Storage over backend multer upload:**
- Eliminates a round-trip through the Node.js backend for large files
- Firebase Storage scales automatically
- Access control via Firebase Storage Security Rules (private bucket for ID docs, public for listing photos)
- Already using Firebase Auth — same SDK, no additional auth setup
- Firebase JS SDK v11 `firebase/storage` works in Expo managed workflow (pure JS)

**Flow for listing photos:**
```
User picks photo (expo-image-picker)
  → Upload directly to Firebase Storage (firebase/storage)
    → Get download URL
      → Save URL to MongoDB listing document via backend REST API
```

**Flow for ID verification documents:**
```
User picks document/photo (expo-document-picker or expo-image-picker)
  → Upload to PRIVATE Firebase Storage bucket (path: /verification/{userId}/{filename})
    → Get Storage path (not public URL)
      → POST to backend: { userId, storagePath, submittedAt }
        → Backend creates verificationRequest in MongoDB
          → Admin reviews in Firebase Console (or custom admin panel)
```

**Packages:**
```bash
npx expo install expo-image-picker expo-document-picker
# firebase/storage is included in the firebase package already installed
```

| Package | Version | Purpose |
|---------|---------|---------|
| `expo-image-picker` | SDK 57 | Camera + gallery access for listing photos |
| `expo-document-picker` | SDK 57 | File picker for ID documents (PDF, image) |
| `firebase/storage` | ^11.x | Firebase Storage SDK (included in `firebase` package) |

**Backend backend package (for Admin access to private bucket):**
```bash
npm install firebase-admin  # already recommended for auth
```

**Firebase Storage Security Rules example:**
```
// Listing photos — public read, authenticated write
match /listings/{listingId}/{fileName} {
  allow read: if true;
  allow write: if request.auth != null;
}

// Verification documents — private (admin only via Admin SDK)
match /verification/{userId}/{fileName} {
  allow read, write: if false;  // backend admin SDK bypasses rules
}
```

**Confidence: HIGH** — `expo-image-picker` and `expo-document-picker` are core Expo SDK packages, fully managed-workflow compatible. Firebase Storage JS SDK in RN is well-documented.

---

## Push Notifications

**Recommendation: expo-notifications (NOT @react-native-firebase/messaging)**

`expo-notifications` is the correct choice for Expo managed workflow. It wraps FCM on Android and APNs on iOS, handled transparently.

**Why NOT @react-native-firebase/messaging:**
- Requires bare workflow or a complex Expo config plugin
- Adds native dependency overhead
- `expo-notifications` provides everything needed for MVP

**Flow:**
```
App startup
  → Request permission (expo-notifications)
    → Get Expo Push Token (EPT)
      → POST EPT to backend
        → Backend stores EPT on user document in MongoDB

Event trigger (new message, event invite, etc.)
  → Backend calls Expo Push API (HTTP POST to https://exp.host/--/api/v2/push/send)
    → Expo infrastructure routes to FCM (Android) or APNs (iOS)
      → Device receives notification
```

**Mobile setup:**
```typescript
import * as Notifications from 'expo-notifications';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Register and get token
const { status } = await Notifications.requestPermissionsAsync();
const token = (await Notifications.getExpoPushTokenAsync({
  projectId: Constants.expoConfig.extra.eas.projectId,
})).data;

// Send token to backend
await api.post('/users/push-token', { token });
```

**Backend: send via Expo Push API (no Firebase Admin SDK needed for this):**
```javascript
const { Expo } = require('expo-server-sdk');
const expo = new Expo();

const messages = [{
  to: user.expoPushToken,
  sound: 'default',
  title: 'New message',
  body: 'You have a new message',
  data: { type: 'message', conversationId },
}];

const chunks = expo.chunkPushNotifications(messages);
for (const chunk of chunks) {
  await expo.sendPushNotificationsAsync(chunk);
}
```

**Packages:**
```bash
npx expo install expo-notifications expo-device
npm install expo-server-sdk  # backend only
```

| Package | Version | Purpose | Where |
|---------|---------|---------|-------|
| `expo-notifications` | SDK 57 | Push token registration, notification handling | Mobile |
| `expo-device` | SDK 57 | Check if running on real device (required for push tokens) | Mobile |
| `expo-server-sdk` | ^3.x | Send push notifications via Expo API | Backend |

**EAS Project ID requirement:** Starting with Expo 49, `getExpoPushTokenAsync` requires an `experienceId` or EAS `projectId`. This means EAS Build must be configured before push notifications work on a real device. Set up EAS early in the project.

**Confidence: HIGH** — `expo-notifications` is the standard Expo managed workflow push solution. The Expo Push API is reliable for MVP scale.

---

## Database Schema Approach

**Recommendation: Document-per-entity with embedded subdocuments for tight relationships; separate collections for high-volume data (messages)**

**Why this shape for MongoDB:**
- User profiles, listings, events are read-heavy → embed related data to avoid joins
- Messages are write-heavy and high-volume → separate collection with compound index
- Location search requires 2dsphere index → standardize coordinate format across all collections

### Users Collection
```javascript
{
  _id: ObjectId,
  firebaseUid: String,          // unique index — primary FK from Firebase Auth
  email: String,
  displayName: String,
  avatarUrl: String,            // Firebase Storage public URL
  bio: String,
  languages: [String],
  
  verification: {               // embedded — tightly coupled to user lifecycle
    status: 'unverified' | 'pending' | 'approved' | 'rejected',
    documentStoragePath: String, // Firebase Storage private path (not URL)
    submittedAt: Date,
    reviewedAt: Date,
    rejectionReason: String,
  },
  
  rating: {
    asHost: { average: Number, count: Number },
    asGuest: { average: Number, count: Number },
  },
  
  location: {
    city: String,
    country: String,
    coordinates: {
      type: 'Point',
      coordinates: [Number, Number],  // [longitude, latitude] — GeoJSON order
    },
  },
  
  expoPushTokens: [String],     // array — user may have multiple devices
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date,
}
// Indexes:
// { firebaseUid: 1 } unique
// { 'location.coordinates': '2dsphere' }
// { 'verification.status': 1 }
```

### Listings Collection
```javascript
{
  _id: ObjectId,
  hostId: ObjectId,             // ref Users
  type: 'free' | 'paid',
  title: String,
  description: String,
  photos: [String],             // Firebase Storage public URLs
  
  location: {
    address: String,
    city: String,
    country: String,
    coordinates: {
      type: 'Point',
      coordinates: [Number, Number],
    },
  },
  
  pricePerNight: Number,        // null/0 if free
  currency: String,             // 'USD', 'EUR', etc. — set by host
  maxGuests: Number,
  amenities: [String],
  houseRules: [String],
  
  availability: {
    from: Date,
    to: Date,
    isAlwaysAvailable: Boolean,
  },
  
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date,
}
// Indexes:
// { 'location.coordinates': '2dsphere' }
// { 'location.city': 1, type: 1, isActive: 1 }
// { hostId: 1 }
```

### Conversations + Messages (separate collections)
```javascript
// Conversations — lightweight, fast to query for chat list
{
  _id: ObjectId,
  type: 'direct' | 'group',
  participants: [ObjectId],     // for direct — exactly 2 users
  citySlug: String,             // for group — 'berlin', 'paris', etc.
  
  lastMessage: {                // denormalized for chat list performance
    content: String,
    senderId: ObjectId,
    sentAt: Date,
  },
  
  unreadCounts: Map,            // { userId: count } — or handle client-side
  createdAt: Date,
  updatedAt: Date,
}
// Indexes:
// { participants: 1 }
// { citySlug: 1 }

// Messages — high volume, time-series-like
{
  _id: ObjectId,
  conversationId: ObjectId,    // ref Conversations
  senderId: ObjectId,          // ref Users
  content: String,
  type: 'text' | 'image',
  mediaUrl: String,
  
  readBy: [ObjectId],          // array of userIds who have read this message
  createdAt: Date,
}
// Indexes:
// { conversationId: 1, createdAt: 1 }  ← compound, critical for pagination
// { senderId: 1 }
```

### Events Collection
```javascript
{
  _id: ObjectId,
  organizerId: ObjectId,
  title: String,
  description: String,
  coverPhotoUrl: String,
  
  location: {
    address: String,
    city: String,
    country: String,
    coordinates: { type: 'Point', coordinates: [Number, Number] },
  },
  
  startDate: Date,
  endDate: Date,
  maxAttendees: Number,
  attendees: [ObjectId],        // array OK for events (attendance < max)
  
  isActive: Boolean,
  createdAt: Date,
}
// Indexes:
// { 'location.coordinates': '2dsphere' }
// { 'location.city': 1, startDate: 1 }
```

### Reviews Collection
```javascript
{
  _id: ObjectId,
  reviewerId: ObjectId,
  subjectId: ObjectId,         // the person being reviewed
  listingId: ObjectId,         // optional — which listing the stay was for
  role: 'host' | 'guest',
  rating: Number,              // 1-5
  comment: String,
  isPublic: Boolean,
  createdAt: Date,
}
// Indexes:
// { subjectId: 1, role: 1 }
// { reviewerId: 1, subjectId: 1 } unique (prevent duplicate reviews)
```

**Location query pattern (nearby listings):**
```javascript
Listing.find({
  'location.coordinates': {
    $near: {
      $geometry: { type: 'Point', coordinates: [userLng, userLat] },
      $maxDistance: radiusInMeters,
    }
  },
  isActive: true,
  type: filterType,  // 'free' | 'paid' | null
});
```

**Confidence: HIGH** — These schemas are standard MongoDB patterns for marketplace + chat apps. 2dsphere indexing for location is well-established.

---

## What NOT to Use

| Technology | Reason to Avoid | Use Instead |
|------------|----------------|-------------|
| **Expo Router** | File-based routing conflicts with auth-gate navigation logic; restructures project away from existing scaffold | React Navigation 7 |
| **@react-native-firebase** | Requires bare workflow (ejection) — violates the managed workflow constraint | Firebase JS SDK v11 |
| **expo-maps** | Alpha/beta quality as of 2025; less stable, fewer resources | `react-native-maps` |
| **NativeBase** | Deprecated in 2024; replaced by Gluestack UI | React Native Paper v5 |
| **Redux Toolkit** | 3x the boilerplate of Zustand for same state scope; overkill for MVP | Zustand 5 |
| **Mongoose `.populate()`** in chat | N+1 query problem at scale; for message lists, denormalize sender display info or use aggregation | Embed sender name/avatar in message doc or use `$lookup` aggregate |
| **Socket.io default transports** | Polling-first default causes latency and battery drain on mobile | Always pass `transports: ['websocket']` |
| **Base64 images in MongoDB** | Bloats documents, destroys query performance | Firebase Storage URLs only |
| **Hardcoded API keys** | Security — keys leaked in APK or source control | EAS Secrets + `app.config.js` |
| **Phone number auth (MVP)** | reCAPTCHA v2 in React Native requires a web view or bare workflow; complexity not worth it for MVP | Email/password + Google OAuth |
| **react-query / TanStack Query** | Valid library, but adds another state layer; Zustand + service functions is simpler for this scale | Zustand stores + `useEffect` fetching |

---

## Full Install Reference

### Mobile (`/mobile`)
```bash
# Navigation
npx expo install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context

# UI
npx expo install react-native-paper

# State
npx expo install zustand

# Auth + Firebase
npx expo install firebase
npx expo install @react-native-async-storage/async-storage
npx expo install expo-auth-session expo-web-browser

# Maps
npx expo install react-native-maps

# Media / File Upload  
npx expo install expo-image-picker
npx expo install expo-document-picker

# Push Notifications
npx expo install expo-notifications expo-device expo-constants

# Real-time
npx expo install socket.io-client
```

### Backend (`/backend`)
```bash
# Firebase Admin (token verification + Storage admin access)
npm install firebase-admin

# Push notification delivery
npm install expo-server-sdk

# File uploads (if any go through backend rather than direct to Firebase Storage)
npm install multer

# Input validation
npm install express-validator

# Rate limiting
npm install express-rate-limit
```

---

## Confidence Summary

| Area | Confidence | Basis | Risk |
|------|------------|-------|------|
| React Navigation 7 | HIGH | Stable, long-standing library; Expo 57 compatibility confirmed by package ecosystem | Low |
| Zustand 5 | HIGH | React 19 compatible; tiny, stable API | Low |
| React Native Paper 5 | HIGH | No native modules; managed workflow native | Low |
| Firebase JS SDK 11 | HIGH | Pure JS; well-documented in RN context; auth persistence pattern is established | Low |
| react-native-maps | MEDIUM-HIGH | Stable library; Expo 57 managed workflow config plugin support should be verified at install time | Version pin may be needed |
| Socket.io client 4.7 | HIGH | Exact match to scaffolded backend; patterns are standard | Low |
| expo-image-picker | HIGH | Core Expo SDK, fully managed | Low |
| expo-document-picker | HIGH | Core Expo SDK, fully managed | Low |
| Firebase Storage JS | HIGH | Included in firebase package; pure JS | Low |
| expo-notifications | HIGH | Core Expo SDK; EPT requires EAS project configured | EAS setup required early |
| MongoDB schemas | HIGH | Standard patterns for marketplace + chat; 2dsphere is well-documented | Low |
| expo-maps | LOW | Active development, limited resources — NOT recommended for production MVP | Avoid |

**Critical early action:** Configure EAS Build (`eas build:configure`) before attempting push notifications on a real device. Expo Push Tokens require a registered EAS project ID. This is a blocking dependency that should be done in Phase 1, not discovered in Phase 3.
