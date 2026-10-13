---
phase: 03-community-trust-layer
plan: "01"
subsystem: community-feed
status: complete
tags: [community, feed, post, pagination, firebase-storage, signed-url, zustand, expo-image-picker]
completed: "2026-07-10"
duration: "5 min"
tasks_completed: 2
files_changed: 13

dependency_graph:
  requires:
    - 02-01  # verifyFirebaseToken + requireVerified middleware
    - 02-02  # storageService.uploadFile + getSignedUrl (listing photo pipeline)
  provides:
    - Post model with compound cursor index
    - /api/posts REST endpoints (createPost, getFeed) with signed-URL photo serving
    - feedStore + community types + api.ts feed functions
    - CommunityFeedScreen + CreatePostScreen + PostCard + PostPhotoAttachment
    - Community tab in AppNavigator
  affects:
    - 03-02  # toggleLike + deletePost extend the Post model created here
    - 03-03  # comment UI extends PostDetailScreen (CommunityStackParamList)

tech_stack:
  added: []
  patterns:
    - Cursor pagination via base64 JSON {createdAt, _id} cursor (same as DM messages)
    - Firebase Storage path stored; signed URL generated at read time (same as listing photos)
    - authorUid always from req.user.uid (never body) — T-03-01-01 mitigation
    - Zustand store with setPosts/appendPosts/clear pattern (mirrors listingStore)
    - FormData POST without manual Content-Type (FormData sets multipart boundary — Pitfall 5)
    - expo-image-picker v57 MediaType string literal 'images' (enum removed in v57)

key_files:
  created:
    - backend/src/models/Post.js
    - backend/src/controllers/postController.js
    - backend/src/routes/posts.js
    - backend/test/post.feed.test.js
    - mobile/src/types/community.ts
    - mobile/src/store/feedStore.ts
    - mobile/src/components/Community/PostCard.tsx
    - mobile/src/components/Community/PostPhotoAttachment.tsx
    - mobile/src/screens/Community/CommunityFeedScreen.tsx
    - mobile/src/screens/Community/CreatePostScreen.tsx
  modified:
    - backend/src/server.js  # mounts postsRouter at /api/posts
    - mobile/src/services/api.ts  # added getFeed(), createPost()
    - mobile/src/navigation/AppNavigator.tsx  # added CommunityStackParamList + Community tab

decisions:
  - authorUid in createPost always from req.user.uid — proven by held-out test assertion (d)
  - photoUrl stored as Firebase Storage path; getSignedUrl called at getFeed read time (T-03-01-03)
  - expo-image-picker v57 uses string MediaType ('images') not MediaTypeOptions enum — fixed deviation
  - PAGE_SIZE = 20; cursor is base64(JSON{createdAt,_id}); compound index {createdAt:-1,_id:-1}
  - Community tab inserted between Messages and ProfileTab in bottom tab navigator

metrics:
  duration: "5 min"
  completed: "2026-07-10"
  tasks: 2
  files: 13
---

# Phase 03 Plan 01: Community Feed Create+Read Summary

**One-liner:** Cursor-paginated community feed (POST + GET /api/posts) with Firebase Storage signed-URL photo serving, Zustand feedStore, and Community tab (FlatList + FAB + CreatePost) — authorUid integrity proven by held-out test.

## What Was Built

### Backend

**Post model** (`backend/src/models/Post.js`): Mongoose schema with `authorUid` (String, required, index), `text` (String, required, maxlength 1000), `photoUrl` (String — stores Firebase Storage PATH, not a URL), `likedBy` ([String]), `likeCount` (Number), `commentCount` (Number), `timestamps: true`. Compound cursor index `{createdAt: -1, _id: -1}` for feed pagination.

**postController** (`backend/src/controllers/postController.js`):
- `createPost`: reads `uid` from `req.user.uid` (T-03-01-01 — never from body); validates text (400 if empty/missing); creates Post doc to get `_id`; if `req.file` present, uploads buffer via `storageService.uploadFile` to `posts/<uid>/<post._id>/photo` and stores the path in `post.photoUrl`; responds 201 `{ data: { id } }`.
- `getFeed`: PAGE_SIZE=20; decodes base64 cursor into `{createdAt, _id}` and builds `$or` filter; queries with compound sort; fetches PAGE_SIZE+1; resolves each non-null photoUrl to a signed URL via `storageService.getSignedUrl` (T-03-01-03); encodes `nextCursor`; responds `{ data, nextCursor, hasMore }`.

**posts route** (`backend/src/routes/posts.js`): `multer.memoryStorage().single('photo')` with 5MB limit (T-03-01-04); both routes gated by `verifyFirebaseToken + requireVerified` (T-03-01-02); `GET /` declared before any future dynamic `/:id` route.

**server.js**: `postsRouter` mounted at `/api/posts`.

