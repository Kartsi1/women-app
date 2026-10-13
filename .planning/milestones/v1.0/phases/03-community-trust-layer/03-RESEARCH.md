# Phase 03: Community & Trust Layer — Research

**Researched:** 2026-07-09
**Domain:** Community feed (posts/comments/likes), blind-release review system, feed pagination, polymorphic reporting
**Confidence:** HIGH (based on deep codebase inspection of phases 1–2 + verified patterns from existing controllers)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Review eligibility triggered by `StayRequest.checkOut` in the past (status=`accepted`).
- 14-day blind window anchored on `checkOut`; reveal deadline = `checkOut + 14 days`.
- One review per direction per stay: `(stayRequestId, direction)` uniqueness constraint.
- **Blind release: lazy-on-read, NO cron/scheduler.** Reveal = `(bothSubmitted) OR (now >= checkOut + 14d)`. Server-side gate, explicit projection. Client is never the gate.
- Before reveal: reviewer sees only their own review; counterpart review MUST NOT be returned by API.
- Rating 1–5 stars + free text. Immutable after submit.
- After reveal: aggregate onto subject User profile — average rating + review count + list. Counts REVEALED only.
- One global feed for all verified users, reverse-chronological, cursor-paginated (`?before=<lastId>`).
- Post = text (required) + optional single photo (reuse Firebase Storage upload pipeline).
- Comment on any post; like any post (idempotent — at most once per user).
- Moderation via existing Report model/flow. Deletion by author and admin.
- All feed reads/writes gated by `verifyFirebaseToken + requireVerified`.

### Claude's Discretion (implementation defaults — planner may refine)
- Comments in a SEPARATE collection referencing `postId` (not embedded).
- Likes: `$addToSet` on `likedBy` array + denormalised `likeCount`.
- Feed/comments/likes are REST (not socket real-time) for MVP.
- Report model extended with `targetType: 'user'|'post'|'comment'` + `targetId` discriminator.
- Push (optional): notify post author when their post receives a comment. No push on likes.
- Review write endpoint rejects if `now < checkOut` or if review already exists for `(stayRequestId, direction)`.

### Deferred Ideas (OUT OF SCOPE)
- Real-time live-updating feed (socket).
- Post search / hashtags / filtering.
- Meetups / events.
- Rich media (multiple photos, video).
- Push notifications at exact 14-day reveal moment (requires scheduler).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMM-01 | Verified user can create a post with text and an optional photo | Post model + multer single-file upload + Firebase Storage `uploadFile()` reuse |
| COMM-02 | Verified user can comment on any post in the feed | Comment model (separate collection) + `postId` reference + REST endpoint |
| COMM-03 | Verified user can like a post (idempotent) | `$addToSet likedBy` + denormalised `likeCount` + unlike via `$pull` |
| REVW-01 | Guest can submit a written review for a host after a confirmed stay | Review model + eligibility check (`status=accepted && now >= checkOut`) + uniqueness constraint |
| REVW-02 | Host can submit a written review for a guest after a confirmed stay | Same model, direction=`host_to_guest`; symmetric to REVW-01 |
| REVW-03 | Reviews use blind release — visible only after both submit or after 14 days | Lazy-on-read predicate; computed at GET time; explicit projection gate |
</phase_requirements>

---

## Summary

Phase 3 adds two trust features on top of the established Express + Mongoose + Firebase Auth + Socket.io stack: a community feed (posts, comments, likes) and a blind-release review system. Both features compose entirely from patterns already proven in phases 1–2 — the Firebase Storage upload pipeline, `verifyFirebaseToken + requireVerified` middleware, `notificationService.sendPushNotification`, Zustand stores, and the `api.ts` fetch client. No new backend runtime dependency is needed.

The most architecturally sensitive decision is the **blind-release reveal predicate**. The CONTEXT.md locks it as lazy-on-read: the GET endpoint for a stay's reviews reads both Review documents (if they exist), loads the associated StayRequest for `checkOut`, computes `revealed = bothSubmitted || (now >= checkOut + 14d)`, and conditionally strips the counterpart's text from the response. This is the same discipline used for `exactAddress` hiding in phase 2 (explicit projection, never spread raw document). No scheduler infrastructure is needed.

The **Report model extension** is a non-breaking enum addition: the existing `contentType` field already holds `'listing'|'message'|'user'`; adding `'post'|'comment'` to that enum requires zero schema migration and no new model. The `contentId` field already stores a string ID for the reported content item.

**Primary recommendation:** Build the community feed first (COMM-01→03), then reviews (REVW-01→03), in that order. Feed involves more UI surface but simpler server logic. Reviews involve simpler UI but require careful projection discipline on the reveal gate. Treat the reveal predicate as a security invariant equivalent to `exactAddress` hiding.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Feed creation (COMM-01) | API / Backend | — | Auth gate, Firebase Storage write, DB write |
| Feed read + pagination (COMM-01) | API / Backend | Client (state) | Server owns sort + cursor; client owns FlatList + scroll state |
| Comment CRUD (COMM-02) | API / Backend | — | Auth gate; separate DB collection |
| Like toggle (COMM-03) | API / Backend | Client (optimistic) | `$addToSet`/`$pull` is server-owned; client optimistically updates count |
| Review eligibility check (REVW-01/02) | API / Backend | — | Must verify `stayRequestId` + `status=accepted` + `now >= checkOut` server-side |
| Blind-release reveal gate (REVW-03) | API / Backend | — | Safety-critical; client is NEVER the gate |
| Review aggregation on profile (REVW-01/02/03) | API / Backend | — | Aggregation of revealed reviews onto User profile |
| Reveal state display (REVW-03) | Client | — | Renders enum returned by API; no gate logic |
| Post photo upload (COMM-01) | API / Backend | — | Reuse `storageService.uploadFile()`; multer `single('photo')` |
| Comment push notification (COMM-02) | API / Backend | — | Fire-and-forget via `notificationService.sendPushNotification()` |
| Report submission (COMM-01/02) | API / Backend | — | Extend existing Report model enum |

