---
phase: 03-community-trust-layer
plan: "02"
subsystem: community-interactions
status: complete
tags: [community, comments, likes, report, idempotent, push-notification, optimistic-ui]
completed: "2026-07-10"
duration: "~18 min"
tasks_completed: 2
files_changed: 17

dependency_graph:
  requires:
    - 03-01  # Post model, postController (createPost/getFeed), postsRouter, feedStore, api.ts, PostCard
    - 02-01  # verifyFirebaseToken + requireVerified middleware
    - 02-02  # notificationService.sendPushNotification
  provides:
    - Comment model (separate collection, postId indexed)
    - Report.contentType enum extended to include 'post' and 'comment'
    - commentController (createComment + getComments + fire-and-forget push)
    - postController.toggleLike (idempotent pre-check, no counter drift)
    - postController.deletePost (author-only, cascades Comment.deleteMany)
    - /api/posts/:id/comments route (mergeParams, POST + GET)
    - /api/posts/:id/like route (POST)
    - /api/posts/:id route DELETE
    - Comment interface in community.ts
    - api.ts: getComments, createComment, toggleLike, deletePost, reportContent
    - feedStore.updatePost(id, patch) for optimistic updates
    - PostCard interactive like/comment/report
    - CommentRow + CommentInput components
    - PostDetailScreen
    - PostDetail route in CommunityStackParamList
  affects:
    - 03-03  # review flow builds on PostDetailScreen + CommunityStackParamList

tech_stack:
  added: []
  patterns:
    - Pre-check likedBy.includes(uid) before $addToSet/$inc — mandatory idempotency guard (T-03-02-01)
    - authorUid always from req.user.uid — never req.body (T-03-02-02; identical to 03-01 pattern)
    - Fire-and-forget push wrapped in try/catch — push failure never fails the comment request
    - Report enum extension (not new model) — contentType discriminator carries 'post' | 'comment'
    - Optimistic UI: updatePost(id, patch) → API call → revert on error (same pattern as DM message)
    - CommentInput with forwardRef + useImperativeHandle for focus() from parent (autofocus on focusComment)
    - Comment stored in separate collection (NOT embedded) — same 16MB discipline as Message model

key_files:
  created:
    - backend/src/models/Comment.js
    - backend/src/controllers/commentController.js
    - backend/src/routes/comments.js
    - backend/test/comment.like.test.js
    - mobile/src/components/Community/CommentRow.tsx
    - mobile/src/components/Community/CommentInput.tsx
    - mobile/src/screens/Community/PostDetailScreen.tsx
  modified:
    - backend/src/models/Report.js          # contentType enum extended with 'post' + 'comment'
    - backend/src/controllers/postController.js  # added toggleLike + deletePost
    - backend/src/routes/posts.js           # added POST /:id/like + DELETE /:id
    - backend/src/server.js                 # mounts commentsRouter at /api/posts/:id/comments
    - mobile/src/types/community.ts         # Comment interface added
    - mobile/src/services/api.ts            # getComments, createComment, toggleLike, deletePost, reportContent
    - mobile/src/store/feedStore.ts         # updatePost(id, patch) action
    - mobile/src/components/Community/PostCard.tsx  # interactive like/comment/report
    - mobile/src/navigation/AppNavigator.tsx   # PostDetail route + CommunityStackNavigator
    - mobile/src/screens/Community/CommunityFeedScreen.tsx  # PostCard navigation props wired

decisions:
  - Pre-check likedBy.includes(uid) is mandatory — without it $addToSet(no-op) + $inc:+1 can double-count on rapid repeat calls (T-03-02-01)
  - Push notification is fire-and-forget — a missing/invalid expoPushToken is a no-op; push failure never errors the comment response
  - deletePost restricted to post author only — req.user.isAdmin is not set by verifyFirebaseToken; admin deletion would require separate admin middleware (noted in SUMMARY per plan instructions)
  - Report flow reused via reportUser() with contentType 'post'|'comment' — no new route or model
  - Comment collection is separate from Post — NOT embedded — same 16MB limit discipline as the Message model
  - CommentInput uses forwardRef + useImperativeHandle to expose focus() — enables autofocus from PostDetailScreen when focusComment param is true

metrics:
  duration: "~18 min"
  completed: "2026-07-10"
  tasks: 2
  files: 17
---

# Phase 03 Plan 02: Comments, Idempotent Likes, and Moderation Summary