**held-out test** (`backend/test/post.feed.test.js`): 4 assertions — (a) 20-item page + hasMore=true when 21 docs; (b) nextCursor decodes to JSON with correct 20th doc fields; (c) second call with cursor produces `$or` filter; (d) `createPost` with spoofed `req.body.authorUid` still creates with `req.user.uid`. All 14 backend tests pass.

### Mobile

**Types** (`mobile/src/types/community.ts`): `Post` interface with all fields.

**feedStore** (`mobile/src/store/feedStore.ts`): Zustand store — `posts[]`, `nextCursor`, `hasMore`, `isLoading`; actions `setPosts`, `appendPosts`, `setIsLoading`, `clear`.

**api.ts additions**: `getFeed(before?)` — GET with optional `?before=` cursor; `createPost(text, photoUri?)` — FormData POST, `Authorization`-only header (no `Content-Type` — FormData sets multipart boundary, Pitfall 5).

**PostPhotoAttachment** (`mobile/src/components/Community/PostPhotoAttachment.tsx`): expo-image-picker v57; `requestMediaLibraryPermissionsAsync` before launch; 160×160dp preview tile; accessible remove button (`accessibilityLabel='Remove photo'`); 'Add photo' tap target when empty.

**PostCard** (`mobile/src/components/Community/PostCard.tsx`): author avatar + UID + timestamp; text (3 lines max); optional 200dp photo; like/comment counts; report icon (44×44dp touch target); `onPress` prop.

**CommunityFeedScreen** (`mobile/src/screens/Community/CommunityFeedScreen.tsx`): load first page on mount; FlatList; RefreshControl (accent); `onEndReached` → `appendPosts`; end-of-feed footer; empty state; error state; FAB 56×56dp accent → CreatePost.

**CreatePostScreen** (`mobile/src/screens/Community/CreatePostScreen.tsx`): multiline TextInput autofocus; character count >800; PostPhotoAttachment; accent 'Post' CTA (muted+disabled when empty); 'Posting…' at opacity 0.6; `navigation.goBack()` on success; Alert on error.

**AppNavigator** (`mobile/src/navigation/AppNavigator.tsx`): `CommunityStackParamList {CommunityFeed, CreatePost}`; `CommunityStackNavigator`; `Community` tab added between Messages and ProfileTab; existing tabs preserved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] expo-image-picker v57 removed MediaType enum**
- **Found during:** Task 2 TypeScript check
- **Issue:** `ImagePicker.MediaType.Images` does not exist in expo-image-picker v57 — `MediaType` is a string union type `'images' | 'videos' | 'livePhotos'`, not an enum
- **Fix:** Changed `ImagePicker.MediaType.Images` to `'images' as ImagePicker.MediaType` — correct for v57 API
- **Files modified:** `mobile/src/components/Community/PostPhotoAttachment.tsx`
- **Commit:** d7732bc (included in Task 2 commit after fix)

## Self-Check

### Files exist
- FOUND: backend/src/models/Post.js
- FOUND: backend/src/controllers/postController.js
- FOUND: backend/src/routes/posts.js
- FOUND: backend/test/post.feed.test.js
- FOUND: mobile/src/types/community.ts
- FOUND: mobile/src/store/feedStore.ts
- FOUND: mobile/src/components/Community/PostCard.tsx
- FOUND: mobile/src/components/Community/PostPhotoAttachment.tsx
- FOUND: mobile/src/screens/Community/CommunityFeedScreen.tsx
- FOUND: mobile/src/screens/Community/CreatePostScreen.tsx

### Commits exist
- aed76e9: feat(03-01): Post model + createPost/getFeed controller + posts route + pagination test
- d7732bc: feat(03-01): Community tab — feed + create-post screens, store, api, types, navigation

### Tests
- backend node --test: 14/14 pass (includes 4 new held-out assertions)
- mobile npx tsc --noEmit: PASS

## Self-Check: PASSED

## Known Stubs

- `PostCard` displays `post.authorUid` as the author name — no display name lookup. A future plan should resolve the author's display name from a user profile. This is intentional for MVP (no blocking API call per post card in feed).
- Like/comment/report interactions in `PostCard` are rendering-only (static counts). Interactive behavior (like toggle, comment navigation, report sheet) is wired in plan 03-02 as stated in the plan.

## Threat Surface Scan

No new threat surface beyond the plan's threat register. All T-03-01-* mitigations applied:
- T-03-01-01: authorUid always from token (held-out test proves it)
- T-03-01-02: verifyFirebaseToken + requireVerified on both routes
- T-03-01-03: storage PATH stored; signed URL at read time; no public bucket URL emitted
- T-03-01-04: multer 5MB fileSize limit
- T-03-01-05: schema maxlength 1000 + non-empty trim validation
