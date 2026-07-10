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
  text: string;
  createdAt: string; // ISO 8601 date string
}

export interface Post {
  _id: string;
  authorUid: string;
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