---

## Standard Stack

### Core (all already installed — zero new backend dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mongoose | 8.4.1 [VERIFIED: package.json] | Post/Comment/Review/Report models | Already the project ODM |
| multer | 2.2.0 [VERIFIED: package.json] | Single-file post photo upload | Already used for listings + profile photo |
| firebase-admin | 14.1.0 [VERIFIED: package.json] | Firebase Storage write via `storageService.uploadFile()` | Already used for all uploads |
| expo-server-sdk | 6.1.0 [VERIFIED: package.json] | Optional comment push notification | Already used in `notificationService.js` |
| express | 4.19.2 [VERIFIED: package.json] | REST routes for feed + reviews | Already the project HTTP framework |

### Mobile (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-image-picker | ~57.0.2 [VERIFIED: package.json] | Single photo selection for post compose | Already installed from phase 2 listing + profile photo |
| zustand | 5.0.14 [VERIFIED: package.json] | Feed store, review store | Already the project state management |
| @expo/vector-icons | 15.0.2 [VERIFIED: package.json] | Heart/comment/flag/star icons | Already bundled with Expo 57 |

### No New Packages Required

Phase 3 requires **zero new npm installs** on either side. Every capability composes from existing dependencies. `expo-image-picker` is already in `mobile/package.json` at version `~57.0.2` — the UI-SPEC note to "verify before re-installing" is confirmed: it is already present.

---

## Package Legitimacy Audit

All packages used in this phase are already installed in the project (not new installs for phase 3).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| multer | npm | Long-established (v2.2.0 published 2026-06-15) | 17.9M/wk | github.com/expressjs/multer | SUS (too-new flag) | Approved — false positive; expressjs org, 17M weekly downloads, already in project |
| mongoose | npm | 13+ yrs (v latest published 2026-07-06) | 5.9M/wk | github.com/Automattic/mongoose | SUS (too-new flag) | Approved — false positive; Automattic org, 5.9M weekly downloads, already in project |
| expo-server-sdk | npm | Maintained by Expo | 864K/wk | github.com/expo/expo-server-sdk-node | OK | Approved |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious SUS:** multer and mongoose trigger `too-new` due to recent patch releases; both are long-established official packages already installed in the project. No human-verify checkpoint needed for phase 3 since no new packages are being installed.

---

## Architecture Patterns

### System Architecture Diagram

```
Mobile Client (Expo)
  |
  |  REST (authHeaders + Bearer token)
  v
Express API (/api/posts, /api/comments, /api/reviews)
  |          |
  |          |-- verifyFirebaseToken + requireVerified (all routes)
  |
  |-- POST /api/posts
  |     multer.single('photo') → storageService.uploadFile('posts/<uid>/<id>/photo')
  |     → Post.create({ authorUid, text, photoUrl, likedBy:[], likeCount:0 })
  |     → { data: { id } }
  |
  |-- GET /api/posts?before=<cursor>
  |     cursor decode → compound find({ $or:[...] }) → sort createdAt:-1,_id:-1
  |     → limit(21) → hasMore if 21 returned → slice to 20
  |     → { data: posts[], nextCursor: {createdAt,_id}|null }
  |
  |-- POST /api/posts/:id/like      (toggle: add or remove)
  |     $addToSet likedBy + $inc likeCount  OR  $pull + $inc:-1
  |     → { data: { likeCount, liked: bool } }
  |
  |-- POST /api/posts/:id/comments
  |     Comment.create({ postId, authorUid, text })
  |     → sendPushNotification(postAuthor, "New comment", ...)  [fire-and-forget]
  |     → { data: { id } }
  |
  |-- GET /api/posts/:id/comments
  |     Comment.find({ postId }).sort({ createdAt: 1 })  (chronological for comments)
  |     → { data: comments[] }
  |
  |-- POST /api/reviews
  |     1. Load StayRequest → verify status=accepted, now >= checkOut, caller is guest or host
  |     2. Check no existing Review for (stayRequestId, direction)
  |     3. Review.create({ stayRequestId, reviewerUid, subjectUid, direction, rating, text })
  |     → { data: { id } }
  |
  |-- GET /api/reviews/:stayRequestId         ← BLIND-RELEASE GATE
  |     Load both Review docs (if exist)
  |     Load StayRequest → checkOut
  |     revealDeadline = checkOut + 14d
  |     revealed = (ownDoc && counterpartDoc) || (now >= revealDeadline)
  |     state = 'eligible' | 'waiting' | 'revealed'
  |     If not revealed: strip counterpart text from response
  |     → { state, ownReview: {...}|null, counterpartReview: {text stripped}|null }
  |
  |-- POST /api/reports (extend existing)
  |     Report.create({ reporterUid, contentType:'post'|'comment', contentId, reason })
  |
  v
MongoDB (mongoose)
  Collections: posts, comments, reviews, reports (existing), stayrequests (existing)
```

### Recommended Project Structure

