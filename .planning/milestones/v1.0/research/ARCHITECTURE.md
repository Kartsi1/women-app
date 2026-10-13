# Architecture Patterns

**Domain:** Women-only safety/travel/housing mobile platform
**Project:** WomenApp
**Researched:** 2026-07-02
**Confidence:** HIGH (well-established patterns for this app shape; no experimental tech)

---

## Recommended Architecture

### System Topology

```
┌──────────────────────────────────────────────────────────────────┐
│  MOBILE (Expo 57 / React Native)                                 │
│                                                                  │
│  Navigation (React Navigation v6)                                │
│    Auth Stack ──► Main Tab Navigator                             │
│                      ├── Listings                                │
│                      ├── Community                               │
│                      ├── Chat                                    │
│                      ├── Events                                  │
│                      └── Profile                                 │
│                                                                  │
│  Store Layer (Zustand)  ←→  Service Layer (axios + socket.io)   │
│                                   │              │               │
└───────────────────────────────────┼──────────────┼───────────────┘
                                    │              │
                               REST API        Socket.io
                                    │              │
┌───────────────────────────────────┼──────────────┼───────────────┐
│  BACKEND (Express + Socket.io)    │              │               │
│                                   ▼              ▼               │
│  Middleware chain                REST        WS Server           │
│  (firebaseAuth → requireVerified/Admin)       (socket/)          │
│                ↓                                   ↓             │
│  Routes → Controllers → Services → Models (Mongoose)             │
│                                          ↓                       │
└──────────────────────────────────────────┼───────────────────────┘
                                           │
                                      MongoDB Atlas
                                           │
                         ┌─────────────────┼─────────────────┐
                         │                 │                  │
                     Firebase           Firebase           Google
                     Auth SDK           Storage           Maps API
                  (token verify)   (photos + ID docs)   (mobile only)
```

---

## Component Boundaries

### Mobile Components

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Navigation layer | Route guards (auth/verified), tab structure, deep links | authStore for gate decisions |
| authStore (Zustand) | Firebase user object, verificationStatus, profile | Firebase SDK, apiService |
| listingsStore | Listings list, selected listing, search filters/results | apiService |
| chatStore | Conversations list, active messages, unread counts | socketService, apiService |
| communityStore | Posts feed, comments, pagination cursor | apiService |
| eventsStore | Events list, RSVP state | apiService |
| apiService | Axios client singleton; attaches Firebase ID token as Bearer | Backend REST API |
| socketService | Socket.io client singleton; authenticates on connect; joins/leaves rooms | Backend Socket.io |
| Firebase SDK | Auth sign-in/out, Storage upload/download | Firebase platform |

**Key boundary rule:** Screens never call apiService or socketService directly. They read from stores and dispatch store actions. Stores own all network calls. This prevents prop-drilling and makes navigation transitions clean.

### Backend Components

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| firebaseAuth middleware | Verify Firebase ID token, attach req.user to request | Firebase Admin SDK |
| requireVerified middleware | Block unverified users from listing/chat/community routes | — (reads req.user) |
| requireAdmin middleware | Guard admin-only routes | — (reads req.user.isAdmin) |
| Routes | URL pattern → controller binding, middleware chain | Controllers |
| Controllers | Parse request, call service, format response | Services |
| Services | Business logic, DB queries, emit socket events | Mongoose models, Socket.io instance |
| Socket handlers (src/socket/) | Handle WS events (join, send, read), broadcast to rooms | Services, Socket.io |
| Models (Mongoose) | Schema definitions, indexes, virtual fields | MongoDB Atlas |

**Key boundary rule:** Services own all MongoDB queries. Controllers must not call Mongoose directly. Socket handlers call services (not models) so business logic stays in one place. Services may emit socket events — this allows REST actions (e.g., approve verification) to push real-time updates to the affected user.

### External Services

