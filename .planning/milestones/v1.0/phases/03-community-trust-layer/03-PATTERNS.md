# Phase 03: Community & Trust Layer — Pattern Map

**Mapped:** 2026-07-09
**Files analyzed:** 20 (backend models, controllers, routes + mobile stores, screens, components, api.ts)
**Analogs found:** 19 / 20

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/src/models/Post.js` | model | CRUD | `backend/src/models/StayRequest.js` | role-match |
| `backend/src/models/Comment.js` | model | CRUD | `backend/src/models/StayRequest.js` | role-match |
| `backend/src/models/Review.js` | model | CRUD | `backend/src/models/StayRequest.js` | role-match |
| `backend/src/models/Report.js` | model (modify) | CRUD | `backend/src/models/Report.js` | exact |
| `backend/src/models/User.js` | model (modify) | CRUD | `backend/src/models/User.js` | exact |
| `backend/src/controllers/postController.js` | controller | CRUD + file-I/O | `backend/src/controllers/listingController.js` | exact |
| `backend/src/controllers/commentController.js` | controller | CRUD | `backend/src/controllers/requestController.js` | role-match |
| `backend/src/controllers/reviewController.js` | controller | request-response | `backend/src/controllers/requestController.js` | exact |
| `backend/src/routes/posts.js` | route | request-response | `backend/src/routes/listings.js` | exact |
| `backend/src/routes/comments.js` | route | request-response | `backend/src/routes/listings.js` | role-match |
| `backend/src/routes/reviews.js` | route | request-response | `backend/src/routes/listings.js` | role-match |
| `mobile/src/store/feedStore.ts` | store | CRUD | `mobile/src/store/listingStore.ts` | exact |
| `mobile/src/store/reviewStore.ts` | store | CRUD | `mobile/src/store/profileStore.ts` | role-match |
| `mobile/src/services/api.ts` | service (modify) | request-response | `mobile/src/services/api.ts` | exact |
| `mobile/src/screens/Community/CommunityFeedScreen.tsx` | screen | CRUD | `mobile/src/screens/Messages/DirectMessageScreen.tsx` | role-match |
| `mobile/src/screens/Community/CreatePostScreen.tsx` | screen | file-I/O | `mobile/src/screens/Housing/CreateListingScreen.tsx` | exact |
| `mobile/src/screens/Community/PostDetailScreen.tsx` | screen | CRUD | `mobile/src/screens/Profile/ProfileScreen.tsx` | role-match |
| `mobile/src/screens/Reviews/ReviewComposeScreen.tsx` | screen | CRUD | `mobile/src/screens/Requests/StayRequestComposeScreen.tsx` | role-match |
| `mobile/src/components/Community/PostCard.tsx` | component | transform | `mobile/src/components/Chat/MessageBubble.tsx` (phase-2) | partial |
| `mobile/src/components/Reviews/StarRatingInput.tsx` | component | transform | no analog | none |

---

## Pattern Assignments

### `backend/src/models/Post.js` (model, CRUD)

**Analog:** `backend/src/models/StayRequest.js`

**Imports + schema structure** (StayRequest.js lines 1–40):
```javascript
const { Schema, model } = require('mongoose');

const stayRequestSchema = new Schema(
  {
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
  },
  { timestamps: true }   // adds createdAt + updatedAt
);

module.exports = model('StayRequest', stayRequestSchema);
```

**Apply to Post.js:**
```javascript
// backend/src/models/Post.js
const { Schema, model } = require('mongoose');