```
backend/src/
├── models/
│   ├── Post.js             # new: authorUid, text, photoUrl, likedBy[], likeCount
│   ├── Comment.js          # new: postId, authorUid, text
│   ├── Review.js           # new: stayRequestId, reviewerUid, subjectUid, direction, rating, text
│   └── Report.js           # EXISTING — enum extension only (add 'post'|'comment')
├── controllers/
│   ├── postController.js   # new: createPost, getFeed, likePost
│   ├── commentController.js # new: createComment, getComments
│   └── reviewController.js  # new: createReview, getStayReviews, getUserReviews
├── routes/
│   ├── posts.js            # new: POST /api/posts, GET /api/posts
│   ├── comments.js         # new: wired under /api/posts/:id/comments
│   └── reviews.js          # new: POST /api/reviews, GET /api/reviews/:stayRequestId

mobile/src/
├── store/
│   ├── feedStore.ts        # new: posts[], nextCursor, hasMore, isLoading
│   └── reviewStore.ts      # new: eligibleStays[], reviewState by stayRequestId
├── services/
│   └── api.ts              # EXISTING — append: createPost, getFeed, likePost, createComment, getComments, createReview, getStayReviews
├── screens/
│   ├── Community/
│   │   ├── CommunityFeedScreen.tsx   # new
│   │   ├── CreatePostScreen.tsx       # new
│   │   └── PostDetailScreen.tsx       # new
│   └── Reviews/
│       └── ReviewComposeScreen.tsx    # new
└── components/
    ├── Community/
    │   ├── PostCard.tsx
    │   ├── CommentRow.tsx
    │   ├── CommentInput.tsx
    │   └── PostPhotoAttachment.tsx
    └── Reviews/
        ├── StarRatingInput.tsx
        ├── ReviewCard.tsx
        ├── ReviewWaitingChip.tsx
        ├── ReviewRevealedChip.tsx
        └── ReviewSummaryBar.tsx
```

### Pattern 1: Blind-Release Reveal Predicate (REVW-03 — SAFETY CRITICAL)

**What:** Lazy-on-read predicate computed in the GET /api/reviews/:stayRequestId controller. Never delegated to the client. Mirrors the `exactAddress` hiding pattern from phase 2.

**When to use:** Every GET that returns review content for a stay.

```javascript
// Source: derived from phase-2 requestController.js address-hiding discipline
// backend/src/controllers/reviewController.js

async function getStayReviews(req, res) {
  try {
    const callerUid = req.user.uid;
    const { stayRequestId } = req.params;

    // Load the stay to get checkOut (eligibility anchor)
    const stay = await StayRequest.findById(stayRequestId)
      .select('guestUid hostUid checkOut status')
      .lean();
    if (!stay) return res.status(404).json({ error: 'Stay not found' });

    // Only participants may read reviews
    if (callerUid !== stay.guestUid && callerUid !== stay.hostUid) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Determine caller direction
    const callerDirection = callerUid === stay.guestUid ? 'guest_to_host' : 'host_to_guest';
    const counterpartDirection = callerDirection === 'guest_to_host' ? 'host_to_guest' : 'guest_to_host';

    // Stay must be accepted + checkOut in the past for any review state beyond 'not_eligible'
    const now = new Date();
    const stayFinished = stay.status === 'accepted' && stay.checkOut <= now;
    if (!stayFinished) {
      return res.json({ state: 'not_eligible', ownReview: null, counterpartReview: null });
    }

    // Load both review docs (explicit field selection — never spread raw doc)
    const [ownReview, counterpartReview] = await Promise.all([
      Review.findOne({ stayRequestId, direction: callerDirection })
        .select('rating text submittedAt direction')
        .lean(),
      Review.findOne({ stayRequestId, direction: counterpartDirection })
        .select('rating text submittedAt direction')  // text stripped below if not revealed
        .lean(),
    ]);

    // REVEAL PREDICATE: (both submitted) OR (now >= checkOut + 14 days)
    const revealDeadline = new Date(stay.checkOut.getTime() + 14 * 24 * 60 * 60 * 1000);
    const bothSubmitted = !!(ownReview && counterpartReview);
    const deadlinePassed = now >= revealDeadline;
    const revealed = bothSubmitted || deadlinePassed;

    // State machine
    let state;
    if (revealed) {
      state = 'revealed';
    } else if (ownReview) {
      state = 'waiting';   // caller submitted, counterpart has not yet; deadline not passed
    } else {
      state = 'eligible';  // neither has submitted yet
    }

    // Strip counterpart text before reveal — explicit projection discipline
    const safeCounterpart = revealed && counterpartReview
      ? { rating: counterpartReview.rating, text: counterpartReview.text, submittedAt: counterpartReview.submittedAt }
      : null;  // null even if counterpartReview exists but reveal not triggered

    return res.json({
      state,
      revealDeadline: revealDeadline.toISOString(),
      ownReview: ownReview
        ? { rating: ownReview.rating, text: ownReview.text, submittedAt: ownReview.submittedAt }
        : null,
      counterpartReview: safeCounterpart,
    });
  } catch (err) {
    console.error('[getStayReviews]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

**Source:** Pattern derived from `requestController.js` address-hiding discipline + CONTEXT.md locked decisions. [ASSUMED: exact implementation shape — logic is prescribed by CONTEXT.md, code is illustrative]

---

### Pattern 2: Cursor Pagination for Feed

**What:** Compound cursor (`createdAt` + `_id`) for stable reverse-chronological feed. Eliminates skip/limit instability when new posts arrive between page loads.

**When to use:** GET /api/posts and GET /api/posts/:id/comments (comments are chronological, same cursor shape).

```javascript
// Source: derived from existing getConversationMessages pattern in phase 2
// backend/src/controllers/postController.js