| Service | What it provides | Who calls it |
|---------|-----------------|-------------|
| Firebase Authentication | Identity source of truth; ID tokens signed by Google | Backend (verify tokens via Admin SDK), Mobile (sign in/out) |
| Firebase Storage | File hosting for listing photos and ID documents | Mobile (listing photos — direct upload); Backend (generate signed URLs for ID docs) |
| Firebase Cloud Messaging (FCM) | Push notifications to Android/iOS | Backend (via Firebase Admin SDK when event triggers notification) |
| MongoDB Atlas | Primary database | Backend only — mobile never touches DB directly |
| Google Maps API | Map display, place autocomplete, reverse geocoding | Mobile only (via react-native-maps + Places API) |

---

## Data Flow

### Authentication Flow

```
Mobile                Firebase Auth        Backend               MongoDB
  │                       │                   │                    │
  ├─ signInWithEmail ─────►│                   │                    │
  │◄─ Firebase User + ─────┤                   │                    │
  │   ID Token             │                   │                    │
  │                        │                   │                    │
  ├─ POST /api/auth/profile ──────────────────►│                    │
  │  (Bearer: Firebase ID Token)               │                    │
  │                        │   verify token    │                    │
  │                        │◄──────────────────┤                    │
  │                        ├─ decoded UID ─────►                    │
  │                        │                   ├─ findOrCreate ─────►
  │                        │                   │                    │
  │◄─ { user, verificationStatus } ───────────┤                    │
```

**Result:** Mobile stores Firebase user in authStore. Backend trusts Firebase UID as identity — never stores passwords.

### Listing Photo Upload Flow

```
Mobile                Firebase Storage     Backend               MongoDB
  │                       │                   │                    │
  ├─ pickImage ───────────┤                   │                    │
  ├─ uploadBytesResumable ►│                   │                    │
  │◄─ downloadURL ─────────┤                   │                    │
  │                        │                   │                    │
  ├─ POST /api/listings ───────────────────────►                    │
  │  (body includes photoUrls array)           ├─── insert ────────►
  │◄─ { listing } ─────────────────────────────┤                    │
```

**Key:** Photos go Firebase Storage → URL → MongoDB. The backend stores URLs only, never binary files. This keeps backend stateless.

### ID Document Upload Flow (different — security-sensitive)

```
Mobile                Backend               Firebase Storage     MongoDB
  │                      │                       │                  │
  ├─ pickDocument ────────┤                       │                  │
  ├─ POST /api/auth/id-doc►                       │                  │
  │  (multipart, small)  │                       │                  │
  │                      ├─ upload to private ──►│                  │
  │                      │  path /id-docs/{uid}/ │                  │
  │◄─ { status: pending }┤                       │                  │
  │                      ├───────────────────────────── update ─────►
  │                      │  idDocumentUrl (private),                │
  │                      │  verificationStatus: 'pending'           │
```

**Key difference:** ID documents flow through the backend, not direct client upload. Keeps document URLs private (not accessible without signed URL). Admin accesses via signed URL generated server-side.

### 1:1 Chat Flow

```
Mobile (Sender)          Backend Socket.io         Mobile (Recipient)
  │                           │                         │
  ├─ connect (auth token) ────►                          │
  ├─ emit 'dm:send'           │                         │
  │  { to: userId,            │                         │
  │    content: '...' }       │                         │
  │                      ─────┤  persist Message doc     │
  │                      ─────┤  to: room dm:{A}:{B}    │
  │                           ├─ emit 'dm:received' ─────►
  │                           │   to room dm:{A}:{B}     │
  │                           │                         │
  │                           ├─ if recipient not in    │
  │                           │  room:                  │
  │                           ├─ emit 'notification:new' to user:{recipient}
```

### City Group Chat Flow

```
Mobile (User)            Backend Socket.io
  │                           │
  ├─ connect ─────────────────►
  │                      auto-join room city:{user.location.city}
  │                           │
  ├─ emit 'city:send'         │
  │  { city: 'berlin',        │
  │    content: '...' }       │
  │                      ─────┤ persist CityMessage (city, sender, content)
  │                      broadcast 'city:received' to room city:berlin
```

---

## Socket.io Room Strategy

### Room Naming Conventions

