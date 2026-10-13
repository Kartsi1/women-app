# Architecture Research: v1.1 Social Features and Media

**Domain:** Women-only verified social platform (Express + Mongoose + Socket.io backend, Expo 57 / RN 0.86 client)
**Milestone:** v1.1 (VK-style profile, friends/followers, wall, rich media, reposts, chat attachments, RU/EN, approximate listing area)
**Researched:** 2026-10-13
**Confidence:** MEDIUM-HIGH. Integration points are verified against the code. Three items need a spike before commitment (marked SPIKE): signed-PUT upload on the Storage emulator, `x-goog-content-length-range` enforcement from RN, and Yandex Music preview scraping.

Scope note: this covers only what is new for v1.1. Existing patterns (store-first messages, `user:<uid>` rooms, signed-URL-at-read-time, `getUserSummaries`, opaque base64 cursors, explicit response projections) are extended, not replaced.

---

## 1. Key Findings From the Existing Code (these drive the design)

| Finding | Where | Consequence |
|---------|-------|-------------|
| `Listing.location` is the **raw map-tap point**, not a computed centroid. The model comment says "centroid", but `CreateListingScreen` sends the pin the user tapped and `createListing` stores it unmodified. | `Listing.js`, `listingController.createListing`, `CreateListingScreen.tsx:90` | Today every client receives the host's exact pin (`neighbourhoodCoords`, `location.coordinates`). Approximate-area is a **privacy fix**, not only a UX feature. Fuzzing must happen server-side. |
| Post media is a single `photoUrl` string holding a Storage path, uploaded through multer `memoryStorage` (5 MB), then signed per post at read time. | `Post.js`, `postController.js`, `routes/posts.js` | Works for one photo. Video/audio/file buffered in Node memory is not viable. Chat cannot carry binary through the socket (default `maxHttpBufferSize` is 1 MB). |
| `getFeed` duplicates author enrichment (`User.find` + serial `await getSignedUrl` in a loop) instead of using `userSummaryService`. | `postController.getFeed`, `userSummaryService.js` | Wall, feed, repost and message presenters would each re-implement it. Extract one presenter and parallelise signing. |
| Chat is two scopes on one `Message` collection (`type:'dm'` with `conversationId`, `type:'group'` with `citySlug`). `content` is `required`, max 2000. `Conversation.lastMessagePreview` is a stored English-agnostic string. | `Message.js`, `chatHandler.js`, `conversationController.js` | Attachments need `content` made optional, the preview must become structured, and the history endpoints (`getMessages`, `getCityMessages`) need a projection and presenter change. |
| Server-to-client pushes already use `req.app.get('io')` plus room `user:<uid>` (`message_request:new`). | `server.js`, `chatHandler.js`, `socketService.ts` | Friend-request events follow the exact same pattern. No new transport. |
| All `{ error: '...' }` strings are English literals in controllers; socket `message:error` is the same. Push titles ("New message") are English literals in `chatHandler`. | all controllers | Server-originated text needs error codes plus a tiny server dictionary. Retrofitting all ~100 literals is not required to ship. |
| `User.photoURL` holds a Storage **path** (misnomer). Blocking is a `blockedUsers[]` array on the blocker, and only `getProfile` enforces it. The feed does not filter blocked authors. | `User.js`, `userController.js` | Wall/feed/friend flows must enforce block in both directions. Needs a reverse lookup (index on `blockedUsers`). |
| Mobile has no `expo-video`, `expo-audio`, `expo-document-picker`, `expo-localization`, i18n lib, gesture-handler or reanimated. Project uses `expo-dev-client` (prebuild flow). | `mobile/package.json` | Every new native module forces a dev-client rebuild. Install them in **one batch** early. |
| `Like` is mentioned as a model in milestone context, but no `Like.js` exists. Likes are `Post.likedBy[]` (unbounded array, pre-existing). | `Post.js` | Not in scope to change. Keep, but do not copy this pattern for follows/friends (those need their own collections). |

---

## 2. Recommended Architecture

### 2.1 System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│ MOBILE (Expo 57)                                                         │
│  screens: Profile(tabs Wall/Photos/Friends/About) · Feed · Chat · Map    │
│  ┌────────────┐ ┌────────────┐ ┌──────────────┐ ┌─────────────────────┐ │
│  │ i18n       │ │ useMedia-  │ │ MediaViewer  │ │ AttachmentView      │ │
│  │ (i18next)  │ │ Upload()   │ │ (fullscreen) │ │ image/video/audio/  │ │
│  │            │ │ hook       │ │              │ │ file/link renderer  │ │
│  └────────────┘ └─────┬──────┘ └──────────────┘ └─────────────────────┘ │
│  zustand: authStore feedStore profileStore(+relation) friendStore(new)   │
│           conversationStore socketStore                                  │
└───────────────┬───────────────────────────────┬──────────────────────────┘
                │ REST (authFetch)              │ Socket.io (token auth)
                │ + direct PUT to Storage       │ message:dm / message:city
                │   (signed URL, bytes never    │ friend_request:* push
                │    touch the socket)          │
┌───────────────▼───────────────────────────────▼──────────────────────────┐
│ BACKEND (Express + Socket.io)                                            │
│  routes → controllers (thin) → services (new logic lives here)           │
│                                                                          │
│  NEW services                                  MODIFIED services         │
│   mediaService      (init/complete/claim)       storageService (+write   │
│   attachmentService (present/attach/release)     URL, +delete, +stream)  │
│   postPresenter     (authors+reposts+attach)    userSummaryService       │
│   friendshipService (state machine)              (parallel signing)      │
│   linkPreviewService(allow-list oEmbed/OG)      notificationService      │
│   locationService   (fuzz)                       (+locale)               │
│   i18n/t()          (ru/en dictionary)                                   │
│   profileService    (public projection)                                  │
└───────┬───────────────────────────────┬───────────────────────────┬──────┘
        │ Mongoose                      │ Admin SDK                 │ outbound