async function getFeed(req, res) {
  try {
    const PAGE_SIZE = 20;
    let filter = {};

    if (req.query.before) {
      // Cursor is base64-encoded JSON { createdAt: ISO, _id: ObjectIdHex }
      const cursor = JSON.parse(Buffer.from(req.query.before, 'base64').toString());
      const cursorDate = new Date(cursor.createdAt);
      const cursorId = cursor._id;
      filter = {
        $or: [
          { createdAt: { $lt: cursorDate } },
          { createdAt: cursorDate, _id: { $lt: cursorId } },
        ],
      };
    }

    // Fetch PAGE_SIZE+1 to detect hasMore
    const posts = await Post.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(PAGE_SIZE + 1)
      .select('authorUid text photoUrl likeCount likedBy commentCount createdAt')
      .lean();

    const hasMore = posts.length > PAGE_SIZE;
    const page = hasMore ? posts.slice(0, PAGE_SIZE) : posts;

    let nextCursor = null;
    if (hasMore) {
      const last = page[page.length - 1];
      nextCursor = Buffer.from(JSON.stringify({
        createdAt: last.createdAt.toISOString(),
        _id: String(last._id),
      })).toString('base64');
    }

    return res.json({ data: page, nextCursor, hasMore });
  } catch (err) {
    console.error('[getFeed]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

**Source:** Same cursor pattern used by `getConversationMessages` in phase 2 (before-based ISO cursor). [ASSUMED: exact cursor encoding — base64 vs plain JSON both valid]

---

### Pattern 3: Idempotent Like Toggle

**What:** Two-operation like/unlike that keeps `likeCount` denormalised. Uses `$addToSet` (idempotent add) and `$pull` (idempotent remove).

**When to use:** POST /api/posts/:id/like

```javascript
// Source: [ASSUMED] — standard MongoDB idempotent toggle pattern
// backend/src/controllers/postController.js

async function toggleLike(req, res) {
  try {
    const { uid } = req.user;
    const post = await Post.findById(req.params.id).select('likedBy').lean();
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const alreadyLiked = post.likedBy.includes(uid);

    const update = alreadyLiked
      ? { $pull: { likedBy: uid }, $inc: { likeCount: -1 } }
      : { $addToSet: { likedBy: uid }, $inc: { likeCount: 1 } };

    const updated = await Post.findByIdAndUpdate(req.params.id, update, { new: true })
      .select('likeCount likedBy')
      .lean();

    return res.json({ data: { likeCount: updated.likeCount, liked: !alreadyLiked } });
  } catch (err) {
    console.error('[toggleLike]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

**Caveat:** `$addToSet` + `$inc` in a single update is NOT atomic for the counter. If a like is toggled concurrently, `likeCount` can drift from `likedBy.length`. For MVP scale this is acceptable. The true source of truth is `likedBy.length`; `likeCount` is a denormalised optimisation. [ASSUMED: MVP concurrency tolerance]

---

### Pattern 4: Report Model Enum Extension (least-disruptive)

**What:** Add `'post'` and `'comment'` to the existing `contentType` enum in `Report.js`. No new model, no migration.

```javascript
// Source: existing Report.js [VERIFIED: backend/src/models/Report.js]
// Change: extend enum from ['listing', 'message', 'user'] to include 'post' and 'comment'

contentType: { type: String, enum: ['listing', 'message', 'user', 'post', 'comment'] },
```

Existing `contentId` field (String) already accepts MongoDB ObjectId strings for post/comment IDs — no change needed. Existing `reportedUid` remains optional and is set when reporting a user directly. For post/comment reports, set `contentType` + `contentId`; `reportedUid` is set to the post/comment author's UID by the controller (not the client).

**Route reuse:** The existing `POST /api/users/report` route accepts this payload already. No new route needed unless a separate `/api/posts/:id/report` path is preferred for REST clarity. Either approach is valid — the CONTEXT.md says "reuse existing Report model/flow".

---

### Pattern 5: Multer Single-File Post Photo Upload

**What:** Reuse `storageService.uploadFile()` with a single-file multer config. Storage path: `posts/<authorUid>/<postId>/photo`.

```javascript
// Source: derived from listings.js multer setup [VERIFIED: backend/src/routes/listings.js]
// backend/src/routes/posts.js

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },  // 5MB cap — same as listing photos
}).single('photo');  // single file, field name 'photo'