| Chat Type | Room Name | Example | Notes |
|-----------|-----------|---------|-------|
| Direct message | `dm:{lowerUserId}:{higherUserId}` | `dm:abc123:xyz789` | Sort IDs lexicographically so room name is deterministic regardless of who sends |
| City group chat | `city:{citySlug}` | `city:berlin`, `city:new-york` | Slugify: lowercase, hyphens, no special chars |
| User notifications | `user:{userId}` | `user:abc123` | Private channel; user joins own room on connect |

### Room Lifecycle

**DM rooms:**
- User joins `dm:…` room when they open a conversation screen
- User leaves when they navigate away (or disconnect)
- Room has no persistent socket state — history loaded via REST (`GET /api/messages/:conversationId`)
- Unread count tracked in MongoDB, not socket memory

**City rooms:**
- User auto-joins their home city room on socket connect (based on `user.location.city`)
- User can manually join other cities while browsing (`emit 'city:join' { city: 'paris' }`)
- Room history: last 50 messages loaded via REST on enter, then live via socket

**Notification room:**
- Every authenticated socket joins `user:{userId}` immediately after auth middleware
- Server emits to this room for: new DM (if not currently in that DM room), verification approved/rejected, event reminder
- Never emit sensitive data here — just `{ type, title, body, entityId }` for display

### Socket.io Authentication Middleware

```javascript
// src/socket/middleware/socketAuth.js
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('unauthorized'));
  const decoded = await admin.auth().verifyIdToken(token);
  const user = await User.findOne({ firebaseUid: decoded.uid });
  if (!user || !user.verificationStatus === 'approved') {
    return next(new Error('unauthorized'));
  }
  socket.userId = user._id.toString();
  socket.user = user;
  next();
});
```

Only verified users can open socket connections. Unverified users use REST only (to check status, update profile).

---

## MongoDB Schema Outlines

### User

```javascript
{
  _id: ObjectId,
  firebaseUid:          String,     // UNIQUE INDEX — primary lookup key
  email:                String,
  displayName:          String,
  avatar:               String,     // Firebase Storage URL
  bio:                  String,
  languages:            [String],   // e.g. ['en', 'ru']
  verificationStatus:   String,     // enum: 'pending' | 'approved' | 'rejected'
  idDocumentUrl:        String,     // private Firebase Storage URL
  idDocumentUploadedAt: Date,
  reviewedBy:           ObjectId,   // ref: User (admin)
  reviewedAt:           Date,
  rejectionReason:      String,
  location: {
    city:    String,
    country: String,
    coords:  { type: 'Point', coordinates: [lng, lat] }
  },
  pushTokens:           [String],   // FCM tokens (device may have multiple)
  isAdmin:              Boolean,    // default: false
  isBanned:             Boolean,    // default: false
  joinedAt:             Date
}
// Indexes: { firebaseUid: 1 } unique; { 'location.coords': '2dsphere' }
```

### Listing

```javascript
{
  _id: ObjectId,
  host:          ObjectId,   // ref: User
  title:         String,
  description:   String,
  listingType:   String,     // enum: 'free' | 'paid'
  pricePerNight: Number,     // null if free
  currency:      String,     // e.g. 'USD', 'EUR'
  location: {
    address: String,
    city:    String,
    country: String,
    coords:  { type: 'Point', coordinates: [lng, lat] }
  },
  photos:        [String],   // Firebase Storage URLs, first is cover
  amenities:     [String],   // e.g. ['wifi', 'kitchen', 'private room']
  houseRules:    String,
  maxGuests:     Number,
  availableFrom: Date,
  availableTo:   Date,
  isActive:      Boolean,    // host can pause listing
  avgRating:     Number,     // denormalized, updated when review added
  reviewCount:   Number,     // denormalized
  createdAt:     Date,
  updatedAt:     Date
}
// Indexes: { 'location.coords': '2dsphere' }; { host: 1 }; { listingType: 1, isActive: 1 }
```

### Conversation (1:1 DM)

```javascript
{
  _id: ObjectId,
  participants:    [ObjectId],  // ref: User, always exactly 2
  lastMessage:     ObjectId,    // ref: Message
  lastMessageAt:   Date,
  createdAt:       Date
}
// Index: { participants: 1 } — used to find existing conversation between two users
```