**One-liner:** Idempotent like toggle (pre-check likedBy before $inc), chronological comment API with author push (skip self), Report enum extended for post/comment, PostDetailScreen with optimistic CommentInput, and interactive PostCard like/comment/report — proven by 6-assertion held-out test (20/20 backend, tsc clean).

## What Was Built

### Backend

**Comment model** (`backend/src/models/Comment.js`): Separate collection — NOT embedded in Post (same 16MB discipline as the Message model). Fields: `postId` (ObjectId ref 'Post', required, `index: true` for getComments), `authorUid` (String, required — always set from `req.user.uid`, T-03-02-02), `text` (String, required, `maxlength: 500` — T-03-02-06 DoS guard). `timestamps: true`.

**Report model extension** (`backend/src/models/Report.js`): `contentType` enum changed from `['listing','message','user']` to `['listing','message','user','post','comment']`. Header comment updated to match. No new fields; `contentId` (String) already accepts ObjectId hex strings.

**commentController** (`backend/src/controllers/commentController.js`):
- `createComment`: uid from `req.user.uid` (T-03-02-02 — `req.body.authorUid` ignored); non-empty text trimmed (400 if empty); loads Post (404 if missing); `Comment.create`; `Post.findByIdAndUpdate($inc commentCount)`; fire-and-forget push to author if commenter ≠ author (swallows all push errors); responds 201 `{ data: { id } }`.
- `getComments`: `Comment.find({ postId }).sort({ createdAt: 1 }).select('authorUid text createdAt').lean()`; responds `{ data: comments }`.

**postController additions** (`backend/src/controllers/postController.js`):
- `toggleLike`: loads post selecting `likedBy`; **mandatory pre-check** `alreadyLiked = post.likedBy.includes(uid)`; chooses `$pull + $inc:-1` or `$addToSet + $inc:+1` based on pre-check — never issues a second `$inc:+1` for a repeat like request (T-03-02-01). Responds `{ data: { likeCount, liked } }`.
- `deletePost`: loads post selecting `authorUid`; 403 if caller is not author (T-03-02-03); cascades `Comment.deleteMany({ postId })`; responds `{ data: { deleted: true } }`.

**Comments router** (`backend/src/routes/comments.js`): `Router({ mergeParams: true })` — POST `/` + GET `/` both gated by `verifyFirebaseToken + requireVerified` (T-03-02-04).

**Posts router additions** (`backend/src/routes/posts.js`): `POST /:id/like` + `DELETE /:id`, both gated by `verifyFirebaseToken + requireVerified`.

**server.js**: Mounts `commentsRouter` at `/api/posts/:id/comments`.

**Held-out test** (`backend/test/comment.like.test.js`): 6 assertions using node:test (same style as prior test files):
- (a) pre-existing like → `$pull + $inc:-1`, returns `liked:false`
- (b) no existing like → `$addToSet + $inc:+1`, returns `liked:true`
- (c) double-call idempotency: consecutive toggleLike calls with pre-check simulate correct +1/-1 net change, never +2
- (d) `req.body.authorUid` spoofed → comment saves with `req.user.uid`
- (e) commenter = author → `sendPushNotification` called 0 times
- (f) commenter ≠ author → `sendPushNotification` called 1 time

Full suite: **20/20 backend tests pass** (14 prior + 6 new).

### Mobile

**Comment interface** (`mobile/src/types/community.ts`): `{ _id, postId, authorUid, text, createdAt }`.

**api.ts additions**: `getComments(postId)`, `createComment(postId, text)`, `toggleLike(postId)`, `deletePost(postId)`, `reportContent(payload)` — the last reuses `reportUser()` with `contentType: 'post'|'comment'`.

**feedStore.updatePost** (`mobile/src/store/feedStore.ts`): Shallow-merges a `Partial<Post>` into the matching post in `posts[]` by `_id`. Used by PostCard for optimistic like updates and by PostDetailScreen for comment count optimistic increment.

**PostCard** (`mobile/src/components/Community/PostCard.tsx`): Interactive like toggle — `heart-outline #777777` (unliked) / `heart #6200ea` (liked); optimistic `updatePost` + `toggleLike` API; on error reverts and shows "Couldn't update like. Try again." (transient). Comment affordance calls `onCommentPress` → navigates to PostDetail with `focusComment: true`. Report flag opens a `Modal` bottom-sheet (title "Report this post?", required reason `TextInput`, "Send report" / "Cancel") calling `reportContent({ contentType: 'post', ... })`.