const postSchema = new Schema({
  authorUid:    { type: String, required: true, index: true },
  text:         { type: String, required: true, maxlength: 1000 },
  photoUrl:     { type: String, default: null },
  likedBy:      [{ type: String }],          // array of Firebase UIDs
  likeCount:    { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
}, { timestamps: true });

postSchema.index({ createdAt: -1, _id: -1 }); // compound cursor for feed pagination
postSchema.index({ authorUid: 1 });

module.exports = model('Post', postSchema);
```

---

### `backend/src/models/Comment.js` (model, CRUD)

**Analog:** `backend/src/models/StayRequest.js` (same schema pattern)

```javascript
// backend/src/models/Comment.js
const { Schema, model } = require('mongoose');

const commentSchema = new Schema({
  postId:    { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  authorUid: { type: String, required: true },
  text:      { type: String, required: true, maxlength: 500 },
}, { timestamps: true });

module.exports = model('Comment', commentSchema);
```

---

### `backend/src/models/Review.js` (model, CRUD)

**Analog:** `backend/src/models/StayRequest.js`

```javascript
// backend/src/models/Review.js
const { Schema, model } = require('mongoose');

const reviewSchema = new Schema({
  stayRequestId: { type: Schema.Types.ObjectId, ref: 'StayRequest', required: true, index: true },
  reviewerUid:   { type: String, required: true },
  subjectUid:    { type: String, required: true, index: true },
  direction:     { type: String, enum: ['guest_to_host', 'host_to_guest'], required: true },
  rating:        { type: Number, min: 1, max: 5, required: true },
  text:          { type: String, required: true, minlength: 20, maxlength: 2000 },
  submittedAt:   { type: Date, default: Date.now },
}, { timestamps: true });

// CRITICAL: one review per direction per stay
reviewSchema.index({ stayRequestId: 1, direction: 1 }, { unique: true });
reviewSchema.index({ subjectUid: 1, submittedAt: -1 });

module.exports = model('Review', reviewSchema);
```

---

### `backend/src/models/Report.js` (model, MODIFY only)

**Analog:** `backend/src/models/Report.js` (lines 1–28 — exact file)

**Current contentType enum** (Report.js line 20):
```javascript
contentType:  { type: String, enum: ['listing', 'message', 'user'] },
```

**Change only this one line — add 'post' and 'comment':**
```javascript
contentType:  { type: String, enum: ['listing', 'message', 'user', 'post', 'comment'] },
```

No other changes. `contentId` (String) already accepts ObjectId hex strings. `reportedUid` stays optional.

---

### `backend/src/models/User.js` (model, MODIFY — add two fields)

**Analog:** `backend/src/models/User.js` (existing schema)

**Add two fields for review aggregation:**
```javascript
// Add to userSchema in backend/src/models/User.js:
avgRating:   { type: Number, default: null },   // null until first revealed review
reviewCount: { type: Number, default: 0 },      // count of revealed reviews only
```

---

### `backend/src/controllers/postController.js` (controller, CRUD + file-I/O)

**Analog:** `backend/src/controllers/listingController.js`

**Imports pattern** (listingController.js lines 1–3):
```javascript
const Listing = require('../models/Listing');
const StayRequest = require('../models/StayRequest');
const { uploadFile, getSignedUrl } = require('../services/storageService');
```

**Apply — postController.js imports:**
```javascript
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const mongoose = require('mongoose');
const { uploadFile } = require('../services/storageService');
const { sendPushNotification } = require('../services/notificationService');
```

**uid from token — never from body** (listingController.js line 25, requestController.js line 21):
```javascript
// listingController.js line 25
const { uid } = req.user;
// requestController.js line 21
const guestUid = req.user.uid; // T-02-03-04: always from token, never body
```

**Photo upload pipeline** (listingController.js lines 119–134):
```javascript
// Pattern: create doc first to get _id for storage path, then upload, then save path
const listing = await Listing.create({ ownerUid: uid, ... }); // get _id

const files = req.files || [];
for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const storagePath = `listings/${listing._id}/photos/${i}`;
  await uploadFile(storagePath, file.buffer, file.mimetype);
  photoPaths.push(storagePath);
}

if (photoPaths.length > 0) {
  listing.photos = photoPaths;
  await listing.save();
}

res.status(201).json({ data: { id: listing._id } });
```

**Apply to createPost — single optional photo:**
```javascript
async function createPost(req, res) {
  try {
    const { uid } = req.user;  // never from body
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required' });
    }

    // Create post doc first to get _id for storage path
    const post = await Post.create({ authorUid: uid, text: text.trim() });

    // Optional single photo upload
    if (req.file) {
      const storagePath = `posts/${uid}/${post._id}/photo`;
      await uploadFile(storagePath, req.file.buffer, req.file.mimetype);
      post.photoUrl = storagePath; // or public URL — see storageService note below
      await post.save();
    }

    res.status(201).json({ data: { id: post._id } });
  } catch (err) {
    console.error('[createPost]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

**Cursor pagination for getFeed** — pattern from `mobile/src/services/api.ts` getConversationMessages `?before=` and phase-2 backend (compound cursor):
```javascript
async function getFeed(req, res) {
  try {
    const PAGE_SIZE = 20;
    let filter = {};

    if (req.query.before) {
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

**Like toggle — pre-check pattern** (prevents counter drift, see RESEARCH.md Pitfall 1):
```javascript
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
      .select('likeCount likedBy').lean();

    return res.json({ data: { likeCount: updated.likeCount, liked: !alreadyLiked } });
  } catch (err) {
    console.error('[toggleLike]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

**Error handling pattern** (requestController.js lines 82–85, listingController.js lines 137–139):
```javascript
} catch (err) {
  console.error('[functionName]', err);
  res.status(500).json({ error: 'Internal server error' });
}
```

---

### `backend/src/controllers/commentController.js` (controller, CRUD)

**Analog:** `backend/src/controllers/requestController.js`

**Imports:**
```javascript
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const User = require('../models/User');
const { sendPushNotification } = require('../services/notificationService');
```

**createComment with push notification** — mirrors `requestController.js` createRequest push pattern (lines 73–79):
```javascript
async function createComment(req, res) {
  try {
    const { uid } = req.user;
    const { text } = req.body;
    const { id: postId } = req.params;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required' });
    }

    const post = await Post.findById(postId).select('authorUid commentCount').lean();
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const comment = await Comment.create({ postId, authorUid: uid, text: text.trim() });
    await Post.findByIdAndUpdate(postId, { $inc: { commentCount: 1 } });

    // Fire-and-forget push notification to post author (no-op if no token)
    if (post.authorUid !== uid) {
      const author = await User.findOne({ firebaseUid: post.authorUid });
      await sendPushNotification(
        author?.expoPushToken,
        'New comment on your post',
        text.trim().substring(0, 80),
        { type: 'post_comment', postId: String(postId) }
      );
    }

    return res.status(201).json({ data: { id: comment._id } });
  } catch (err) {
    console.error('[createComment]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

**getComments** — mirrors getHostInbox pattern (requestController.js lines 97–111):
```javascript
async function getComments(req, res) {
  try {
    const comments = await Comment.find({ postId: req.params.id })
      .sort({ createdAt: 1 })
      .select('authorUid text createdAt')
      .lean();
    return res.json({ data: comments });
  } catch (err) {
    console.error('[getComments]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

---

### `backend/src/controllers/reviewController.js` (controller, request-response)

**Analog:** `backend/src/controllers/requestController.js` (eligibility + participant check pattern)

**createReview — eligibility check mirrors requestController date + ownership validation** (lines 19–85):
```javascript
async function createReview(req, res) {
  try {
    const callerUid = req.user.uid;  // NEVER from body
    const { stayRequestId, rating, text } = req.body;

    const stay = await StayRequest.findById(stayRequestId)
      .select('guestUid hostUid checkOut status').lean();
    if (!stay) return res.status(404).json({ error: 'Stay not found' });

    const isGuest = callerUid === stay.guestUid;
    const isHost  = callerUid === stay.hostUid;
    if (!isGuest && !isHost) return res.status(403).json({ error: 'Not a participant of this stay' });

    if (stay.status !== 'accepted') return res.status(422).json({ error: 'Stay was not accepted' });
    if (new Date() < stay.checkOut)  return res.status(422).json({ error: 'Stay has not ended yet' });

    const direction = isGuest ? 'guest_to_host' : 'host_to_guest';
    const subjectUid = isGuest ? stay.hostUid : stay.guestUid;

    const existing = await Review.findOne({ stayRequestId, direction });
    if (existing) return res.status(409).json({ error: 'Review already submitted' });

    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be 1–5' });
    if (!text || text.trim().length < 20) return res.status(400).json({ error: 'text must be at least 20 characters' });

    const review = await Review.create({
      stayRequestId, reviewerUid: callerUid, subjectUid, direction,
      rating: Number(rating), text: text.trim(),
    });
    return res.status(201).json({ data: { id: review._id } });
  } catch (err) {
    console.error('[createReview]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

**getStayReviews — blind-release gate** — mirrors address-hiding discipline from `listingController.js` searchListings (explicit `.select()`, never spread raw doc):
```javascript
async function getStayReviews(req, res) {
  try {
    const callerUid = req.user.uid;
    const { stayRequestId } = req.params;

    const stay = await StayRequest.findById(stayRequestId)
      .select('guestUid hostUid checkOut status').lean();
    if (!stay) return res.status(404).json({ error: 'Stay not found' });

    if (callerUid !== stay.guestUid && callerUid !== stay.hostUid) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const now = new Date();
    if (stay.status !== 'accepted' || stay.checkOut > now) {
      return res.json({ state: 'not_eligible', ownReview: null, counterpartReview: null });
    }

    const callerDirection = callerUid === stay.guestUid ? 'guest_to_host' : 'host_to_guest';
    const counterpartDirection = callerDirection === 'guest_to_host' ? 'host_to_guest' : 'guest_to_host';

    const [ownReview, counterpartReview] = await Promise.all([
      Review.findOne({ stayRequestId, direction: callerDirection })
        .select('rating text submittedAt').lean(),
      Review.findOne({ stayRequestId, direction: counterpartDirection })
        .select('rating text submittedAt').lean(),
    ]);

    // BLIND-RELEASE PREDICATE — computed at read time, never delegated to client
    const revealDeadline = new Date(stay.checkOut.getTime() + 14 * 24 * 60 * 60 * 1000);
    const bothSubmitted = !!(ownReview && counterpartReview);
    const revealed = bothSubmitted || (now >= revealDeadline);

    const state = revealed ? 'revealed' : (ownReview ? 'waiting' : 'eligible');

    // EXPLICIT PROJECTION GATE: strip counterpart text before reveal
    // Same discipline as exactAddress hiding in listingController (T-02-02-01)
    const safeCounterpart = (revealed && counterpartReview)
      ? { rating: counterpartReview.rating, text: counterpartReview.text, submittedAt: counterpartReview.submittedAt }
      : null;  // field ABSENT from response when not revealed — never null-but-present with text

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

---

### `backend/src/routes/posts.js` (route, request-response)

**Analog:** `backend/src/routes/listings.js` (lines 1–50 — exact same multer + middleware pattern)

**Imports + multer config** (listings.js lines 1–16):
```javascript
const router = require('express').Router();
const multer = require('multer');
const { verifyFirebaseToken, requireVerified } = require('../middleware/auth');
const listingController = require('../controllers/listingController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
}).array('photos', 10);
```

**Apply to posts.js — single file, field name 'photo':**
```javascript
const router = require('express').Router();
const multer = require('multer');
const { verifyFirebaseToken, requireVerified } = require('../middleware/auth');
const postController = require('../controllers/postController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('photo');  // single file — field name 'photo'

router.post('/', verifyFirebaseToken, requireVerified, upload, postController.createPost);
router.get('/', verifyFirebaseToken, requireVerified, postController.getFeed);
router.post('/:id/like', verifyFirebaseToken, requireVerified, postController.toggleLike);
router.delete('/:id', verifyFirebaseToken, requireVerified, postController.deletePost);

module.exports = router;
```

**Route ordering rule** (listings.js comment before line 28 — static routes before dynamic):
```javascript
// Declare GET /search BEFORE /:id to prevent dynamic segment from shadowing
```
Apply: declare `GET /` before `GET /:id` similarly.

---

### `backend/src/routes/comments.js` (route, request-response)

**Analog:** `backend/src/routes/listings.js`

```javascript
const router = require('express').Router({ mergeParams: true }); // mergeParams to access :id from parent
const { verifyFirebaseToken, requireVerified } = require('../middleware/auth');
const commentController = require('../controllers/commentController');

router.post('/', verifyFirebaseToken, requireVerified, commentController.createComment);
router.get('/', verifyFirebaseToken, requireVerified, commentController.getComments);

module.exports = router;
```

Wire in server.js / main router as: `app.use('/api/posts/:id/comments', commentsRouter)`.

---

### `backend/src/routes/reviews.js` (route, request-response)

**Analog:** `backend/src/routes/listings.js`

```javascript
const router = require('express').Router();
const { verifyFirebaseToken, requireVerified } = require('../middleware/auth');
const reviewController = require('../controllers/reviewController');

router.post('/', verifyFirebaseToken, requireVerified, reviewController.createReview);
router.get('/:stayRequestId', verifyFirebaseToken, requireVerified, reviewController.getStayReviews);
router.get('/user/:uid', verifyFirebaseToken, requireVerified, reviewController.getUserReviews);

module.exports = router;
```

---

### `mobile/src/store/feedStore.ts` (store, CRUD)

**Analog:** `mobile/src/store/listingStore.ts` (lines 1–24 — full file)

**Full listingStore pattern:**
```typescript
import { create } from 'zustand';
import type { Listing } from '../types/listing';

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

**Apply to feedStore.ts — adds cursor pagination state:**
```typescript
import { create } from 'zustand';
import type { Post } from '../types/community';

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

### `mobile/src/store/reviewStore.ts` (store, CRUD)

**Analog:** `mobile/src/store/profileStore.ts` (lines 1–34 — full file)

```typescript
// profileStore.ts pattern:
export const useProfileStore = create<ProfileState>()((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
  clear: () => set({ profile: null }),
}));
```

**Apply to reviewStore.ts:**
```typescript
import { create } from 'zustand';
import type { ReviewState as ReviewStateData } from '../types/community';

interface ReviewStoreState {
  // keyed by stayRequestId
  reviewStates: Record<string, ReviewStateData>;
  setReviewState: (stayRequestId: string, state: ReviewStateData) => void;
  clear: () => void;
}

export const useReviewStore = create<ReviewStoreState>()((set) => ({
  reviewStates: {},
  setReviewState: (stayRequestId, state) =>
    set((s) => ({ reviewStates: { ...s.reviewStates, [stayRequestId]: state } })),
  clear: () => set({ reviewStates: {} }),
}));
```

---

### `mobile/src/services/api.ts` (service, MODIFY — append new functions)

**Analog:** `mobile/src/services/api.ts` itself — append following existing patterns.

**JSON GET with cursor** — mirror getConversationMessages (api.ts lines 397–410):
```typescript
export async function getConversationMessages(
  conversationId: string,
  before?: string
): Promise<{ data?: unknown[]; nextBefore?: string | null; error?: string }> {
  const headers = await authHeaders();
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  const query = params.toString() ? `?${params}` : '';
  const res = await fetch(
    `${API_BASE_URL}/api/conversations/${conversationId}/messages${query}`,
    { headers }
  );
  return res.json();
}
```

**Apply to getFeed:**
```typescript
export async function getFeed(before?: string): Promise<{ data?: Post[]; nextCursor?: string | null; hasMore?: boolean; error?: string }> {
  const headers = await authHeaders();
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  const query = params.toString() ? `?${params}` : '';
  const res = await fetch(`${API_BASE_URL}/api/posts${query}`, { headers });
  return res.json();
}
```

**Multipart upload** — mirror uploadProfilePhoto (api.ts lines 102–113):
```typescript
export async function uploadProfilePhoto(uri: string): Promise<unknown> {
  const token = await auth.currentUser?.getIdToken();
  const formData = new FormData();
  formData.append('photo', { uri, type: 'image/jpeg', name: 'photo.jpg' } as unknown as Blob);
  const res = await fetch(`${API_BASE_URL}/api/users/profile-photo`, {
    method: 'POST',
    // Authorization only — no Content-Type; let FormData set the boundary (Pitfall 5)
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return res.json();
}
```

**Apply to createPost (photo optional):**
```typescript
export async function createPost(text: string, photoUri?: string): Promise<{ data?: { id: string }; error?: string }> {
  const token = await auth.currentUser?.getIdToken();
  const formData = new FormData();
  formData.append('text', text);
  if (photoUri) {
    formData.append('photo', { uri: photoUri, type: 'image/jpeg', name: 'photo.jpg' } as unknown as Blob);
  }
  const res = await fetch(`${API_BASE_URL}/api/posts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },  // NO Content-Type — let FormData set boundary
    body: formData,
  });
  return res.json();
}
```

**Simple JSON POST** — mirror createStayRequest (api.ts lines 270–280):
```typescript
// Pattern: authHeaders() + JSON.stringify body
export async function createStayRequest(payload: CreateStayRequestPayload) {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return res.json();
}
```

Apply for `createReview`, `createComment`, `toggleLike` — all follow the same JSON POST shape.

---

### `mobile/src/screens/Community/CommunityFeedScreen.tsx` (screen, CRUD)

**Analog:** `mobile/src/screens/Messages/DirectMessageScreen.tsx` — FlatList + pagination + load state

**Import + state shape** (DirectMessageScreen.tsx lines 1–62):
```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
// ...store imports...
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

**Apply to CommunityFeedScreen.tsx:**
```typescript
import { useCallback, useEffect, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFeedStore } from '../../store/feedStore';
import { getFeed } from '../../services/api';
import PostCard from '../../components/Community/PostCard';
import type { CommunityStackParamList } from '../../navigation/AppNavigator';

// Load-on-mount + pull-to-refresh + infinite scroll with nextCursor
// FlatList onEndReached → appendPosts if hasMore && !isLoading
```

**useEffect fetch pattern** (ProfileScreen.tsx lines 38–57):
```typescript
useEffect(() => {
  loadProfile();
}, []);

async function loadProfile() {
  setLoading(true);
  setError(null);
  try {
    const res = await getMyProfile() as { data?: typeof profile; error?: string };
    if (res.data) setProfile(res.data);
    else if (res.error) setError(res.error);
  } catch {
    setError('Failed to load profile. Please try again.');
  } finally {
    setLoading(false);
  }
}
```

---

### `mobile/src/screens/Community/CreatePostScreen.tsx` (screen, file-I/O)

**Analog:** `mobile/src/screens/Housing/CreateListingScreen.tsx`

**State + image picker + submit pattern** (CreateListingScreen.tsx lines 40–115):
```typescript
const [title, setTitle] = useState('');
const [photoUris, setPhotoUris] = useState<string[]>([]);
const [publishing, setPublishing] = useState(false);

const isValid = title.trim().length > 0 && ...;

async function handlePublish() {
  if (!isValid) return;
  setPublishing(true);
  try {
    const result = await createListing({ ... });
    if (result.data?.id) { navigation.navigate('MapDiscovery'); }
    else { Alert.alert('Error', result.error ?? 'Failed to publish'); }
  } catch { Alert.alert('Error', 'Network error'); }
  finally { setPublishing(false); }
}
```

**Apply to CreatePostScreen.tsx:**
```typescript
const [text, setText] = useState('');
const [photoUri, setPhotoUri] = useState<string | null>(null);
const [submitting, setSubmitting] = useState(false);

const isValid = text.trim().length > 0;

async function handleSubmit() {
  if (!isValid) return;
  setSubmitting(true);
  try {
    const result = await createPost(text.trim(), photoUri ?? undefined);
    if (result.data?.id) navigation.goBack();
    else Alert.alert('Error', result.error ?? 'Failed to post');
  } catch { Alert.alert('Error', 'Network error'); }
  finally { setSubmitting(false); }
}
```

---

### `mobile/src/screens/Community/PostDetailScreen.tsx` (screen, CRUD)

**Analog:** `mobile/src/screens/Profile/ProfileScreen.tsx`

**Load-on-mount pattern** (ProfileScreen.tsx lines 32–57). Apply identical shape for loading post + comments on mount.

---

### `mobile/src/screens/Reviews/ReviewComposeScreen.tsx` (screen, CRUD)

**Analog:** `mobile/src/screens/Requests/StayRequestComposeScreen.tsx` (form submit + validation + navigation)

Pattern: controlled TextInput + state validation + submit → API call → navigate or Alert on error. Same shape as CreatePost above.

---

## Shared Patterns

### Authentication + Verification Guard

**Source:** `backend/src/middleware/auth.js` (lines 1–29)
**Apply to:** ALL new backend route files (posts.js, comments.js, reviews.js)

```javascript
const { verifyFirebaseToken, requireVerified } = require('../middleware/auth');

// Both middleware applied in order on every feed/review route:
router.post('/', verifyFirebaseToken, requireVerified, controller.handler);
```

`verifyFirebaseToken` sets `req.user = { uid, email, isVerified }`.
`requireVerified` returns 403 if `!req.user?.isVerified`.
**Never** read uid from `req.body` — always `req.user.uid`.

---

### Error Handling (backend controllers)

**Source:** `backend/src/controllers/requestController.js` lines 82–85; `backend/src/controllers/listingController.js` lines 137–139
**Apply to:** All new controllers (postController, commentController, reviewController)

```javascript
} catch (err) {
  console.error('[functionName]', err);
  res.status(500).json({ error: 'Internal server error' });
}
```

Pattern: named tag in brackets, same error object logged, always `{ error: '...' }` shape.

---

### Push Notification (fire-and-forget)

**Source:** `backend/src/services/notificationService.js` (lines 1–19); called in requestController.js lines 73–79
**Apply to:** `commentController.createComment` (notify post author)

```javascript
const { sendPushNotification } = require('../services/notificationService');

// Fire-and-forget — do NOT await in the request path if latency matters
await sendPushNotification(
  user?.expoPushToken,       // silently no-ops if null/invalid
  'Title',
  'Body text',
  { type: 'post_comment', postId: String(post._id) }
);
```

Data payload shape: `{ type: string, postId: string }` — mirrors `{ type: 'stay_request', requestId }` convention.

---

### Firebase Storage Upload

**Source:** `backend/src/services/storageService.js` (lines 56–62); used in listingController.js lines 119–134
**Apply to:** `postController.createPost` (optional photo)

```javascript
const { uploadFile } = require('../services/storageService');

// uploadFile(storagePath, buffer, mimetype)
// buffer = req.file.buffer  (multer memoryStorage)
// mimetype = req.file.mimetype
const storagePath = `posts/${uid}/${post._id}/photo`;
await uploadFile(storagePath, req.file.buffer, req.file.mimetype);
```

`uploadFile` uses `resumable: false` — required for small in-memory buffers.
Check `listingController.js` `createListing` response to confirm whether `photoUrl` should be a public URL (`https://storage.googleapis.com/${BUCKET}/${path}`) or a signed URL — match whatever listings use.

---

### Mobile API Function Shape

**Source:** `mobile/src/services/api.ts` lines 7–13 (authHeaders), lines 270–280 (JSON POST), lines 102–113 (FormData POST)
**Apply to:** All new api.ts functions

```typescript
// JSON POST (reviews, likes, comments)
async function authHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// FormData POST (createPost with photo) — do NOT set Content-Type manually
const token = await auth.currentUser?.getIdToken();
// headers: { Authorization: `Bearer ${token}` }  // only — no Content-Type
```

---

### Zustand Store Shape

**Source:** `mobile/src/store/listingStore.ts` (lines 1–24); `mobile/src/store/profileStore.ts` (lines 1–34)
**Apply to:** feedStore.ts, reviewStore.ts

```typescript
import { create } from 'zustand';

export const useXxxStore = create<XxxState>()((set) => ({
  // initial state
  clear: () => set({ /* reset */ }),
}));
```

Naming: `useXxxStore`. Export default is the hook. Always include `clear()` for sign-out.

---

### Screen Load Pattern (mobile)

**Source:** `mobile/src/screens/Profile/ProfileScreen.tsx` lines 32–57
**Apply to:** CommunityFeedScreen, PostDetailScreen, ReviewComposeScreen

```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

useEffect(() => { loadData(); }, []);

async function loadData() {
  setLoading(true);
  setError(null);
  try {
    const res = await apiCall() as { data?: ...; error?: string };
    if (res.data) setLocalState(res.data);
    else if (res.error) setError(res.error);
  } catch {
    setError('Failed to load. Please try again.');
  } finally {
    setLoading(false);
  }
}
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `mobile/src/components/Reviews/StarRatingInput.tsx` | component | transform | No star-rating UI component exists in codebase; derive from Expo `@expo/vector-icons` (AntDesign `star` icon) following existing icon usage in other components |

---

## Metadata

**Analog search scope:** `backend/src/` (controllers, models, routes, services, middleware), `mobile/src/` (screens, store, services, components)
**Files scanned:** 22 source files read directly
**Key verified source files:**
- `/home/kartsi/PycharmProjects/women-app/backend/src/controllers/requestController.js`
- `/home/kartsi/PycharmProjects/women-app/backend/src/controllers/listingController.js`
- `/home/kartsi/PycharmProjects/women-app/backend/src/models/Report.js`
- `/home/kartsi/PycharmProjects/women-app/backend/src/models/StayRequest.js`
- `/home/kartsi/PycharmProjects/women-app/backend/src/routes/listings.js`
- `/home/kartsi/PycharmProjects/women-app/backend/src/middleware/auth.js`
- `/home/kartsi/PycharmProjects/women-app/backend/src/services/storageService.js`
- `/home/kartsi/PycharmProjects/women-app/backend/src/services/notificationService.js`
- `/home/kartsi/PycharmProjects/women-app/mobile/src/services/api.ts`
- `/home/kartsi/PycharmProjects/women-app/mobile/src/store/listingStore.ts`
- `/home/kartsi/PycharmProjects/women-app/mobile/src/store/profileStore.ts`
- `/home/kartsi/PycharmProjects/women-app/mobile/src/screens/Housing/CreateListingScreen.tsx`
- `/home/kartsi/PycharmProjects/women-app/mobile/src/screens/Profile/ProfileScreen.tsx`
- `/home/kartsi/PycharmProjects/women-app/mobile/src/screens/Messages/DirectMessageScreen.tsx`
**Pattern extraction date:** 2026-07-09