### Message (1:1 DM)

```javascript
{
  _id: ObjectId,
  conversation: ObjectId,   // ref: Conversation
  sender:       ObjectId,   // ref: User
  content:      String,
  mediaUrl:     String,     // optional image URL
  readBy:       [ObjectId], // userIds who have read
  createdAt:    Date
}
// Index: { conversation: 1, createdAt: -1 }  (paginate messages in a conversation)
```

### CityMessage (Group Chat)

```javascript
{
  _id: ObjectId,
  citySlug:  String,    // e.g. 'berlin', indexed
  sender:    ObjectId,  // ref: User
  content:   String,
  mediaUrl:  String,
  createdAt: Date
}
// Index: { citySlug: 1, createdAt: -1 }
// TTL Index: { createdAt: 1 } expireAfterSeconds: 7776000  (90 days auto-cleanup)
```

### Post (Community Feed)

```javascript
{
  _id: ObjectId,
  author:       ObjectId,   // ref: User
  content:      String,
  photos:       [String],   // Firebase Storage URLs
  cityTag:      String,     // optional city slug for local feed filtering
  likeCount:    Number,     // denormalized
  commentCount: Number,     // denormalized
  createdAt:    Date
}
// Index: { createdAt: -1 }; { cityTag: 1, createdAt: -1 }
```

### Comment

```javascript
{
  _id: ObjectId,
  post:      ObjectId,  // ref: Post
  author:    ObjectId,  // ref: User
  content:   String,
  createdAt: Date
}
// Index: { post: 1, createdAt: 1 }
```

### Event

```javascript
{
  _id: ObjectId,
  organizer:    ObjectId,   // ref: User
  title:        String,
  description:  String,
  location: {
    name:    String,
    address: String,
    city:    String,
    country: String,
    coords:  { type: 'Point', coordinates: [lng, lat] }
  },
  startsAt:     Date,
  endsAt:       Date,
  maxAttendees: Number,     // null = unlimited
  attendees:    [ObjectId], // ref: User, max 200 for MVP (array embed)
  coverPhoto:   String,     // Firebase Storage URL
  isActive:     Boolean,
  createdAt:    Date
}
// Index: { 'location.coords': '2dsphere' }; { startsAt: 1 }; { organizer: 1 }
```

### Review

```javascript
{
  _id: ObjectId,
  listing:    ObjectId,  // ref: Listing (optional — can review user without listing)
  reviewee:   ObjectId,  // ref: User (host or guest being reviewed)
  reviewer:   ObjectId,  // ref: User
  reviewType: String,    // enum: 'host' | 'guest'
  rating:     Number,    // 1-5
  text:       String,
  createdAt:  Date
}
// Index: { reviewee: 1 }; { listing: 1 }
// Unique constraint: { reviewer: 1, listing: 1 } — one review per stay
```

---

## API Route Structure

```
POST   /api/auth/profile          — create/update profile on first login
POST   /api/auth/id-document      — upload ID doc (multipart), set pending status
GET    /api/auth/me               — get own user + status

GET    /api/users/:id             — public profile (verified users only)

GET    /api/listings              — search (geo bbox/city, type, dates) — paginated
POST   /api/listings              — create listing (verified users only)
GET    /api/listings/:id          — single listing detail
PATCH  /api/listings/:id          — update listing (host only)
DELETE /api/listings/:id          — deactivate listing (host only)

GET    /api/messages              — list conversations for current user
GET    /api/messages/:conversationId — message history (paginated, newest-first)
POST   /api/messages/conversation — create or find conversation with another user

GET    /api/community/posts       — feed (paginated, optional cityTag filter)
POST   /api/community/posts       — create post
POST   /api/community/posts/:id/like
GET    /api/community/posts/:id/comments
POST   /api/community/posts/:id/comments

GET    /api/events                — list events (geo search, date filter)
POST   /api/events                — create event
GET    /api/events/:id
POST   /api/events/:id/rsvp      — attend event
DELETE /api/events/:id/rsvp      — cancel RSVP

GET    /api/reviews/user/:id      — reviews received by user
POST   /api/reviews               — submit review

GET    /api/admin/verifications   — queue: users with status=pending (admin only)
GET    /api/admin/verifications/:userId — detail + signed ID doc URL (admin only)
PATCH  /api/admin/verifications/:userId — approve or reject with reason (admin only)
GET    /api/admin/users           — all users (admin only)
PATCH  /api/admin/users/:id/ban   — ban/unban user (admin only)
```