┌───────▼──────────┐          ┌─────────▼──────────┐       ┌────────▼───────┐
│ MongoDB          │          │ Firebase Storage    │       │ YouTube/Spotify│
│ User Post        │          │ media/{uid}/{id}/*  │       │ oEmbed, Yandex │
│ Media(new)       │          │ profiles/ listings/ │       │ Music OG       │
│ Friendship(new)  │          │ verification/       │       └────────────────┘
│ Follow(new)      │          │ (rules: deny all    │
│ Message Listing  │          │  client access;     │
│ Conversation ... │          │  signed URLs only)  │
└──────────────────┘          └─────────────────────┘
```

### 2.2 Component Boundaries

| Component | Status | Responsibility | Talks to |
|-----------|--------|----------------|----------|
| `models/Media.js` | **NEW** | Upload lifecycle record: owner, kind, purpose, status (`pending`→`ready`→`attached`/`failed`), storage paths, metadata, `attachedTo`. Ownership and one-time-claim authority. | mediaService, attachmentService |
| `models/schemas/attachmentSchema.js` | **NEW** | Shared embedded subdocument (`_id:false`) reused in `Post.attachments` and `Message.attachments`. Immutable denormalised copy of the Media descriptor. | Post, Message |
| `models/Friendship.js` | **NEW** | One doc per unordered pair; pending/accepted; atomic state transitions. | friendshipService |
| `models/Follow.js` | **NEW** | Directed follower edge (`followerUid`→`followeeUid`). | friendshipService |
| `models/Post.js` | **MODIFIED** | Add `scope`, `wallOwnerUid`, `attachments[]`, `repostOf`, `repostCount`; keep `photoUrl` read-compat. | postController, postPresenter |
| `models/Message.js` | **MODIFIED** | Add `attachments[]`; `content` required only when no attachments. | chatHandler, conversationController |
| `models/Conversation.js` | **MODIFIED** | Add `lastMessageKind` (`text`/`image`/`video`/`audio`/`file`) so preview is localised on the client. | chatHandler, conversationController |
| `models/User.js` | **MODIFIED** | Add `coverPhoto`, `status`, extended `details`, `hiddenFields[]`, `locale`. | profileService |
| `models/Listing.js` | **MODIFIED** | Add private `exactLocation`, `locationRadiusM`; `location` becomes the public fuzzed point. | locationService, listingController |
| `controllers/mediaController.js` + `routes/media.js` | **NEW** | `uploads`, `complete`, `url`, `content` (dev proxy), `link-preview`. | mediaService |
| `controllers/friendController.js` + `routes/friends.js` | **NEW** | Request/accept/decline/cancel/unfriend, follow/unfollow, lists. | friendshipService, io |
| `controllers/postController.js` | **MODIFIED** | JSON create with `attachmentIds`; scope-aware list; repost; delete cleans up media. | postPresenter, attachmentService |
| `controllers/userController.js` | **MODIFIED** | `getProfile` becomes viewer-relative via profileService; `updateProfile` accepts extended fields; `cover-photo`; `locale`. | profileService |
| `socket/chatHandler.js` | **MODIFIED** | Attachments in `message:dm`/`message:city`; `clientId` echo; localised pushes; error `code`. | attachmentService, i18n |
| `services/postPresenter.js` | **NEW** | Single read-time enrichment path (authors, viewer-liked, reposted originals, signed attachment URLs). Used by feed, wall, post detail. | getUserSummaries, attachmentService |
| `services/attachmentService.js` | **NEW** | `claim(ids, uid, purpose, attachedTo)`, `present(attachments)`, `release`, `deleteObjects`. One place that signs and authorises media. | Media, storageService |
| `mobile/src/i18n/` | **NEW** | i18next init, `en.json`/`ru.json`, `useT`, language store sync. | all screens |
| `mobile/src/components/Media/*` | **NEW** | `AttachmentGrid`, `AttachmentPicker`, `MediaViewer`, `AudioPlayerRow`, `LinkPreviewCard`, `FileRow`. | media hooks |
| `mobile/src/store/friendStore.ts` | **NEW** | Relation state per uid, incoming-request badge count. | socketService |

### 2.3 Recommended Structure (additions only)

```
backend/src/
├── models/
│   ├── Media.js                 NEW
│   ├── Friendship.js            NEW
│   ├── Follow.js                NEW
│   └── schemas/attachmentSchema.js   NEW (shared subdoc)
├── services/
│   ├── mediaService.js          NEW  init/complete/validate/sniff/thumbnail
│   ├── attachmentService.js     NEW  claim/present/release/delete
│   ├── postPresenter.js         NEW
│   ├── profileService.js        NEW  buildPublicProfile / buildOwnProfile
│   ├── friendshipService.js     NEW
│   ├── linkPreviewService.js    NEW
│   ├── locationService.js       NEW  fuzz()
│   └── storageService.js        MOD  + getUploadUrl, deleteFile, getFileStream
├── i18n/{index.js,en.js,ru.js}  NEW  t(locale,key,params)
├── utils/{cursor.js,appError.js} NEW  shared cursor codec; sendError(res,status,code,msg)
├── jobs/mediaSweeper.js         NEW  orphan cleanup
├── scripts/migrate-v11.js       NEW  backfill scope, listing split, indexes
mobile/src/
├── i18n/{index.ts,locales/en.json,locales/ru.json}
├── components/Media/…
├── hooks/{useMediaUpload.ts,useLocale.ts}
├── store/friendStore.ts
└── screens/Friends/…  screens/Profile/(ProfileTabs, AboutTab, WallTab, PhotosTab)
```

---

## 3. Data Models

### 3.1 Post: unify with `scope`, do not split (DECISION)

**Use one `Post` collection with `scope: 'community' | 'wall'` and `wallOwnerUid`.** Rationale: wall posts need exactly what community posts already have (likes, comments keyed by `postId`, reports, delete, attachments, reposts, cursor feed). A second collection doubles every one of those code paths and the `Comment.postId` ref. The only real difference is the query predicate, which two partial indexes cover.

```js
const postSchema = new Schema({
  authorUid:    { type: String, required: true },
  scope:        { type: String, enum: ['community', 'wall'], default: 'community', required: true },
  wallOwnerUid: { type: String, default: null },        // set iff scope === 'wall'
  text:         { type: String, maxlength: 1000, default: '' },  // no longer required: attachment-only / repost allowed
  attachments:  { type: [attachmentSchema], default: [], validate: v => v.length <= 10 },
  photoUrl:     { type: String, default: null },        // LEGACY read-compat only; never written by new code
  repostOf:     { type: Schema.Types.ObjectId, ref: 'Post', default: null }, // always the ROOT original
  repostCount:  { type: Number, default: 0 },
  likedBy: [String], likeCount: Number, commentCount: Number,
}, { timestamps: true });
```

Validation (pre-validate hook, not just controller): `text` non-empty OR `attachments.length` OR `repostOf`; `scope==='wall'` requires `wallOwnerUid`; `scope==='community'` forbids it.

**Semantics (opinionated):**
- v1.1: only the wall owner posts on her own wall (`wallOwnerUid === authorUid`). The field exists so "friends may post on wall" is additive later, but do not build it now.
- Community feed contains **original** posts only. Wall contains the owner's own posts **and her reposts**. Repost target is always the reposter's wall (VK semantics). Reposting into the community feed would duplicate the same item into the same feed.
- Only `scope:'community'` posts may be reposted (matches the requirement; server rejects otherwise).
- Reposts carry **text only, no attachments of their own**. Media belongs to the original; deleting a repost never touches original media.
- `repostOf` is always flattened to the root (repost of a repost resolves to the original), so presentation never recurses.
- One repost per user per original: unique partial index `{authorUid:1, repostOf:1}` where `repostOf` exists. Undo = delete the repost post (decrement `repostCount`).
- Original deleted: reposts stay; presenter returns `repost: { unavailable: true }`. Do not cascade-delete reposts (authors own their wall).

**Indexes:**

```js
// community feed
postSchema.index({ scope: 1, createdAt: -1, _id: -1 }, { partialFilterExpression: { scope: 'community' } });
// wall (and Photos tab, filtered in query)
postSchema.index({ wallOwnerUid: 1, createdAt: -1, _id: -1 }, { partialFilterExpression: { scope: 'wall' } });
// repost uniqueness + "who reposted"
postSchema.index({ authorUid: 1, repostOf: 1 }, { unique: true, partialFilterExpression: { repostOf: { $type: 'objectId' } } });
postSchema.index({ repostOf: 1 }, { partialFilterExpression: { repostOf: { $type: 'objectId' } } });
// keep { authorUid: 1 } (admin/user deletion). Drop the redundant field-level index:true duplicate.
```

A partial-index query must include the partial predicate in its filter (`scope:'community'`), otherwise the planner will not use it. Always include `scope` in feed queries.

**Migration (required):** existing posts lack `scope`. Run `Post.updateMany({scope:{$exists:false}}, {$set:{scope:'community'}})` **before** deploying the new feed query, then build indexes, then drop the old `{createdAt:-1,_id:-1}` index. Deploy order: backfill, deploy code, drop old index. (Schema default only applies to new docs and to hydrated docs, not to `lean()` filters.)

**Photos tab** needs no new collection: `Post.find({scope:'wall', wallOwnerUid, 'attachments.kind':'image'})` on the wall index, flatten attachments in the presenter. Add a multikey index on `attachments.kind` only if this proves slow.

### 3.2 Attachment: Media collection (lifecycle) + embedded descriptor (read path) (DECISION)

Two shapes with different jobs:

1. **`Media`** (collection) owns the *upload lifecycle and authorisation*: who uploaded it, is it validated, has it been claimed, what is it attached to. It is the single-use claim token.
2. **`attachments[]`** (embedded in Post/Message) is an *immutable denormalised copy* used by all reads. No join on read; the feed stays a single `Post.find`.

Why not only embedded: a client must upload bytes **before** the post/message exists, so something has to hold ownership, size verification and orphan state. Why not only a Media collection with refs: every feed/chat read would need a second query and the descriptor is immutable after attach anyway.

```js
// models/Media.js
const mediaSchema = new Schema({
  ownerUid:  { type: String, required: true, index: true },
  kind:      { type: String, enum: ['image','video','audio','file','link'], required: true },
  purpose:   { type: String, enum: ['post','chat'], required: true },  // cover/profile keep legacy single-file routes
  status:    { type: String, enum: ['pending','ready','attached','failed'], default: 'pending' },
  mime: String, size: Number, name: String,                 // name: sanitised display name only (files)
  path: String, displayPath: String, thumbPath: String,     // Storage object paths (NEVER URLs)
  width: Number, height: Number, durationMs: Number,        // layout hints from client for video/audio, clamped
  link: { provider: String, url: String, title: String, author: String, thumbUrl: String },
  attachedTo: { type: { type: String, enum: ['post','message'] }, id: Schema.Types.ObjectId },
}, { timestamps: true });
mediaSchema.index({ status: 1, createdAt: 1 });             // sweeper
mediaSchema.index({ 'attachedTo.type': 1, 'attachedTo.id': 1 }); // authorise + cleanup by parent
```

```js
// models/schemas/attachmentSchema.js  (embedded in Post and Message)
module.exports = new Schema({
  mediaId:     { type: Schema.Types.ObjectId, required: true },
  kind:        { type: String, enum: ['image','video','audio','file','link'], required: true },
  path:        String,       // video/audio/file original; images: unused (display only, see 5.4)
  displayPath: String,       // images: re-encoded <=2048px JPEG/WebP, EXIF-stripped
  thumbPath:   String,       // images: 400px; video: poster; link: null
  mime: String, size: Number, name: String,
  width: Number, height: Number, durationMs: Number,
  link: { provider: String, url: String, title: String, author: String, thumbUrl: String },
}, { _id: false });
```

Storage paths only; URLs are produced by `attachmentService.present()` at read time (same invariant as today's `photoUrl` path).

Legacy: `normalizeAttachments(post)` synthesises `[{kind:'image', displayPath: post.photoUrl, ...}]` when `attachments` is empty and `photoUrl` exists, so old posts render without a backfill. New posts also get `photoUrl` mirrored in the response payload (not the DB) for one release so already-installed app builds keep working.

### 3.3 Friends and followers (DECISION: pair doc + directed follow edge)

VK semantics from the project decision: mutual friendship via request/accept; a pending request makes the sender a follower; unfriend leaves the removed person as a follower of the remover.

```js
// models/Friendship.js — ONE doc per unordered pair => state change is a single atomic write
const friendshipSchema = new Schema({
  pairKey:      { type: String, required: true, unique: true },   // [a,b].sort().join('_')
  members:      { type: [String], required: true },               // sorted [a,b]
  requesterUid: { type: String, required: true },
  recipientUid: { type: String, required: true },
  status:       { type: String, enum: ['pending','accepted'], default: 'pending' },
  respondedAt:  Date,
}, { timestamps: true });
friendshipSchema.index({ members: 1, status: 1 });                  // friends list / count / relation lookup
friendshipSchema.index({ recipientUid: 1, status: 1, createdAt: -1 }); // incoming requests + badge
friendshipSchema.index({ requesterUid: 1, status: 1, createdAt: -1 }); // outgoing

// models/Follow.js
const followSchema = new Schema({ followerUid: String, followeeUid: String }, { timestamps: true });
followSchema.index({ followerUid: 1, followeeUid: 1 }, { unique: true });
followSchema.index({ followeeUid: 1, createdAt: -1 });              // followers list/count
followSchema.index({ followerUid: 1, createdAt: -1 });              // following list
```

Declined requests are **deleted** (no `declined` status; the Follow edge remains so she stays a follower, per VK). This keeps the pair doc a clean two-state machine and lets a user re-request later without a stale-row special case.

**State machine (all transitions server-validated; `req.user.uid` is always the actor):**

| Action | Precondition | Writes | Event |
|--------|--------------|--------|-------|
| Send request A→B | not blocked either way; no existing pair doc; A≠B | insert Friendship(pending, requester A); upsert Follow(A→B) | `friend_request:new` to `user:B` + push |
| B accepts | pair pending and `recipientUid===B` (atomic `findOneAndUpdate({pairKey,status:'pending',recipientUid:B},{status:'accepted'})`) | Friendship→accepted; delete Follow(A→B) (friends are not counted as followers) | `friend_request:accepted` to `user:A` + push |
| B declines | same precondition | delete Friendship; Follow(A→B) stays | none |
| A cancels | pending and `requesterUid===A` | delete Friendship; delete Follow(A→B) | none |
| Either unfriends | accepted | delete Friendship; insert Follow(former friend → remover) | none |
| Follow / unfollow (no request) | not friends | upsert/delete Follow | optional `follow:new` badge only |
| Block (existing `blockUser`) | any | delete Friendship + both Follow edges | none |

**Counts: compute, do not denormalise (DECISION for v1.1).** `friendsCount = countDocuments({members:uid,status:'accepted'})`, `followersCount = countDocuments({followeeUid:uid})`, both index-covered. Counter fields on `User` drift without multi-doc transactions (local Mongo is typically a standalone instance with no transaction support; do not depend on them). Denormalise only if profile reads become hot.

**Relation field on profile reads:** `GET /api/users/:uid` returns `relation: 'self'|'friends'|'request_sent'|'request_received'|'following'|'none'` computed from two indexed lookups (`Friendship.findOne({pairKey})`, `Follow.exists(...)`). The mobile Profile screen renders its primary button from this single field.

Optional integration (product decision, flag for roadmap): on accept, create the `Conversation` for the sorted pair so friends skip the MessageRequest gate. The gate in `chatHandler` is purely "Conversation exists for the sorted pair", so this is a ~5-line change in `friendshipService.accept`. "Request to chat from profile" already works through the existing `MessageRequest` endpoints.

### 3.4 User profile extension

```js
// additions to userSchema
coverPhoto:   String,                              // Storage path 'profiles/<uid>/cover'
status:       { type: String, maxlength: 140, trim: true },
details: {
  birthDate:   Date,                               // private; only derived `age` is exposed
  education:   { type: String, maxlength: 200 },
  work:        { type: String, maxlength: 200 },
  hobbies:     { type: String, maxlength: 300 },
  hometown:    { type: String, maxlength: 100 },
  lookingFor:  { type: String, maxlength: 300 },
},
hiddenFields: [{ type: String, enum: ['age','education','work','hobbies','hometown','lookingFor'] }],
locale:       { type: String, enum: ['en','ru'], default: 'en' },
```

**Per-field visibility: `hiddenFields[]` (default = visible), not a per-field object.** Matches the recorded decision ("visible to all verified members by default; hide flag in data model, no settings UI yet"): only exceptions are stored, the array is empty for almost everyone, and a future settings UI just toggles membership. All visibility enforcement lives in **one** function, `profileService.buildPublicProfile(user, viewerUid)`, built on a whitelist (same discipline as the existing explicit projections). `getProfile`, search results and any future "people" endpoint must call it. The owner (`getOwnProfile`/`updateProfile`) receives all fields plus `hiddenFields`.

`birthDate` is never serialised. Expose `age` (computed) only when `'age'` is not hidden; this avoids exposing exact birth date to every member.

Cover photo: reuse the existing single-file multer route pattern (`POST /api/users/cover-photo`, 5 MB, image only), mirroring `uploadProfilePhoto`. It does not need the media pipeline.

### 3.5 Message and Conversation

```js
// Message additions
attachments: { type: [attachmentSchema], default: [], validate: v => v.length <= 10 },
content:     { type: String, maxlength: 2000, default: '',
               required: function () { return !this.attachments || this.attachments.length === 0; } },
// Conversation additions
lastMessageKind: { type: String, enum: ['text','image','video','audio','file'], default: 'text' },
```

`lastMessagePreview` stays the text (empty for attachment-only); the client renders `t('chat.preview.image')` etc. from `lastMessageKind`. Do not store a localised string in the DB. Existing indexes are unchanged.

### 3.6 Listing: approximate area (DECISION: keep `location` public, add private `exactLocation`)

```js
exactLocation:   { type: pointSchema, select: false },   // host's real pin; never selected by default
location:        { type: pointSchema, required: true },  // PUBLIC fuzzed point (2dsphere index kept)
locationRadiusM: { type: Number, default: 500 },         // radius of the public circle the client draws
areaName:        { type: String, maxlength: 100 },       // optional district label, client-supplied
exactAddress:    { type: String, required: true, select: false },  // add select:false too
```

Why keep the name `location` as the *public* field: every existing public code path (`$geoNear` on the 2dsphere index, `neighbourhoodCoords`, `location.coordinates` projection, mobile map) already treats it as safe-to-send. Repurposing it means existing read paths become correct with **zero changes**, and a future dev who spreads a listing cannot leak the exact point. `select:false` on `exactLocation` and `exactAddress` turns "remember to omit it" into "must opt in to read it"; only the accepted-StayRequest reveal branch in `getListingDetail` uses `.select('+exactAddress +exactLocation')`.

**Fuzz algorithm (`locationService.fuzz(listingId, [lng,lat])`): stable keyed offset, computed once at write time.**

```js
const crypto = require('crypto');
function fuzz(listingId, [lng, lat], { minM = 150, maxM = 400 } = {}) {
  const h = crypto.createHmac('sha256', process.env.LOCATION_FUZZ_SECRET).update(String(listingId)).digest();
  const bearing = (h.readUInt32BE(0) / 0xffffffff) * 2 * Math.PI;
  const dist = minM + (h.readUInt32BE(4) / 0xffffffff) * (maxM - minM);
  const dLat = (dist * Math.cos(bearing)) / 111320;
  const dLng = (dist * Math.sin(bearing)) / (111320 * Math.cos(lat * Math.PI / 180));
  return [lng + dLng, lat + dLat];
}
// client draws a Circle of locationRadiusM (500) around the public point; true point is always within 400 m of its centre.
```

- **Stable, not per-request random.** Random jitter per query can be averaged out by repeated searches. A deterministic per-listing offset gives the attacker nothing to average.
- **Stored, not recomputed.** The public point is persisted at create/update; rotating the secret later does not move existing listings.
- Why not grid snapping: a pin that lands near a cell centre is published almost exactly, and cell boundaries are public knowledge. HMAC offset has no such weak spots.
- `$geoNear` stays on `location` (public). Because the `distance` it returns is to the fuzzed point, it cannot be used to triangulate the real one.
- Accepted guests get `exactCoords` (from `exactLocation`) together with `exactAddress`, gated by the same `addressRevealed` check.
- **Migration:** for each existing listing: `exactLocation = old location; location = fuzz(...)`. Run once; idempotent guard `exactLocation: {$exists:false}`.
- Client: replace `NeighbourhoodPin` marker with a react-native-maps `Circle`; host still taps an exact pin in `CreateListingScreen` (UI copy: "Visible to others as an approximate area"). Optional `areaName` from client-side reverse geocode of the public point only.
- Threat to document, not solve: if the description or photos name the street, fuzzing is moot. Consider a creation-time hint, not enforcement.

---

## 4. API Design

All routes keep the existing guard pair `verifyFirebaseToken, requireVerified`. Static routes before `/:id` (existing rule). All errors return `{ error, code, params? }` (section 8).

### 4.1 Media

| Method / Path | Purpose |
|---------------|---------|
| `POST /api/media/uploads` body `{kind, mime, size, name?, purpose, width?, height?, durationMs?, withPoster?}` | Validate against per-kind allow-list and size cap; create `Media(pending)`; return `{ mediaId, targets: [{role:'original'\|'poster', method:'PUT', url, headers}] }`. `targets[].url` is a signed GCS write URL in production or `PUT /api/media/:id/content?role=` (streaming proxy) when `MEDIA_UPLOAD_MODE=proxy` (emulator/dev). Client code is identical for both. |
| `PUT /api/media/:id/content?role=original\|poster` | Dev/emulator fallback: stream request body to Storage (busboy-free raw stream, hard byte cap). Not used in prod. |
| `POST /api/media/:id/complete` | Verify object exists, `size` and `contentType` via `getMetadata()`, sniff magic bytes (first 4 KB) against declared kind, run image pipeline (5.4), set `ready`. Returns the attachment descriptor + signed thumb URL for composer preview. Idempotent. |
| `POST /api/media/link-preview` body `{url}` | Server-side fetch via allow-list (5.6). Creates `Media(kind:'link', status:'ready')`; returns descriptor. Attached by id like any other attachment. |
| `GET /api/media/:id/url` | Lazy full-resolution URL for video/audio/file/image-display. Authorises through `attachedTo` (5.5). |
| `GET /api/media/config` (optional) | Limits and allow-lists so the client does not hard-code them. |

Rate-limit `uploads` and `link-preview` per uid (add `express-rate-limit`; CONCERNS.md already flags its absence). Per-user pending cap (e.g. 20 `pending` Media) to bound abuse.

### 4.2 Posts and wall

| Method / Path | Change |
|---------------|--------|
| `GET /api/posts?before=` | **MOD.** Forces `scope:'community'`; excludes authors in either direction of block; returns presenter shape. |
| `POST /api/posts` | **MOD.** Accepts JSON `{ scope:'community'\|'wall', text?, attachmentIds?[] }`. `wallOwnerUid` is derived (= caller) server-side, never read from body. Legacy multipart `photo` still accepted for one release and converted to an image attachment. |
| `GET /api/users/:uid/wall?before=&only=photos` | **NEW.** Block check as in `getProfile` (403), then same list function with `scope:'wall'`. |
| `POST /api/posts/:id/repost` body `{text?}` | **NEW.** Resolve root original; require `scope:'community'`; create wall post with `repostOf`; `$inc repostCount`; push to original author. 409 if already reposted. |
| `DELETE /api/posts/:id` | **MOD.** Author only (unchanged). Deletes comments, then releases/deletes Media + Storage objects (not for reposts); if it is a repost, `$inc repostCount:-1` on the root. |

Response item (single shape for feed, wall, detail):

```jsonc
{ "id", "scope", "authorUid", "authorName", "authorPhotoUrl", "text", "createdAt",
  "likeCount", "liked", "commentCount", "repostCount",
  "attachments": [ { "mediaId", "kind", "thumbUrl", "displayUrl"?, "mime", "size", "name"?,
                     "width", "height", "durationMs", "link"? } ],
  "repost": null | { "unavailable": true } | { "id","authorUid","authorName","authorPhotoUrl","text","createdAt","attachments":[…] } }
```

`liked` is computed per viewer (today the client receives the whole `likedBy` array; stop sending it, it also leaks all likers' uids and grows unbounded).

### 4.3 Friends

| Method / Path | Purpose |
|---------------|---------|
| `POST /api/friends/requests` `{toUid}` | Send request (also creates follow). Idempotent. |
| `GET /api/friends/requests?dir=in\|out` | Pending lists with `getUserSummaries` enrichment. |
| `POST /api/friends/requests/:uid/accept` · `/decline` · `DELETE /api/friends/requests/:uid` (cancel) | Transitions from 3.3. `:uid` is the other party (stable, no id lookup). |
| `DELETE /api/friends/:uid` | Unfriend. |
| `PUT /api/follows/:uid` · `DELETE /api/follows/:uid` | Follow / unfollow without a request. |
| `GET /api/users/:uid/friends?before=` · `/followers` · `/following` | Paginated lists (cursor on `_id`), block-filtered. |
| `GET /api/users/:uid` | **MOD.** Adds `relation`, `friendsCount`, `followersCount`, `status`, `coverPhoto` (signed), filtered `details`. |

### 4.4 Profile and locale

`PUT /api/users/profile` **MOD**: accepts `status`, `details.*`, `hiddenFields`, `locale`; validates lengths/enums; returns `buildOwnProfile`. `POST /api/users/cover-photo` **NEW** (multer single). `PUT /api/users/locale {locale}` is a thin convenience for the language switcher (also updates `socket.data.locale` through the next reconnect or the `locale:set` event).

### 4.5 Listings

`createListing`: still accepts exact `coordinates` + `exactAddress`; server writes `exactLocation`, computes `location` with `fuzz()`. `updateListing` (if/when added) must recompute only when `exactLocation` changes. `searchListings` and `getListingDetail`: no query change; add `locationRadiusM` to projections; detail adds `exactCoords` only in the reveal branch.

---

## 5. Media Pipeline

### 5.1 Decision: two-phase, direct-to-Storage with server-issued paths (DECISION)

Do **not** extend the multer/memoryStorage path to video/audio/files. Reasons: a 50 MB video buffered per request multiplies memory by concurrent uploads and pins request timeouts on the Node host; sockets cannot carry binary at default limits; and the current handler uploads inside the request before returning (a failed second photo leaves a half-built listing/post).

```
1 POST /api/media/uploads  ──► validate kind/mime/size, create Media(pending),
                                issue {path chosen by SERVER, signed PUT, content-length cap}
2 PUT bytes  ──────────────────► Firebase Storage (client → bucket, bypasses Node)
3 POST /api/media/:id/complete ► getMetadata (size/contentType match), sniff, process, Media→ready
4 POST /api/posts | socket message:* with attachmentIds ► attachmentService.claim()
                                (ownerUid match, status ready, purpose match, one-time) → embed descriptors
```

- **Server-issued path:** `media/{ownerUid}/{mediaId}/original.{ext}` where `ext` comes from the server allow-list mapped from the validated MIME, never from the client filename. The client chooses nothing about the path. The user-supplied filename is stored only as sanitised display text (`name`).
- **Storage rules stay deny-all for clients** (today's invariant). Signed URLs bypass rules, so no rules change, and the client still never uses the Firebase Storage SDK.
- **Upload from RN:** in the installed `expo-file-system` (~57) use the modern `File.upload(url, { uploadType: UploadType.BINARY_CONTENT, httpMethod: 'PUT', headers })`. `expo/fetch` with a `File` body is the alternative. The legacy `uploadAsync` is only under `expo-file-system/legacy`. (Expo v57 docs, HIGH.) The existing `appendFileToFormData` Blob workaround is for multipart only and is not needed for a binary PUT.
- **Size enforcement.** A signed PUT URL ignores a plain `Content-Length`; the supported mechanism is signing the `x-goog-content-length-range: 0,<max>` extension header, which the client must then send (MEDIUM, per GCS docs/community; SPIKE to confirm from RN). Because it is not guaranteed, `complete` is the authoritative check: read `getMetadata().size` and `contentType`, and on mismatch delete the object and mark `failed`. Declared size in step 1 is only a pre-filter.
- **SPIKE (blocking for choice of default mode):** whether the Firebase Storage **emulator** honours `getSignedUrl({action:'write'})`. Existing read URLs work against the emulator (hence `mediaUri()` host rewrite), but write support is not documented (LOW). The `MEDIA_UPLOAD_MODE=proxy` fallback in 4.1 makes this non-blocking: dev runs through the streaming proxy, prod uses signed PUT, and the client sees the same `targets[]` contract either way.
- **Orphans:** `jobs/mediaSweeper.js` (hourly `setInterval`; single-instance assumption today, move to a scheduler if the backend scales out) deletes objects and docs for `pending`/`failed` older than 24 h and for `ready` (unattached) older than 24 h. Alternative: a bucket lifecycle rule on a `tmp/` prefix, at the cost of a move-on-attach step.

### 5.2 Allow-lists and limits (defaults; product may tune)

Define once in `backend/src/config/mediaLimits.js`, expose via `GET /api/media/config`, mirror in `mobile/src/constants/media.ts`.

| Kind | MIME allow-list | Max size | Other |
|------|-----------------|----------|-------|
| image | jpeg, png, webp (HEIC rejected; ImagePicker on Android re-encodes) | 10 MB in, re-encoded out | longest edge capped 2048 px |
| video | mp4, quicktime (mov), webm | 50 MB | client trims to ~60 s via picker `videoMaxDuration`; poster required |
| audio | mpeg (mp3), mp4/aac (m4a), ogg, wav | 20 MB | |
| file | pdf, docx/xlsx/pptx, txt, zip | 20 MB | executables/scripts/APK never allowed |
| per post / per message | | 10 attachments | at most 1 `link` per post |

MIME is validated twice: declared at step 1, and by magic-byte sniff at `complete`. `file-type` v17+ is ESM-only; the backend is CommonJS, so load it with `await import('file-type')` or pin the last CJS release.

### 5.3 Signed URLs at read time

- All persisted values are paths. `attachmentService.present(attachments, {mode})` is the only code that signs.
- **List responses** (feed, wall, chat history): sign **`thumbUrl` and, for images, `displayUrl`** eagerly. For video/audio/file return metadata and no URL; the client calls `GET /api/media/:id/url` on tap/play. This bounds signing work (a 20-post page with 10 attachments would otherwise be hundreds of signatures) and shortens the window in which a leaked URL is usable.
- Video/audio URL expiry: 60 min (playback can outlive 15 min and a paused player re-requesting an expired URL fails). Images/thumbs: keep 15 min but see the cache note. On player error the viewer re-fetches the URL once.
- Generate with `Promise.all` and a small in-process cache (path to `{url, expiresAt}`, reuse while at least 5 min remain). This also makes the URL string stable across refreshes, which matters for RN image caching (a new signature each request defeats the cache). The existing serial `await` in `getUserSummaries`/`getFeed` should become parallel at the same time.
- **Signing version:** `@google-cloud/storage` `getSignedUrl` defaults to V2 unless `version: 'v4'` is passed (verify in the installed version, MEDIUM). With V2 the URL depends only on path+expiry, so rounding expiry to a fixed window yields a byte-identical URL and strong client caching. V4 includes a signing timestamp and always differs. Choose per cache need; write URLs may use either.
- Files: pass `responseDisposition: 'attachment; filename="<sanitised>"'` so downloads keep their name.

### 5.4 Thumbnails and image safety

- **Images: process server-side with `sharp`** at `complete`: `.rotate()` (apply EXIF orientation), resize to 2048 (`displayPath`) and 400 (`thumbPath`), re-encode (sharp drops metadata by default), then **delete the raw original**. This is a safety requirement, not an optimisation: raw phone JPEGs carry GPS EXIF, and this platform's users are women sharing photos from where they live or travel. Serving only re-encoded derivatives guarantees no GPS leaks through images. (`sharp` ships prebuilt binaries; confirm the host's libc/arch, SPIKE-lite.)
- **Video:** client generates the poster with `expo-video`'s `generateThumbnailsAsync` (Android+iOS, `maxWidth/maxHeight` options; Expo v57 docs, HIGH) and uploads it as the `poster` target; `complete` re-encodes it through `sharp` to 640 px. Video files themselves are served as uploaded. **Known gap:** MP4 container metadata can contain GPS and cannot be stripped without ffmpeg. Accept for v1.1, document in PITFALLS, revisit with a transcode worker later. Do not attempt server-side ffmpeg in this milestone.
- **Audio:** no thumbnail. **Files:** no thumbnail, client renders an icon by MIME. **Link:** provider thumbnail URL as returned (hot-linked, see 5.6).
- Width/height/duration for video/audio come from the client and are used only as layout hints; clamp them to sane ranges server-side.

### 5.5 Authorisation of media reads

`GET /api/media/:id/url` and socket/REST presenters never authorise by "who owns the file"; they authorise by **the parent the media is attached to** (`Media.attachedTo`):

| Parent | Allowed viewer |
|--------|----------------|
| `post` (community) | any verified, non-banned member not blocked either way with the author |
| `post` (wall) | same (profile visibility is open to verified members by decision) |
| `message` (dm) | participants of that Conversation |
| `message` (group) | users whose `citySlug` equals the message's `citySlug` |
| unattached `ready`/`pending` | owner only |

This is the one place where chat attachment privacy is enforced; a signed URL is a bearer credential, so keep full-resolution URLs lazy and short-lived for chat.

### 5.6 Music links and link previews

- Providers: YouTube and Spotify both publish keyless oEmbed endpoints; **Yandex Music has no documented oEmbed** (only generic Open Graph markup is documented for Yandex properties, and I could not confirm music.yandex.* serves usable OG to a bare server request). Treat Yandex Music as: parse the URL (track/album/playlist id) → try OG fetch → **fall back to a link-only card** (provider icon, title from URL slug if any, tap opens externally). Do not make post creation depend on preview success. (MEDIUM for YouTube/Spotify, LOW for Yandex; SPIKE during the media phase.)
- **SSRF controls are mandatory** because this is a server-side fetch of a user-supplied URL: https only; exact host allow-list (`youtube.com`, `youtu.be`, `music.youtube.com`, `open.spotify.com`, `music.yandex.ru|com|kz|by`); resolve DNS and reject private/loopback/link-local ranges; no redirects to a different host; 3 s timeout; 256 KB response cap; no cookies/auth headers forwarded.
- Preview is resolved **server-side** and stored in `Media.link` then copied to the attachment. Never trust a client-provided title/thumbnail.
- Thumbnail: store the provider's image URL as-is and hot-link in v1.1 (simplest; allow-list those CDNs on the client). Copying into own Storage is the privacy-preferable follow-up if needed.
- Playback: v1.1 opens the provider app/web via `Linking`. Embedded players are out of scope.
- "Uploaded audio file" playback uses `expo-audio` (`useAudioPlayer` with a remote URL, `useAudioPlayerStatus`; Expo v57 docs, HIGH). Background playback requires the optional config-plugin flag; leave it off in v1.1.

### 5.7 Client side

- `useMediaUpload()` hook: pick (ImagePicker with `allowsMultipleSelection` / DocumentPicker `multiple`) → `uploads` → `File.upload` per target → `complete` → returns descriptors; exposes per-item `status/progress` for the composer. The same hook serves post composer and chat composer (that is the reuse requirement).
- `AttachmentGrid` (read-only renderer for any `attachments[]`) is shared by `PostCard`, wall, repost embed and `MessageBubble`.
- `MediaViewer`: fullscreen modal with horizontal paging across the item's images/videos, pinch-zoom on images, `expo-video` `VideoView` for video, close/swipe-down. Android pinch-zoom needs `react-native-gesture-handler` + `react-native-reanimated` (+ `react-native-worklets` as required by the installed Reanimated version) — all native, all in the single rebuild batch (section 10). `ScrollView` zoom is iOS-only and is not an option for Android-first.

---

## 6. Feed Queries and Read-Time Enrichment

Single code path in `postPresenter.present(rawPosts, viewerUid)`:

1. Collect `authorUid`s + reposted-original authors; **one** `getUserSummaries` call (parallelised signing).
2. Collect `repostOf` ids; **one** `Post.find({_id:{$in}})` (select needed fields, `scope:'community'`).
3. For each post and each embedded original: `attachmentService.present(attachments)` (eager thumb/display URLs).
4. Compute `liked = likedBy.includes(viewerUid)`; strip `likedBy` from output.
5. Missing original → `repost: {unavailable:true}`.

Query helper `listPosts({scope, wallOwnerUid, before, viewerUid, only})` in a service so feed and wall share cursor logic. Move the cursor codec into `utils/cursor.js`: validate the `_id` with `mongoose.isValidObjectId`, and cast to `ObjectId` explicitly (the current code relies on Mongoose casting inside `find`; that stops working the moment a query becomes an aggregation).

Block filtering (new): `const blockedMe = await User.find({blockedUsers: uid}).select('firebaseUid')` + my own `blockedUsers` → `authorUid: {$nin}`. Add `userSchema.index({ blockedUsers: 1 })` (multikey) so the reverse lookup is not a collection scan.

Page size stays 20 (+1 lookahead). Latency budget: at most 4 DB round trips per page (posts, authors, originals, optional viewer relation) regardless of page size.

---

## 7. Socket Events

No new transport, no new auth. Binary never goes over the socket; only ids do.

| Direction | Event | Payload | Status |
|-----------|-------|---------|--------|
| C→S | `message:dm` | `{ otherUid, content?, attachmentIds?[], clientId? }` | **MOD** (`content` optional if attachments) |
| C→S | `message:city` | `{ content?, attachmentIds?[], clientId? }` | **MOD** |
| S→room | `message:new` | existing fields + `attachments:[{mediaId,kind,thumbUrl,displayUrl?,name,size,mime,durationMs,width,height}]`, `clientId` echoed to dedupe optimistic send | **MOD** |
| S→C | `message:error` | `{ error, code, clientId? }` | **MOD** (adds `code`, `clientId`) |
| S→`user:<uid>` | `friend_request:new` | `{ fromUid, fromName, fromPhotoUrl }` | **NEW** |
| S→`user:<uid>` | `friend_request:accepted` | `{ byUid, byName }` | **NEW** |
| S→`user:<uid>` | `follow:new` (optional) | `{ fromUid }` | **NEW, low priority** |
| C→S | `locale:set` | `{ locale }` | **NEW** (updates `socket.data.locale`) |

Friend events are emitted from the REST controllers via `req.app.get('io')`, identical to `message_request:new`. Client registers them at the single global registration point already in `socketService.ts` (bump `friendStore.incomingCount`, local notification, same as message requests).

**Store-first with attachments (extends the locked pattern):**

```js
const messageId = new mongoose.Types.ObjectId();
const claimed = await attachmentService.claim(attachmentIds, {
  ownerUid: uid, purpose: 'chat', attachedTo: { type: 'message', id: messageId },
}); // updateMany({_id:{$in}, ownerUid, purpose:'chat', status:'ready'}, {status:'attached', attachedTo}); count must equal ids.length
if (!claimed) return socket.emit('message:error', { code: 'ATTACHMENT_INVALID', clientId });
try { saved = await Message.create({ _id: messageId, ..., attachments: claimed.descriptors }); }
catch { await attachmentService.release(attachmentIds); return socket.emit('message:error', ...); }
// then emit message:new (store-first preserved: nothing is emitted before the write succeeds)
```

Claim-before-create makes a double-send of the same `mediaId` impossible (second claim finds status `attached`). Validate `attachmentIds.length <= 10` and `content.length <= 2000` in the handler as today; allow empty `content` only when attachments are present. Also set `Conversation.lastMessageKind` and `lastMessagePreview`.

**Push (offline recipient):** body for attachment-only messages is localised from the recipient's `locale` ("Photo" / "Фото"). City fan-out already runs `User.find(... ).limit(200)`; add `locale` to its projection and build one title/body per locale. `onlineUids` skip-if-online logic is unchanged.

History endpoints (`getMessages`, `getCityMessages`) must project `attachments` and run them through `attachmentService.present` with the same authorisation as live emits (participant / same `citySlug`, which they already enforce).

---

## 8. Internationalisation (RU/EN)

### 8.1 Client

- **Libraries:** `i18next` + `react-i18next` + `expo-localization` (Expo's docs recommend pairing expo-localization with an established i18n library; `react-i18next` is on their list; v57 docs, HIGH). One install, widely used, supports Russian plural categories (`_one/_few/_many/_other`) via `Intl.PluralRules` (available in Hermes on Android; MEDIUM, verify on a device build).
- Layout: `mobile/src/i18n/index.ts` initialises i18next with `en.json`/`ru.json` bundled (no network fetch), namespaces by feature (`common`, `auth`, `profile`, `feed`, `chat`, `housing`, `errors`, `push`). `useTranslation()` in components; **typed keys** via i18next resource typing so a missing key fails `tsc` (project is TS strict).
- **Language resolution order:** persisted user choice (AsyncStorage, already a dependency) → `getLocales()[0].languageCode` if `ru`/`en` → `en`. The switcher (Profile > Language) writes AsyncStorage, calls `i18n.changeLanguage`, and `PUT /api/users/locale`. Use `useLocales()` only for the default. Do not use the config-plugin per-app-language path: it needs a native rebuild per change and does not give the in-app switcher the milestone asks for.
- Dates/numbers: `toLocaleDateString(i18n.language)` / `Intl`; no date library needed.
- **Do not translate user-generated content or city names.**
- **Cost reality:** existing screens (~30 files) contain hard-coded English. Sequence: (1) scaffold, (2) all **new** v1.1 UI written with `t()` from day one, (3) a dedicated sweep plan for legacy screens. Do (1) before any new UI; otherwise every new screen is written twice.

### 8.2 Server

- `backend/src/i18n/{en,ru}.js` plain objects + `t(locale, key, params)` with `{{param}}` interpolation and a simple `plural(locale, n, forms)` helper. A full i18next server is not justified for ~40 push/error strings.
- **Error contract:** keep `error` (English, log-friendly) and add a stable `code` + optional `params`. `utils/appError.js` exposes `sendError(res, status, code, message, params)`. The client maps `errors.<code>` through i18n and falls back to `error` when the code is unknown. **Convert incrementally**: all *new* endpoints and the user-visible existing ones (auth, post create, listing create, message send) first; the long tail keeps working untranslated rather than blocking the milestone.
- **Push and socket text** use the recipient's `User.locale` (`expoPushToken` lookup already loads the user, so no extra query). Socket handlers cache `socket.data.locale` at `connection` (extend the `io.use` auth step to load it with the user) and refresh on `locale:set`.
- Push titles/bodies move into the dictionary (`push.dm.title`, `push.cityMessage.title` with `{{city}}`, `push.friendRequest`, `push.repost`, `push.attachment.image`…). Remove the English literals in `chatHandler`.
- Defaulting: `User.locale` default `'en'`; set from the client's resolved language at first login after upgrade.

---

## 9. Data Flow Summary

**Create a wall post with a video and a Spotify link**
`MediaPicker → useMediaUpload: POST /media/uploads (video+poster) → File.upload PUT ×2 → POST /media/:id/complete` and `POST /media/link-preview → POST /api/posts {scope:'wall', text, attachmentIds}` → `attachmentService.claim` → `Post.create` with embedded descriptors → `201 {id}` → client prepends to wall store.

**Open the wall**
`GET /users/:uid/wall` → block check → `Post.find` (wall index) → `postPresenter` (authors, originals, thumb URLs) → render; tap video → `GET /media/:id/url` → `expo-video`.

**Friend request**
`POST /friends/requests` → `friendshipService.send` (block check, insert pair doc, upsert Follow) → `io.to('user:B').emit('friend_request:new')` + localised push → B's `friendStore` badge → `accept` → atomic status update, delete Follow, emit `friend_request:accepted` to A.

**Chat photo**
`useMediaUpload (purpose:'chat') → socket message:dm {otherUid, attachmentIds, clientId}` → gate (accepted Conversation) → `claim` → `Message.create` → `io.to(room).emit('message:new', {attachments with thumbUrl})` → recipient's bubble renders `AttachmentGrid`; tap → viewer → `GET /media/:id/url` (participant check).

---

## 10. Suggested Build Order (dependency-driven)

```
        ┌── L: Approximate area (independent, safety fix) ─────────────────────┐
A: Foundation ──► B: Media pipeline ──► C: Post scope + attachments ──► E: Reposts
 (i18n, native    (Media, upload,        (migration, presenter,          (needs C+D wall)
  batch, errors)   viewer, link prev)     community media)  ──► D: Profile + Wall ─┘
                         │                                          ▲
                         └──► F: Chat attachments                   │
G: Friends/followers (independent of media; needs A, UI lands in D's profile tabs) ┘
```

| # | Unit | Depends on | Why this position |
|---|------|------------|-------------------|
| 0 | **Approximate area (Listing split + migration + Circle)** | none | Privacy defect in shipped v1.0; self-contained (one model, two controllers, one map component). Do first or alongside A. |
| 1 | **Foundation:** native dependency batch (expo-video, expo-audio, expo-document-picker, expo-localization, gesture-handler, reanimated, worklets) + **single dev-client rebuild**; i18n scaffold + `User.locale` + `sendError` codes + server `t()`; `utils/cursor.js`; presenter refactor of `getFeed` using `getUserSummaries` (no behaviour change) | none | Every later unit needs strings, a rebuild-free native surface, and the shared enrichment path. Batching native modules avoids repeated rebuilds mid-milestone. |
| 2 | **Media pipeline:** `Media`, `attachmentSchema`, `storageService` additions, `/api/media/*`, sweeper, mobile `useMediaUpload` + `AttachmentGrid` + `MediaViewer` + audio/video/file renderers; link previews | 1 | Gate for community media, wall media and chat attachments. SPIKES (emulator signed-PUT, range header, Yandex preview) land here, early. |
| 3 | **Post unification:** backfill `scope`, new indexes, `attachments` on Post, presenter, composer with attachments, legacy `photoUrl` read-compat | 2 | Delivers rich media in community posts (a stated v1.1 feature) and the model the wall reuses. Migration runs here. |
| 4 | **Profile + wall:** `User` extension, `profileService`, cover upload, status, About tab with visibility filtering, wall tab (`GET /users/:uid/wall`), Photos tab | 3 (wall), 1 (i18n) | Extended fields/cover/status have no media dependency and can start in parallel with 2–3; the wall tab needs 3. |
| 5 | **Friends/followers:** models, `friendshipService`, routes, socket events, `friendStore`, Friends tab, relation button, block cleanup | 1 (strings, socket pattern); UI needs 4's profile screen | Independent data-wise, so it can run in parallel with 2–3 on a second track. |
| 6 | **Reposts** | 3 and 4 (wall as destination) | Needs the unified Post and a wall to land on. |
| 7 | **Chat attachments** | 2 (and 1 for localised push) | Touches the most sensitive path (`chatHandler`, store-first). Do after the pipeline has been exercised by posts. Includes `Message`/`Conversation` change, history presenter, `MessageBubble`. |
| 8 | **i18n legacy sweep** of pre-v1.1 screens | 1 | Low risk, large diff; schedule last so it does not conflict with feature work, but before milestone close. |

Parallelisable tracks: {0}, {1 → 2 → 3 → 6, 7}, {4 (non-wall parts), 5}.

**Needs deeper research / spike before planning:**
- Unit 2: signed write-URL on Storage emulator; `x-goog-content-length-range` from RN; sharp prebuilt binary on the deploy target; Yandex Music preview feasibility.
- Unit 7: back-pressure and failure UX for chat uploads (retry, offline), plus whether friends skip the MessageRequest gate (product call).
- Unit 1: Reanimated/worklets/gesture-handler version set compatible with RN 0.86 + Expo 57 (use `npx expo install` to resolve pinned versions; do not hand-pick).

---

## 11. Patterns to Follow

1. **Reserve-then-claim for uploads.** Bytes are uploaded and validated *before* any entity references them; entities reference opaque `mediaId`s that the server atomically claims for the right owner and purpose. Prevents attaching someone else's file, double-attaching, and phantom references.
2. **Persist paths, resolve URLs at the edge.** Existing invariant, extended: nothing signed is ever stored; one service signs.
3. **Single projection/presenter per entity.** `buildPublicProfile`, `postPresenter`, listing detail's explicit object. Never spread a document into a response.
4. **Opt-in secrets in schema.** `select:false` on `exactLocation`, `exactAddress`; fields must be explicitly selected to be read.
5. **Atomic single-document state transitions** (`findOneAndUpdate` with the expected status in the filter) instead of read-modify-write; no reliance on multi-doc transactions.
6. **Server-derived identity and scope.** `authorUid`, `wallOwnerUid`, `citySlug`, `locale` come from the verified token / profile, never the body (continues T-03-01-01, T-02-05-01).

## 12. Anti-Patterns to Avoid

| Anti-pattern | Why bad | Instead |
|--------------|---------|---------|
| Separate `WallPost` collection | Duplicates comments/likes/reports/attachments/cursor code | `scope` + `wallOwnerUid` on `Post` |
| Embedding the original in each repost | Stale after edits/deletes, bloats wall | `repostOf` ref, resolved at read time, `unavailable` placeholder |
| Sending files through Socket.io | 1 MB default cap, blocks the event loop, loses resumability | Upload via REST/Storage, send ids over the socket |
| Per-request random location jitter | Averaged out by repeated queries | Stable keyed offset stored once |
| Serving raw uploaded images | EXIF GPS leaks | Re-encode derivatives, delete original |
| Trusting client MIME/filename/size/preview metadata | Spoofing, stored XSS-by-file, SSRF/fake previews | Allow-list + magic-byte sniff + server-side preview fetch + server-chosen paths |
| Denormalised `friendsCount` maintained across several writes | Drifts without transactions | `countDocuments` on indexed fields |
| Localised strings stored in DB (`lastMessagePreview`) | Locks one language into history | Store kind/code, localise at the edge |
| Server-side full-URL signing for every attachment on every list read | Latency and over-exposed bearer URLs | Eager thumbs, lazy full URLs via authorised endpoint |
| Cascade-deleting reposts when the original is deleted | Destroys other users' wall content | Keep, render `unavailable` |

## 13. Scaling Considerations

| Concern | ~1k users (launch) | ~10k | ~100k+ |
|---------|--------------------|------|--------|
| Feed/wall reads | Indexes above; 4 round trips/page | same; in-process signed-URL cache | cache presented pages per post id (Redis), fan-out-on-read still fine |
| Signed URL cost | negligible | add cache (5.3) | CDN/Cloud CDN signed cookies or signed URL at edge |
| Upload load | direct-to-Storage means Node is not in the byte path | add `Media` pending cap per user | move processing (sharp) to a worker queue; add video transcode |
| Counts | `countDocuments` | still fine | denormalise `friendsCount/followersCount` with reconcile job |
| Likes (`likedBy[]`) | fine | watch hot posts | move to a `Like` collection (pre-existing debt, out of scope) |
| City chat fan-out | existing 200-recipient cap | batch Expo pushes in chunks of 100 | queue |
| Media sweeper | `setInterval` in process | scheduler / leader election if multi-instance | dedicated job |

First bottleneck to expect: **image processing (`sharp`) running inline in `complete`** under bursts; second: signed-URL generation without the cache.

## 14. Integration Points Summary

### Modified (existing files that must change)

| File | Change |
|------|--------|
| `backend/src/models/Post.js` | scope, wallOwnerUid, attachments, repostOf/repostCount, text optional, new indexes |
| `backend/src/models/Message.js` | attachments; content conditionally required |
| `backend/src/models/Conversation.js` | `lastMessageKind` |
| `backend/src/models/User.js` | cover, status, details, hiddenFields, locale, `blockedUsers` index |
| `backend/src/models/Listing.js` | exactLocation (select:false), public `location`, `locationRadiusM`, `areaName`; `select:false` on `exactAddress` |
| `backend/src/services/storageService.js` | `getUploadUrl`, `deleteFile`, stream/proxy upload, optional signing cache |
| `backend/src/services/userSummaryService.js` | parallel signing |
| `backend/src/services/notificationService.js` | accept `{title, body}` produced by `t()`; chunking |
| `backend/src/controllers/postController.js` | JSON create, scope-aware list, repost, delete cleanup, use presenter |
| `backend/src/controllers/userController.js` | `getProfile` via `profileService` + relation; extended `updateProfile`; cover; locale |
| `backend/src/controllers/listingController.js` | write `exactLocation`+fuzzed `location`; reveal branch uses `+exactLocation` |
| `backend/src/controllers/conversationController.js` | project/present attachments, `lastMessageKind` |
| `backend/src/socket/chatHandler.js` | attachments, clientId, locale, codes; remove English literals |
| `backend/src/server.js` | mount `/api/media`, `/api/friends`, `/api/follows`; start sweeper |
| `backend/src/routes/posts.js`, `users.js` | new routes (wall, repost, cover-photo, locale, friends/followers lists); keep legacy multer `photo` for one release |
| `mobile/src/services/api.ts` | media, friends, wall, repost, locale functions |
| `mobile/src/services/socketService.ts` | friend events, `clientId` handling, attachments in `message:new`, `locale:set` |
| `mobile/src/types/{community,conversation,listing}.ts` | attachment, repost, relation, circle fields |
| `mobile/src/store/{feedStore,profileStore,conversationStore}.ts` | attachments, wall state, relation |
| `mobile/src/components/{Community/PostCard,Chat/MessageBubble,Chat/ChatInput,Map/*}` | attachments, composer, circle in place of pin |
| `mobile/src/screens/Profile/*`, `Community/*`, `Messages/*`, `Housing/*` | tabs/wall, composer, chat attach, area copy |
| `mobile/src/navigation/*` | Friends screens, media viewer modal, language setting |

### New

Backend: `Media`, `Friendship`, `Follow`, `attachmentSchema`, `mediaService`, `attachmentService`, `postPresenter`, `profileService`, `friendshipService`, `linkPreviewService`, `locationService`, `i18n/*`, `utils/{cursor,appError}`, `jobs/mediaSweeper`, `scripts/migrate-v11`, `routes+controllers` for media and friends, `config/mediaLimits`.
Mobile: `i18n/*`, `components/Media/*`, `hooks/{useMediaUpload,useLocale}`, `store/friendStore`, `screens/Friends/*`, `constants/media`.
Dependencies — backend: `sharp`, `file-type`, `express-rate-limit`. Mobile (via `npx expo install`): `expo-video`, `expo-audio`, `expo-document-picker`, `expo-localization`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets`, `i18next`, `react-i18next`.

### External

| Service | Integration | Notes |
|---------|-------------|-------|
| Firebase Storage | Admin SDK signed read + signed write URL; deny-all rules | emulator write-URL support unverified (SPIKE); keep `mediaUri()` host rewrite for dev |
| YouTube / Spotify oEmbed | server-side GET, allow-listed | keyless, public |
| Yandex Music | best-effort OG fetch, else link-only card | no documented oEmbed |
| Expo Push | unchanged; payload text now localised | |

## Sources

- Codebase (read directly, HIGH): `backend/src/models/{Post,User,Message,Listing,Conversation,MessageRequest}.js`, `services/{storageService,userSummaryService,notificationService}.js`, `controllers/{postController,listingController,userController,conversationController}.js`, `socket/chatHandler.js`, `routes/{posts,users}.js`, `middleware/auth.js`, `server.js`, `mobile/src/services/{api,socketService}.ts`, `mobile/src/utils/media.ts`, `mobile/package.json`, `screens/Housing/CreateListingScreen.tsx`, `.planning/PROJECT.md`.
- Expo SDK 57 docs (HIGH): [expo-video](https://docs.expo.dev/versions/v57.0.0/sdk/video/) (thumbnail generation, caching, plugin flags), [expo-audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/) (remote playback hooks), [expo-localization](https://docs.expo.dev/versions/v57.0.0/sdk/localization/) (getLocales/useLocales, pairing with react-i18next), [expo-document-picker](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/) (multiple, size/mimeType), [expo-file-system](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/) (`File.upload` with `BINARY_CONTENT`, legacy `uploadAsync`).
- GCS size limits on signed PUT (MEDIUM): [DEV Community: limit upload size with signed URLs on GCS](https://dev.to/nachocoloma/limit-the-size-of-uploaded-files-with-signed-urls-on-gcs-4e34) (Content-Length ignored on PUT; use `x-goog-content-length-range`); [signed policy documents alternative](https://oneuptime.com/blog/post/2026-02-17-how-to-use-signed-policy-documents-for-browser-based-uploads-to-google-cloud-storage/markdown).
- Spotify oEmbed (MEDIUM): [developer.spotify.com using the oEmbed API](https://developer.spotify.com/documentation/embeds/tutorials/using-the-oembed-api).
- Yandex Open Graph (LOW for Music specifically): [Yandex Open Graph docs](https://yandex.ru/support/webmaster/ru/video/open-graph.md).
- Signed-URL write action in Admin SDK: confirmed to exist (MEDIUM); emulator behaviour for write URLs: not found (LOW, SPIKE).

---
*Architecture research for: WomenApp v1.1 social features and media*
*Researched: 2026-10-13*