**CommentRow** (`mobile/src/components/Community/CommentRow.tsx`): Avatar (28×28dp) + author name (Body/16px Semibold) + text + timestamp (Label/14px muted) + report icon (44×44dp) opening report bottom-sheet with title "Report this comment?".

**CommentInput** (`mobile/src/components/Community/CommentInput.tsx`): Fixed bottom row (min-height 48px), `KeyboardAvoidingView`, TextInput (`flex:1`, placeholder "Add a comment…", `maxLength: 500`), send button (Ionicons "send", accent). `forwardRef` exposes `focus()` via `useImperativeHandle` for autofocus from PostDetailScreen.

**PostDetailScreen** (`mobile/src/screens/Community/PostDetailScreen.tsx`): Loads post from `feedStore` (warm path, avoids extra API call) + `getComments` on mount. ScrollView with full PostCard + "Comments" section header + CommentRow list + CommentInput fixed at bottom. Optimistic comment append (temp `_id`), confirmed on `getComments` re-fetch; on error reverts and shows "Comment not posted — tap to retry." Empty state: "No comments yet. Start the conversation." `focusComment` param auto-focuses `CommentInput` after 300ms.

**AppNavigator** (`mobile/src/navigation/AppNavigator.tsx`): `PostDetail: { postId: string; focusComment?: boolean }` added to `CommunityStackParamList`; `PostDetailScreen` registered in `CommunityStackNavigator`.

**CommunityFeedScreen** (`mobile/src/screens/Community/CommunityFeedScreen.tsx`): `PostCard.onPress` → `navigate('PostDetail', { postId })`, `PostCard.onCommentPress` → `navigate('PostDetail', { postId, focusComment: true })`.

**TypeScript:** `npx tsc --noEmit` — **PASS (0 errors)**.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Design Decisions (documented in plan)

**1. deletePost restricted to author-only (no admin escalation)**
- **Why:** `req.user.isAdmin` is not populated by `verifyFirebaseToken` (which only sets `uid`, `email`, `isVerified` from the Firebase token). Checking admin status would require an additional DB lookup or a separate admin middleware not present in this plan's scope.
- **Impact:** Admin post deletion is not available via the community API in 03-02. Admins can delete posts via the existing `adminRouter` if needed.
- **Noted in plan:** The plan's task description says "if no reusable admin flag on req.user, restrict to author-only and note it in the SUMMARY."

## Known Stubs

- `PostCard` and `CommentRow` display `authorUid` as the author name — no display name lookup. A future plan should resolve `displayName` from a user profile. Intentional for MVP (no blocking per-card API call in feed/comment list).

## Threat Surface Scan

All T-03-02-* mitigations applied:
- T-03-02-01: Pre-check `likedBy.includes(uid)` before `$inc` (held-out test asserts no drift)
- T-03-02-02: `authorUid` from `req.user.uid` only (held-out test asserts body is ignored)
- T-03-02-03: `deletePost` rejects non-author with 403
- T-03-02-04: All comment/like/delete routes gated by `verifyFirebaseToken + requireVerified`
- T-03-02-05: `reason` required (existing Report schema validation); `reporterUid`/`reportedUid` set server-side
- T-03-02-06: Schema `maxlength: 500` + non-empty trim validation in controller
- T-03-02-SC: No new packages installed

No new threat surface beyond the plan's threat register.

## Self-Check

### Files exist
- FOUND: backend/src/models/Comment.js
- FOUND: backend/src/controllers/commentController.js
- FOUND: backend/src/routes/comments.js
- FOUND: backend/test/comment.like.test.js
- FOUND: mobile/src/components/Community/CommentRow.tsx
- FOUND: mobile/src/components/Community/CommentInput.tsx
- FOUND: mobile/src/screens/Community/PostDetailScreen.tsx

### Commits exist
- ce3c539: feat(03-02): Comment model, idempotent toggleLike, deletePost, comments route, Report enum extended
- de421b1: feat(03-02): PostDetailScreen, CommentRow/Input, interactive like/report on PostCard, PostDetail nav

### Tests
- backend node --test: 20/20 pass (6 new comment.like assertions + 14 prior)
- mobile npx tsc --noEmit: PASS

## Self-Check: PASSED
