/**
 * Community types for Phase 3 (COMM-01, COMM-02, COMM-03).
 *
 * Post — a community post authored by a verified user.
 * photoUrl — either a signed URL (returned by backend at read time) or null.
 *   The backend stores a Firebase Storage path and converts to a signed URL before responding.
 *   The client never stores or handles raw storage paths.
 */

/**
 * Comment — a reply to a Post, stored in a separate collection on the server.
 * authorUid — the Firebase UID of the commenter (always set server-side, never spoofable).
 */
export interface Comment {
  _id: string;
  postId: string;
  authorUid: string;
  authorName?: string; // resolved from the author's profile at read time
  text: string;
  createdAt: string; // ISO 8601 date string
}

export interface Post {
  _id: string;
  authorUid: string;
  authorName?: string; // resolved from the author's profile at read time (reflects renames)
  authorPhotoUrl?: string | null; // signed avatar URL, or null
  text: string;
  /**
   * Signed URL string when a photo was attached, or null if no photo.
   * The backend always resolves the storage path to a signed URL before sending —
   * the client never receives a raw gs:// or public storage URL.
   */
  photoUrl: string | null;
  likeCount: number;
  likedBy: string[];
  commentCount: number;
  createdAt: string; // ISO 8601 date string
}

// ---------------------------------------------------------------------------
// Review types (REVW-01, REVW-02, REVW-03) — Phase 3 Plan 04
// ---------------------------------------------------------------------------

/**
 * A single review submitted after a stay.
 * reviewerUid is absent from the server response (only subjectUid is returned
 * in the aggregation endpoint); it is optional here to cover both shapes.
 */
export interface Review {
  rating: number;       // 1–5
  text: string;
  submittedAt: string;  // ISO 8601 date string
  reviewerUid?: string; // present in some aggregation responses, absent in pair responses
}

/**
 * The review state for a stay pair as returned by
 * GET /api/reviews/:stayRequestId.
 *
 * The server computes the reveal predicate (bothSubmitted || now >= checkOut+14d).
 * The client NEVER makes this decision — it renders whatever state the server returns.
 *
 * - 'not_eligible' : stay not accepted or not yet past checkOut
 * - 'eligible'     : past checkOut, no reviews submitted yet
 * - 'waiting'      : ownReview present but counterpartReview is null (server withheld)
 * - 'revealed'     : both reviews visible (predicate fired server-side)
 */
export type ReviewState = 'not_eligible' | 'eligible' | 'waiting' | 'revealed';

/**
 * Shape returned by GET /api/reviews/:stayRequestId.
 *
 * SAFETY INVARIANT:
 * counterpartReview is null whenever state is 'waiting' — the server strips it.
 * The mobile client MUST NOT attempt to display counterpart content when it is null.
 * This is enforced structurally: ReviewWaitingChip does not accept or render any
 * counterpart prop, so there is no code path that could display withheld content.
 */
export interface StayReviews {
  state: ReviewState;
  revealDeadline: string; // ISO 8601 — display only; the gate lives server-side
  ownReview: Review | null;
  counterpartReview: Review | null; // null pre-reveal; server never sends text here until revealed
}

/**
 * Shape returned by GET /api/reviews/user/:uid.
 * Only revealed reviews are included — the server filters unrevealed reviews
 * before aggregating avgRating and reviewCount.
 */
export interface UserReviews {
  avgRating: number | null; // null when reviewCount is 0
  reviewCount: number;      // count of revealed reviews only
  reviews: Review[];        // revealed reviews, reverse-chronological
}