router.post('/', verifyFirebaseToken, requireVerified, upload, postController.createPost);
```

In controller:
```javascript
// Photo is optional — only upload if file present
let photoUrl = null;
if (req.file) {
  const postId = new mongoose.Types.ObjectId(); // pre-generate for path
  const path = `posts/${uid}/${postId}/photo`;
  await storageService.uploadFile(path, req.file.buffer, req.file.mimetype);
  photoUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${path}`;
  // Or use getSignedUrl() if bucket is private (consistent with listing photos)
}
```

**Check:** Listing photos use Firebase Storage with public URLs (set during upload via `makePublic()`). Confirm the existing `uploadFile()` call in `listingController.js` to determine whether post photos should use public URL or signed URL. [ASSUMED: public URL — consistent with listing photo pattern; verify in listingController.js]

---

### Pattern 6: expo-image-picker Single Image (Mobile)

**What:** Pick one photo for post compose. `expo-image-picker` is already installed at `~57.0.2`.

```typescript
// Source: [ASSUMED — expo-image-picker API for SDK 57; verify at docs.expo.dev/versions/v57.0.0/]
// mobile/src/components/Community/PostPhotoAttachment.tsx

import * as ImagePicker from 'expo-image-picker';

async function pickPhoto() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    // Show permission denied message
    return;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    // NOTE: MediaTypeOptions is deprecated in newer expo-image-picker — use MediaType if available
    mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? [ImagePicker.MediaType.Images],
    allowsEditing: true,
    quality: 0.8,
    allowsMultipleSelection: false,
  });
  if (!result.canceled && result.assets.length > 0) {
    setPhotoUri(result.assets[0].uri);
  }
}
```

**IMPORTANT:** Check the exact API shape for `expo-image-picker` v57.0.2 at `https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/` before coding. `MediaTypeOptions` vs `MediaType` varies by version. The mobile AGENTS.md mandates reading versioned docs before any code.

---

### Pattern 7: Zustand Feed Store (Mobile)

**What:** Feed store following existing store shape (`listingStore.ts`, `profileStore.ts`).

```typescript
// Source: derived from listingStore.ts [VERIFIED: mobile/src/store/listingStore.ts]
// mobile/src/store/feedStore.ts

interface FeedState {
  posts: Post[];
  nextCursor: string | null;
  hasMore: boolean;
  isLoading: boolean;
  setPosts: (posts: Post[]) => void;
  appendPosts: (posts: Post[], nextCursor: string | null, hasMore: boolean) => void;
  setIsLoading: (v: boolean) => void;
  clear: () => void;
}

export const useFeedStore = create<FeedState>()((set) => ({
  posts: [],
  nextCursor: null,
  hasMore: true,
  isLoading: false,
  setPosts: (posts) => set({ posts, nextCursor: null, hasMore: true }),
  appendPosts: (newPosts, nextCursor, hasMore) =>
    set((state) => ({ posts: [...state.posts, ...newPosts], nextCursor, hasMore })),
  setIsLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ posts: [], nextCursor: null, hasMore: true, isLoading: false }),
}));
```

---

### Anti-Patterns to Avoid

- **Skip/offset pagination for the feed:** `Post.find().skip(page * 20).limit(20)` is unstable — new posts shift indices between pages, causing duplicates and gaps. Use the createdAt+_id cursor pattern.
- **Embedding comments in the Post document:** Comments can grow without bound on popular posts, hitting MongoDB's 16MB document limit. The project already learned this lesson with messages (separate collection decision in STATE.md). Comments MUST be a separate collection.
- **Client-side reveal gate:** Returning counterpart review text and hiding it in the UI is a security failure — the app can be modified. The server must strip the text field before the response leaves the API.
- **Trusting body for authorUid/reviewerUid:** All user identity MUST come from `req.user.uid` (verified Firebase token), never from request body. Established pattern from `requestController.js` (T-02-03-04).
- **Mutable reviews:** Once a review is submitted, the controller must reject any PUT/PATCH. Immutability protects blind-release honesty — a reviewer cannot change their review after seeing the counterpart's (post-reveal).
- **`$addToSet` + `$inc` without pre-check:** If the same user spams the like endpoint, `$addToSet` is idempotent but `$inc` is NOT — it will double-count. Always pre-check `alreadyLiked` (one extra read) or use MongoDB's `findOneAndUpdate` with `{ upsert: false }` and check `nModified`. For MVP the pre-check approach is clearest.
- **Not requesting `requestMediaLibraryPermissionsAsync` before `launchImageLibraryAsync`:** On Android the image picker silently fails without explicit permission request. This was a known pitfall in phase 2 for listing photos.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Firebase Storage upload for post photo | Custom HTTP multipart to GCS | `storageService.uploadFile()` [VERIFIED: backend/src/services/storageService.js] | Already handles Admin SDK, resumable:false, buffer upload |
| Push notification for comment | Custom FCM direct call | `notificationService.sendPushNotification()` [VERIFIED: backend/src/services/notificationService.js] | Already handles Expo token validation, no-op on missing token |
| Firebase token verification | Custom JWT decode | `verifyFirebaseToken` middleware [VERIFIED: backend/src/middleware/auth.js] | Already handles Admin SDK verify, sets `req.user.uid` |
| Idempotent set membership | Custom dedup logic | MongoDB `$addToSet` | Atomic at DB level; avoids race conditions |
| Compound cursor encoding | Custom pagination state machine | Base64-encoded JSON cursor (same as phase 2 `before` param) | Consistent with existing `getConversationMessages` API shape |
| Polymorphic report target | New ReportPost + ReportComment models | Extend existing `Report.contentType` enum | Non-breaking; one collection, existing admin panel works |

**Key insight:** Phase 3 is a composition phase — every hard problem (auth, uploads, push, pagination) already has a verified solution in the codebase. The unique work is the blind-release gate and the feed models.

---

## Common Pitfalls

### Pitfall 1: Counter Drift in Idempotent Like
**What goes wrong:** `$addToSet likedBy` + `$inc likeCount` in one update — if `$addToSet` is a no-op (user already liked), `$inc` still fires, inflating the count.
**Why it happens:** MongoDB does not condition `$inc` on whether `$addToSet` actually inserted a value.
**How to avoid:** Pre-read `likedBy` array for the caller's UID first; choose `$addToSet`+`$inc` or `$pull`+`$inc:-1` based on the pre-read. Alternatively, drop `likeCount` and count `likedBy.length` at read time (simpler but no index). For MVP: pre-check pattern (one extra find) — simplest to reason about.
**Warning signs:** `likeCount` grows continuously even when same user clicks like repeatedly.

### Pitfall 2: Reveal Gate Bypassed by Client
**What goes wrong:** Server returns both review texts always, and the mobile app conditionally renders based on a flag. A modified client skips the flag check and reads the counterpart's review early.
**Why it happens:** Trust boundary confusion — client is treated as the gate.
**How to avoid:** The `getStayReviews` controller MUST set `counterpartReview.text = undefined` (or omit the field entirely) when `revealed === false`. The field must not be present in the JSON response at all. Same discipline as `exactAddress` (which is never spread into the response object).
**Warning signs:** API response includes `counterpartReview.text` in the `waiting` state.

### Pitfall 3: Mutable Review After Reveal
**What goes wrong:** A guest submits a review, both reviews reveal. The guest then edits their review to say something harsh after seeing the host's review.
**Why it happens:** Missing immutability enforcement in the PATCH handler.
**How to avoid:** The Review model should not have a PATCH route at all. If one is ever added, the controller must check `review.submittedAt` and reject updates. Add `immutable: true` on key fields in the schema or enforce in the controller. Document this as an invariant.
**Warning signs:** A PUT/PATCH route for `/api/reviews/:id` exists without an immutability guard.

### Pitfall 4: Feed Pagination Duplicate/Gap
**What goes wrong:** New posts arrive between page 1 and page 2 loads; skip-based pagination skips or duplicates posts.
**Why it happens:** `skip(20)` recalculates offset after new inserts shift positions.
**How to avoid:** Use the createdAt+_id compound cursor. The cursor anchors to the last seen item's position, not a numeric offset.
**Warning signs:** Users see the same post twice when scrolling, or posts disappear between pages.

### Pitfall 5: Comments Embedded in Post Document
**What goes wrong:** `post.comments.push(newComment)` works until a popular post gets thousands of comments, hitting MongoDB's 16MB per-document limit and crashing reads.
**Why it happens:** Embedding is the intuitive default in Mongoose.
**How to avoid:** Comment is its own collection (`comments`) with `postId` reference. The Post schema stores only `commentCount` (denormalised). Load comments via `Comment.find({ postId }).sort({ createdAt: 1 })`.
**Warning signs:** Post schema has `comments: [{ type: ... }]` array field.

### Pitfall 6: expo-image-picker API Mismatch for SDK 57
**What goes wrong:** Code uses `ImagePicker.MediaTypeOptions.Images` which is deprecated in newer versions; or uses the new `MediaType.Images` which doesn't exist in older versions. Results in runtime error.
**Why it happens:** expo-image-picker API changed between SDK versions.
**How to avoid:** Read `https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/` before writing any picker code (mandated by `mobile/AGENTS.md`). Use the API shape documented for v57.0.2 specifically.
**Warning signs:** "MediaType is not defined" or "MediaTypeOptions is deprecated" console warning on pick.

### Pitfall 7: Review Submitted Before Stay Ends
**What goes wrong:** A user submits a review before `checkOut` date, e.g. mid-stay.
**Why it happens:** Missing server-side date check in review write endpoint.
**How to avoid:** Controller checks `now >= stay.checkOut` (CONTEXT.md locked decision). Return 422 with "Stay has not ended yet — reviews open after checkOut date."
**Warning signs:** Reviews can be submitted for stays with `checkOut` in the future.

### Pitfall 8: authorUid from Request Body
**What goes wrong:** Post/comment/review is created with `authorUid` taken from `req.body.authorUid` — a user impersonates another.
**Why it happens:** Copy-paste from a tutorial that doesn't distinguish auth patterns.
**How to avoid:** ALWAYS use `req.user.uid` (set by `verifyFirebaseToken`) for all ownership fields. Same invariant as `guestUid` in `requestController.js` (T-02-03-04).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Embedded comments in Post | Separate `comments` collection with `postId` | Phase 2 decision (messages) | Avoids 16MB limit on popular posts |
| Cron-based review reveal | Lazy-on-read predicate | CONTEXT.md (no scheduler infra) | Zero infrastructure; reveals on next read instead of at exact deadline |
| Skip/offset pagination | Cursor (createdAt+_id compound) | Phase 2 getConversationMessages | Stable under concurrent inserts |
| Custom file upload | `storageService.uploadFile()` + multer memoryStorage | Phase 1-2 | Consistent path conventions; no temp file disk I/O |

---

## New Models Required

### Post Model
```javascript
// backend/src/models/Post.js
const postSchema = new Schema({
  authorUid:    { type: String, required: true, index: true },
  text:         { type: String, required: true, maxlength: 1000 },
  photoUrl:     { type: String, default: null },  // Firebase Storage public URL or null
  likedBy:      [{ type: String }],               // array of Firebase UIDs
  likeCount:    { type: Number, default: 0 },     // denormalised; source of truth is likedBy.length
  commentCount: { type: Number, default: 0 },     // denormalised; increment on comment create
}, { timestamps: true });

postSchema.index({ createdAt: -1, _id: -1 });  // compound cursor index for feed pagination
postSchema.index({ authorUid: 1 });            // author's own posts lookup
```

### Comment Model
```javascript
// backend/src/models/Comment.js
const commentSchema = new Schema({
  postId:    { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  authorUid: { type: String, required: true },
  text:      { type: String, required: true, maxlength: 500 },
}, { timestamps: true });
```

### Review Model
```javascript
// backend/src/models/Review.js
const reviewSchema = new Schema({
  stayRequestId: { type: Schema.Types.ObjectId, ref: 'StayRequest', required: true, index: true },
  reviewerUid:   { type: String, required: true },
  subjectUid:    { type: String, required: true, index: true },  // for profile aggregation
  direction:     { type: String, enum: ['guest_to_host', 'host_to_guest'], required: true },
  rating:        { type: Number, min: 1, max: 5, required: true },
  text:          { type: String, required: true, minlength: 20, maxlength: 2000 },
  submittedAt:   { type: Date, default: Date.now },
}, { timestamps: true });

// CRITICAL: uniqueness per stay per direction (one review per reviewer per stay)
reviewSchema.index({ stayRequestId: 1, direction: 1 }, { unique: true });
// For profile aggregation: all revealed reviews where caller is the subject
reviewSchema.index({ subjectUid: 1, submittedAt: -1 });
```

### Report Model (extension only — NOT a new model)
```javascript
// backend/src/models/Report.js — CHANGE ONLY:
// Extend contentType enum from ['listing', 'message', 'user'] to:
contentType: { type: String, enum: ['listing', 'message', 'user', 'post', 'comment'] },
// contentId (String) already accepts ObjectId hex strings — no change needed
// reportedUid remains optional — controller sets to post/comment author UID for post/comment reports
```

---

## User Model Extension (for review aggregation)

The existing `User` model needs two new fields for revealed review aggregation:

```javascript
// backend/src/models/User.js — ADD:
avgRating:     { type: Number, default: null },  // null until first revealed review
reviewCount:   { type: Number, default: 0 },     // count of revealed reviews
```

**Aggregation approach (lazy):** When GET /api/reviews/:stayRequestId reveals reviews for the first time (state changes to `revealed`), or when GET /api/users/:uid is called, the `reviewController.getUserReviews` function fetches all Review documents for `subjectUid` where the blind-release predicate is satisfied, and returns them. The `avgRating` and `reviewCount` on User are either:

1. **Computed at GET time** (simplest for MVP — no denormalisation needed): `getUserReviews` runs the predicate per review, counts revealed ones, computes average. No User field update needed. Slightly more DB work per profile load.
2. **Denormalised on reveal** (faster reads): When a review is first revealed (detected on GET /reviews/:stayRequestId), update User with `$inc reviewCount` and recalculate `avgRating`. Requires tracking "has this pair been revealed before" to avoid double-counting.

**Recommendation:** Option 1 (compute at GET time) for MVP. A confirmed stay has at most 2 reviews; the profile page rarely loads at high frequency. Denormalise in a later phase if needed. [ASSUMED: MVP scale sufficient for per-request aggregation]

---

## Review Eligibility Check Helper

The review write endpoint needs to verify:
1. The `stayRequestId` references a real StayRequest
2. The caller is either `guestUid` or `hostUid` on that stay
3. `status === 'accepted'`
4. `now >= checkOut` (stay has ended)
5. No existing Review for `(stayRequestId, direction)`

```javascript
// Pattern: [ASSUMED] — follows requestController.js validation discipline
async function createReview(req, res) {
  const callerUid = req.user.uid;  // NEVER from body
  const { stayRequestId, rating, text } = req.body;

  const stay = await StayRequest.findById(stayRequestId)
    .select('guestUid hostUid checkOut status').lean();
  if (!stay) return res.status(404).json({ error: 'Stay not found' });

  const isGuest = callerUid === stay.guestUid;
  const isHost  = callerUid === stay.hostUid;
  if (!isGuest && !isHost) return res.status(403).json({ error: 'Not a participant of this stay' });

  if (stay.status !== 'accepted') return res.status(422).json({ error: 'Stay was not accepted' });
  if (new Date() < stay.checkOut) return res.status(422).json({ error: 'Stay has not ended yet' });

  const direction = isGuest ? 'guest_to_host' : 'host_to_guest';
  const subjectUid = isGuest ? stay.hostUid : stay.guestUid;

  const existing = await Review.findOne({ stayRequestId, direction });
  if (existing) return res.status(409).json({ error: 'Review already submitted' });

  // rating and text validated here ...
  const review = await Review.create({ stayRequestId, reviewerUid: callerUid, subjectUid, direction, rating, text });
  return res.status(201).json({ data: { id: review._id } });
}
```

---

## Environment Availability

Step 2.6: All external dependencies are already available — this phase adds no new runtime dependencies, CLI tools, or services. The MongoDB instance, Firebase Admin SDK, Node.js runtime, and Expo mobile runtime are already operational from phases 1–2.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend runtime | ✓ | v22.22.2 | — |
| MongoDB | Post/Comment/Review collections | ✓ | Running from phase 1 | — |
| Firebase Admin SDK | Storage upload, token verify | ✓ | 14.1.0 | — |
| multer 2.2.0 | Post photo upload | ✓ | 2.2.0 [VERIFIED: backend/package.json] | — |
| expo-server-sdk 6.1.0 | Comment push | ✓ | 6.1.0 [VERIFIED: backend/package.json] | — |
| expo-image-picker ~57.0.2 | Post photo pick on mobile | ✓ | ~57.0.2 [VERIFIED: mobile/package.json] | — |
| zustand 5.0.14 | Feed + review stores | ✓ | 5.0.14 [VERIFIED: mobile/package.json] | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

---

## Security Domain

`security_enforcement` is enabled (ASVS level 1).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `verifyFirebaseToken` middleware [VERIFIED: backend/src/middleware/auth.js] |
| V3 Session Management | no | Stateless JWT via Firebase; no session store |
| V4 Access Control | yes | `requireVerified` + participant-only review access; author-only delete |
| V5 Input Validation | yes | maxlength on Post.text (1000), Comment.text (500), Review.text (20–2000), rating (1–5 min/max in schema) |
| V6 Cryptography | no | No new crypto; Firebase handles token signing |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Impersonating authorUid in post/review body | Spoofing | Always use `req.user.uid` from verified token — never `req.body.authorUid` |
| Early review reveal (client-side gate bypass) | Information Disclosure | Strip counterpart text server-side; explicit projection; same discipline as exactAddress |
| Mutable review post-reveal | Tampering | No PATCH route on Review model; or guard with `submittedAt` check |
| Duplicate like counter inflation | Tampering | Pre-read `likedBy` before `$addToSet`+`$inc`; or use `nModified` to guard `$inc` |
| Review submitted for stay caller doesn't own | Elevation of Privilege | Verify `callerUid === stay.guestUid || callerUid === stay.hostUid` |
| Post/comment report without reason | Tampering | `reason` required in schema + controller (same as existing Report) |
| Photo upload DoS (large file) | Denial of Service | multer `limits.fileSize: 5MB` (same as listing photos) |
| Unrestricted feed access by unverified user | Elevation of Privilege | `requireVerified` on all feed + review routes |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Public URLs used for post photos (consistent with listing photos) | Pattern 5 | If listing photos use signed URLs, post photos must too — different storageService call |
| A2 | `likeCount` counter drift is acceptable at MVP scale | Pattern 3 | If high-concurrency use, likeCount can drift; fix by counting `likedBy.length` at read time |
| A3 | Compute revealed review aggregation at GET time (not denormalise) for MVP | Review aggregation section | If profile page is high-traffic, per-request aggregation adds latency |
| A4 | Cursor encoding uses base64-encoded JSON | Pattern 2 | Any stable encoding works; must match between backend and mobile `api.ts` |
| A5 | expo-image-picker v57 API: `MediaTypeOptions` vs `MediaType` | Pattern 6 | Wrong API shape causes runtime crash on photo pick — MUST verify at docs.expo.dev/versions/v57.0.0/ |
| A6 | Comment push uses `{ type: 'post_comment', postId }` data payload | Pattern for push | Payload shape affects deep-link navigation in mobile; planner must decide navigation target |

---

## Open Questions

1. **Listing photo URL format: public vs signed URL**
   - What we know: `storageService.uploadFile()` saves to Firebase Storage; `listingController.js` uses `getSignedUrl()` for admin panel but listing search returns photoUrls that are shown in the app.
   - What's unclear: Whether listing search result `photoUrls` are public URLs (via `makePublic()`) or short-lived signed URLs regenerated on each request. Post photos must match the same pattern.
   - Recommendation: Check `listingController.js` createListing response to see how `photoUrls` is built. If public URL: use `https://storage.googleapis.com/${BUCKET}/${path}`. If signed: wrap in `getSignedUrl()` per request.

2. **Comment push notification deep-link target**
   - What we know: Push data payload supports arbitrary JSON. Existing patterns use `{ type, requestId }`.
   - What's unclear: What screen the mobile app should navigate to when the user taps a comment notification. `PostDetailScreen` is the natural target but needs `postId` in the payload.
   - Recommendation: Use `{ type: 'post_comment', postId: String(post._id) }` and add a navigation handler in the notification listener (same pattern as `stay_request` deep link from phase 2 plan 02-03).

3. **Review aggregation entry point from mobile UI**
   - What we know: Reviews appear on ProfileScreen (REVW-01/02/03). `ReviewComposeScreen` is entered from a deep link or from `ReviewEligibleBanner`.
   - What's unclear: Where the mobile surface shows pending review prompts — the UI-SPEC mentions `ReviewEligibleBanner` on the profile and on conversations, but the conversations list is a phase 2 screen.
   - Recommendation: Surface `ReviewEligibleBanner` on the Profile screen only for MVP (avoids touching ConversationListScreen). The planner can extend to conversations in a separate task.

---

## Sources

### Primary (HIGH confidence)
- `backend/src/models/Report.js` [VERIFIED: direct read] — existing schema; enum extension plan
- `backend/src/models/StayRequest.js` [VERIFIED: direct read] — checkOut field shape; review eligibility anchor
- `backend/src/models/User.js` [VERIFIED: direct read] — aggregation target; no avgRating field today
- `backend/src/services/storageService.js` [VERIFIED: direct read] — `uploadFile()` signature; reuse plan
- `backend/src/services/notificationService.js` [VERIFIED: direct read] — `sendPushNotification()` pattern
- `backend/src/middleware/auth.js` [VERIFIED: direct read] — `verifyFirebaseToken + requireVerified` pattern
- `backend/src/controllers/requestController.js` [VERIFIED: direct read] — address-hiding discipline (model for blind-release gate)
- `backend/src/routes/listings.js` [VERIFIED: direct read] — multer.single vs .array pattern
- `backend/package.json` [VERIFIED: direct read] — exact versions of all backend dependencies
- `mobile/package.json` [VERIFIED: direct read] — expo-image-picker ~57.0.2 already installed; zustand 5.0.14
- `mobile/src/services/api.ts` [VERIFIED: direct read] — cursor pagination `before` param pattern (getConversationMessages)
- `mobile/src/store/listingStore.ts` [VERIFIED: direct read] — Zustand store shape for feedStore

### Secondary (MEDIUM confidence)
- CONTEXT.md locked decisions — prescribe blind-release predicate, immutability, cursor pagination choice
- STATE.md decisions — "separate collection" lesson from messages (16MB limit) applies to comments
- WebSearch: FlatList cursor pagination + RefreshControl pattern [MEDIUM — community articles 2024-2026, consistent with existing codebase usage]
- WebSearch: MongoDB polymorphic `targetType`/`targetId` pattern [MEDIUM — consistent with existing Report model shape]

### Tertiary (LOW confidence)
- npm view multer/expo-server-sdk versions — confirms existing package versions; no new installs needed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json; no new installs
- Architecture: HIGH — all patterns derived from verified phase 1–2 code
- Blind-release gate: HIGH — logic prescribed verbatim by CONTEXT.md locked decisions; code is illustrative
- Pitfalls: HIGH — most derived from existing codebase decisions (16MB lesson, address-hiding discipline, token pattern)
- expo-image-picker API shape: MEDIUM — version-specific; must verify at docs.expo.dev/versions/v57.0.0/

**Research date:** 2026-07-09
**Valid until:** 2026-08-09 (stable stack; expo-image-picker API shape may need re-verification against v57 docs before coding)