---

## File Storage Recommendation: Firebase Storage

**Use Firebase Storage.** Not Cloudinary, not AWS S3.

**Rationale:**
- Already using Firebase Auth — same Firebase project, one billing account, shared security rules
- Firebase Storage security rules can enforce: `request.auth.uid == userId` (user uploads only to own path), file size limits, MIME type checks
- `expo-firebase-storage` works in Expo managed workflow — no native ejection required
- CDN included (Google CDN) — globally fast
- Free tier: 5 GB storage, 1 GB/day download — enough for MVP scale

**Storage path conventions:**
```
/listings/{listingId}/photos/{filename}    — public read, owner write
/users/{userId}/avatar/{filename}          — public read, owner write
/id-docs/{userId}/{filename}               — NO public read; admin-only signed URLs
/events/{eventId}/cover/{filename}         — public read, organizer write
/community/{postId}/{filename}             — public read, author write
```

**ID document handling (special case):**
- Client sends file to backend as multipart/form-data (max 5 MB)
- Backend uploads to Firebase Storage under `/id-docs/{userId}/` using Admin SDK
- Firebase Storage security rules deny all public reads on this path
- Admin panel fetches signed URLs (15-min expiry) to display in verification queue
- Delete document after verification decision (GDPR / data minimization)

**Image size guidance:**
- Listing photos: resize client-side before upload (max 1920x1080, quality 0.8) using `expo-image-manipulator`
- Avatar: 400x400 max
- ID documents: no client-side compression — preserve quality for verification

---

## Admin Panel Architecture

**Recommendation: Minimal Express-served web page, not a mobile screen.**

For MVP with manual verification at small scale, build the admin UI as a simple password-protected web page served by the Express backend:

```
/admin                 — login page (admin email + password, separate from Firebase)
/admin/verifications   — pending verification queue
/admin/verifications/:id — detail view with ID document + approve/reject
/admin/users           — user management
```

Implementation approach:
- Express serves static HTML/JS from `src/admin/public/` 
- Admin session via `express-session` + `bcryptjs` (separate from Firebase auth)
- Or: a 100-line React SPA built with Vite, deployed to Firebase Hosting alongside backend
- Admin credentials stored in environment variables for MVP (not in MongoDB)

**Why not a React Native admin screen:**
- Admin panel needs file-viewing on desktop (ID document review is better on large screen)
- Keeps mobile codebase focused on user-facing features
- Easier to add new admin tools without app store review

---

## Build Order and Dependencies

This is the dependency graph for implementation. Each phase depends on the previous completing.

```
Phase 1: Foundation
  MongoDB connection (config/)
  Firebase Admin SDK setup
  firebaseAuth middleware
  errorHandler middleware
  User model + findOrCreate on first login
  ↓
Phase 2: Verification Flow
  ID document upload endpoint + Firebase Storage
  Admin web panel (serve static, session auth)
  Verification queue + approve/reject
  Push notification on approval (FCM)
  ↓ (all subsequent features require verified user)
Phase 3: Listings
  Listing model with geo index
  CRUD endpoints
  Listing photos (Firebase Storage direct upload)
  Geo search (MongoDB $nearSphere or $geoWithin)
  Mobile: Listings screens + Google Maps display
  ↓
Phase 4: Messaging (depends on Listings — users DM hosts)
  Conversation + Message models
  Socket.io 1:1 DM rooms
  REST history endpoint (pagination)
  Mobile: Chat screens + socket client
  ↓
Phase 5: Community (parallel to Messaging — only needs verified user)
  Post + Comment models
  Feed endpoints (paginated)
  City group chat (Socket.io city rooms + CityMessage model)
  Mobile: Community + Chat (group) screens
  ↓
Phase 6: Events (parallel to Community)
  Event model with geo index
  CRUD + RSVP endpoints
  Mobile: Events screens
  ↓
Phase 7: Reviews
  Review model
  Submit review endpoint
  Aggregate rating update on Listing after review
  Display on listing detail + host profile
```

**Critical path:** Foundation → Verification → Listings → DM Chat. Everything else can be built in parallel pairs after Verification.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Firebase tokens in MongoDB
**What goes wrong:** Tokens expire in 1 hour; storing them creates stale data and false cache hits.
**Instead:** Always verify the token live with Firebase Admin SDK on each request. Cache the decoded user in `req.user` for the request lifetime only.

### Anti-Pattern 2: Direct MongoDB access from mobile
**What goes wrong:** Exposes schema, bypasses auth middleware, violates multi-tenancy.
**Instead:** All data access through the Express REST API. Mobile never touches MongoDB directly.

### Anti-Pattern 3: Embedding all messages in User or Conversation document
**What goes wrong:** MongoDB document size limit (16 MB) hit quickly; unbounded growth.
**Instead:** Messages as separate collection, reference Conversation by foreign key, paginate with cursor.

### Anti-Pattern 4: One Socket.io namespace for everything
**What goes wrong:** Events leak across contexts, harder to reason about, harder to add auth per namespace later.
**Instead:** Separate the concerns with room naming conventions as defined above. Add namespaces (`/dm`, `/city`, `/notify`) if you add per-namespace middleware later.

### Anti-Pattern 5: Global CORS wildcard in production
**What goes wrong:** Any origin can make authenticated requests — defeats CSRF protection on cookie-based sessions.
**Instead:** Set CORS origin to your production domain explicitly. For Socket.io, set `cors.origin` to the same list.

### Anti-Pattern 6: ID documents uploaded directly from client to Firebase Storage
**What goes wrong:** Firebase Storage download URLs are guessable if path is known; security rules can be misconfigured; direct upload bypasses server-side validation.
**Instead:** Route ID document uploads through the backend (multipart POST), validate file type/size server-side, upload with Admin SDK to a non-public path.

### Anti-Pattern 7: attendees array in Event growing unbounded
**What goes wrong:** For popular events, the array grows huge; MongoDB document becomes slow to update (each RSVP is an array push on the document).
**Instead:** For MVP with `maxAttendees` cap and small scale, embedded array is fine. Flag for refactor to separate EventAttendee collection if events exceed 500 RSVPs.

---

## Scalability Considerations

| Concern | At 1K users (MVP) | At 50K users | At 500K users |
|---------|-------------------|--------------|---------------|
| MongoDB queries | Single Atlas M0 cluster, no replica | M10 with replica set, add read preference secondary for feed queries | Sharding on userId for messages |
| Socket.io | Single Node.js process is fine | Add Socket.io Redis adapter for multi-process | Dedicated WS tier behind load balancer |
| File storage | Firebase free tier sufficient | Firebase Blaze plan, add CDN rules | Cloudflare in front of Firebase Storage |
| City group chats | In-memory, no persistence concern | Add message pagination/archival | Consider dedicated pub/sub (Redis Streams) |
| Push notifications | FCM handles scale invisibly | No change needed | No change needed |
| Verification queue | Manual admin review, async | Same — add queue tooling if >100/day | Integrate automated ID verification API |

---

## Sources

- Training knowledge of Socket.io v4 documentation (room lifecycle, auth middleware)
- Training knowledge of MongoDB geospatial indexing (2dsphere, $nearSphere)
- Training knowledge of Firebase Storage security rules and Admin SDK patterns
- Training knowledge of Expo managed workflow constraints for Firebase integration
- Standard patterns from marketplace apps (Airbnb-style listing + messaging architecture)
- Confidence: HIGH — all patterns are stable and well-documented as of August 2025 training cutoff
