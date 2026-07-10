import { auth } from '../config/firebase';
import type { Listing, SearchListingsParams, CreateListingPayload } from '../types/listing';
import type { CityInfo, Message } from '../types/conversation';
import type { Post, Comment } from '../types/community';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Mirror the currently signed-in Firebase user into MongoDB.
 * Called once immediately after createUserWithEmailAndPassword succeeds.
 */
export async function registerUser(): Promise<unknown> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, { method: 'POST', headers });
  return res.json();
}

/**
 * Upload ID document and selfie photos to the backend for verification review.
 * Do NOT set Content-Type manually — let FormData set the boundary (RESEARCH Pitfall 5).
 */
export async function uploadVerificationDocs(idUri: string, selfieUri: string): Promise<unknown> {
  const token = await auth.currentUser?.getIdToken();
  const formData = new FormData();
  formData.append('idDocument', { uri: idUri, type: 'image/jpeg', name: 'id.jpg' } as unknown as Blob);
  formData.append('selfie', { uri: selfieUri, type: 'image/jpeg', name: 'selfie.jpg' } as unknown as Blob);
  const res = await fetch(`${API_BASE_URL}/api/users/verification-docs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return res.json();
}

/**
 * Register (or update) the Expo push token for the authenticated user.
 * Called after the user grants notification permission (Plan 04 sends
 * approval/rejection notifications to this token).
 */
export async function savePushToken(token: string): Promise<unknown> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/users/push-token`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ expoPushToken: token }),
  });
  return res.json();
}

/**
 * Fetch the current user's own public profile from GET /api/users/:uid.
 * The backend returns the explicit public projection (no email or verification docs).
 */
export async function getMyProfile(): Promise<unknown> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/users/${uid}`, { headers });
  return res.json();
}

/**
 * Update the current user's profile fields (displayName, bio, homeCity).
 * Calls PUT /api/users/profile.
 */
export async function updateProfile(fields: {
  displayName?: string;
  bio?: string;
  homeCity?: string;
}): Promise<unknown> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/users/profile`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(fields),
  });
  return res.json();
}

/**
 * Fetch another verified user's public profile from GET /api/users/:uid.
 */
export async function getUserProfile(uid: string): Promise<unknown> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/users/${uid}`, { headers });
  return res.json();
}

/**
 * Upload or replace the current user's profile photo.
 * Uses multipart/form-data — do NOT set Content-Type manually (RESEARCH Pitfall 5).
 *
 * @param uri - local file URI from expo-image-picker (e.g. file:///...)
 */
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

/**
 * Block another user. The block is persisted in the caller's blockedUsers array
 * so that the blocked user can no longer view the caller's profile (VERI-06).
 *
 * POST /api/users/block/:uid
 */
export async function blockUser(uid: string): Promise<unknown> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/users/block/${uid}`, {
    method: 'POST',
    headers,
  });
  return res.json();
}

/**
 * Report payload sent to POST /api/users/report (VERI-07).
 */
export interface ReportPayload {
  reportedUid?: string;
  contentType?: string;
  contentId?: string;
  reason: string;
}

/**
 * Submit a user or content report for admin review.
 * The reason field is required — the backend rejects reports without one.
 *
 * POST /api/users/report
 */
export async function reportUser(payload: ReportPayload): Promise<unknown> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/users/report`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Listings API (LIST-01..05)
// ---------------------------------------------------------------------------

/**
 * Search listings by geographic location and optional date range.
 * GET /api/listings/search
 *
 * Security (T-02-02-01): Response never includes exactAddress.
 * Returns array of Listing objects with neighbourhood centroid coordinates only.
 */
export async function searchListings(
  params: SearchListingsParams
): Promise<{ data: Listing[] }> {
  const headers = await authHeaders();
  const query = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
    ...(params.radiusM !== undefined && { radiusM: String(params.radiusM) }),
    ...(params.fromDate && { fromDate: params.fromDate }),
    ...(params.toDate && { toDate: params.toDate }),
  });
  const res = await fetch(`${API_BASE_URL}/api/listings/search?${query}`, { headers });
  return res.json();
}

/**
 * Create a new housing listing with photos.
 * POST /api/listings (multipart/form-data)
 *
 * Uses FormData — do NOT set Content-Type manually (let FormData set the boundary).
 * Pattern from uploadProfilePhoto / uploadVerificationDocs (RESEARCH Pitfall 5).
 */
export async function createListing(
  payload: CreateListingPayload
): Promise<{ data?: { id: string }; error?: string }> {
  const token = await auth.currentUser?.getIdToken();

  const formData = new FormData();
  formData.append('title', payload.title);
  if (payload.description) formData.append('description', payload.description);
  if (payload.houseRules) formData.append('houseRules', payload.houseRules);
  formData.append('citySlug', payload.citySlug);
  formData.append('exactAddress', payload.exactAddress);
  // [lng, lat] — longitude FIRST per GeoJSON spec (Pitfall 2)
  formData.append('coordinates', JSON.stringify(payload.coordinates));
  if (payload.availabilityDates && payload.availabilityDates.length > 0) {
    formData.append('availabilityDates', JSON.stringify(payload.availabilityDates));
  }

  // Append each photo as a multipart file
  if (payload.photoUris) {
    payload.photoUris.forEach((uri, i) => {
      formData.append('photos', {
        uri,
        type: 'image/jpeg',
        name: `photo_${i}.jpg`,
      } as unknown as Blob);
    });
  }

  const res = await fetch(`${API_BASE_URL}/api/listings`, {
    method: 'POST',
    // Authorization only — no Content-Type; let FormData set the boundary (Pitfall 5)
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return res.json();
}

/**
 * Fetch a listing's full detail.
 * GET /api/listings/:id
 *
 * Security (T-02-02-01): Returns addressRevealed=false and exactAddress=null
 * in plan 02-02. The reveal is implemented in plan 02-03.
 */
export async function getListingDetail(
  id: string
): Promise<{ data?: Listing; error?: string }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/listings/${id}`, { headers });
  return res.json();
}

// ---------------------------------------------------------------------------
// Stay Request API (REQT-01, REQT-02, REQT-03, REQT-04)
// ---------------------------------------------------------------------------

export interface CreateStayRequestPayload {
  listingId: string;
  checkIn: string;  // ISO date string
  checkOut: string; // ISO date string
  intro: string;    // max 500 chars
}

export interface StayRequestData {
  _id: string;
  guestUid: string;
  listingId: string;
  checkIn: string;
  checkOut: string;
  intro: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

/**
 * Send a stay request from the authenticated guest to a listing host (REQT-01).
 * POST /api/requests
 *
 * Security (T-02-03-04): guestUid derived from the verified token on the server.
 * Possible server errors: 400 (invalid dates/intro), 403 (own listing), 404 (listing not found).
 */
export async function createStayRequest(
  payload: CreateStayRequestPayload
): Promise<{ data?: { id: string }; error?: string }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return res.json();
}

/**
 * Fetch stay requests sent to the authenticated host (REQT-02).
 * GET /api/requests/inbox
 *
 * Returns all stay requests where the caller is the host, newest first.
 * Projected to safe fields only.
 */
export async function getHostInbox(): Promise<{ data?: StayRequestData[]; error?: string }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/requests/inbox`, { headers });
  return res.json();
}

/**
 * Accept or decline a stay request (REQT-02 — host only).
 * PATCH /api/requests/:id
 *
 * Security (T-02-03-02): the server enforces host-only access.
 * On acceptance, the guest receives a push notification and
 * the listing detail will reveal the exact address to that guest only (REQT-03).
 */
export async function updateStayRequestStatus(
  id: string,
  status: 'accepted' | 'declined'
): Promise<{ data?: StayRequestData; error?: string }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/requests/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status }),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Messaging API (MSG-01, MSG-02, MSG-03)
// ---------------------------------------------------------------------------

/**
 * Send a message request with an intro to another verified user (MSG-01).
 * POST /api/message-requests
 *
 * Security (T-02-04-03): senderUid is derived from the verified token on the server.
 * The client only provides recipientUid and the intro text.
 *
 * Possible server errors: 400 (self/missing/too-long), 404 (unknown recipient),
 * 409 (duplicate pair or existing conversation).
 */
export async function sendMessageRequest(
  recipientUid: string,
  intro: string
): Promise<{ data?: unknown; error?: string }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/message-requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ recipientUid, intro }),
  });
  return res.json();
}

/**
 * Fetch pending message requests addressed to the authenticated user (MSG-02).
 * GET /api/message-requests/inbox
 *
 * Returns only pending requests; accepted/declined are filtered server-side.
 */
export async function getMessageRequestInbox(): Promise<{ data?: unknown[]; error?: string }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/message-requests/inbox`, { headers });
  return res.json();
}

/**
 * Accept or decline a pending message request (MSG-02).
 * PATCH /api/message-requests/:id
 *
 * Security (T-02-04-05): the server enforces recipient-only access.
 *
 * On acceptance the response includes a `conversationId` field to navigate into.
 */
export async function updateMessageRequestStatus(
  id: string,
  status: 'accepted' | 'declined'
): Promise<{ data?: unknown; conversationId?: string; error?: string }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/message-requests/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status }),
  });
  return res.json();
}

/**
 * List conversations where the authenticated user is a participant (MSG-03).
 * GET /api/conversations
 *
 * Sorted by lastMessageAt descending.
 */
export async function listConversations(): Promise<{ data?: unknown[]; error?: string }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/conversations`, { headers });
  return res.json();
}

/**
 * Fetch paginated message history for a specific conversation (MSG-03).
 * GET /api/conversations/:id/messages
 *
 * Security (T-02-04-01): the server rejects requests from non-participants (403).
 *
 * @param conversationId - MongoDB ObjectId string of the conversation
 * @param before         - ISO date cursor string for pagination (optional)
 */
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

// ---------------------------------------------------------------------------
// City Group Chat API (MSG-04, 02-05)
// ---------------------------------------------------------------------------

/**
 * Fetch the city slug and home city for the authenticated user (MSG-04).
 * GET /api/conversations/city
 *
 * Security (T-02-05-01): the server derives citySlug from the caller's own
 * profile — we do NOT send a citySlug from the client.
 *
 * Returns { data: { citySlug: string|null, homeCity: string|null } }
 * citySlug is null when the user has not set a home city yet.
 */
export async function getCityInfo(): Promise<{ data?: CityInfo; error?: string }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/conversations/city`, { headers });
  return res.json();
}

/**
 * Fetch paginated city group message history (MSG-04).
 * GET /api/conversations/city/messages
 *
 * Security (T-02-05-01): the server derives citySlug from the caller's profile.
 * We do NOT send a citySlug query param — the server ignores any client-supplied city.
 *
 * @param before - ISO date cursor string for pagination (optional)
 */
export async function getCityMessages(
  before?: string
): Promise<{ data?: Message[]; nextBefore?: string | null; error?: string }> {
  const headers = await authHeaders();
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  const query = params.toString() ? `?${params}` : '';
  const res = await fetch(
    `${API_BASE_URL}/api/conversations/city/messages${query}`,
    { headers }
  );
  return res.json();
}

// ---------------------------------------------------------------------------
// Community Feed API (COMM-01)
// ---------------------------------------------------------------------------

/**
 * Fetch a cursor-paginated page of community posts.
 * GET /api/posts?before=<base64cursor>
 *
 * The backend resolves photoUrl storage paths to signed URLs before responding —
 * the client always receives a signed URL or null, never a raw storage path.
 *
 * @param before - opaque base64 cursor from the previous page's nextCursor field
 */
export async function getFeed(
  before?: string
): Promise<{ data?: Post[]; nextCursor?: string | null; hasMore?: boolean; error?: string }> {
  const headers = await authHeaders();
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  const query = params.toString() ? `?${params}` : '';
  const res = await fetch(`${API_BASE_URL}/api/posts${query}`, { headers });
  return res.json();
}

/**
 * Create a new community post with optional single photo.
 * POST /api/posts (multipart/form-data)
 *
 * Do NOT set Content-Type manually — let FormData set the multipart boundary (RESEARCH Pitfall 5).
 * The server takes authorUid from the verified Firebase token — the client never sends it.
 *
 * @param text     - post text content (required, max 1000 chars)
 * @param photoUri - local file URI from expo-image-picker (optional)
 */
export async function createPost(
  text: string,
  photoUri?: string
): Promise<{ data?: { id: string }; error?: string }> {
  const token = await auth.currentUser?.getIdToken();
  const formData = new FormData();
  formData.append('text', text);
  if (photoUri) {
    formData.append('photo', {
      uri: photoUri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    } as unknown as Blob);
  }
  const res = await fetch(`${API_BASE_URL}/api/posts`, {
    method: 'POST',
    // Authorization only — NO Content-Type; let FormData set the boundary (Pitfall 5)
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Community Interactions API (COMM-02, COMM-03)
// ---------------------------------------------------------------------------

/**
 * Fetch all comments for a post in chronological order.
 * GET /api/posts/:postId/comments
 */
export async function getComments(
  postId: string
): Promise<{ data?: Comment[]; error?: string }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/posts/${postId}/comments`, { headers });
  return res.json();
}

/**
 * Post a new comment on a community post (COMM-02).
 * POST /api/posts/:postId/comments
 *
 * Security: authorUid is set server-side from the verified token — never sent by client.
 */
export async function createComment(
  postId: string,
  text: string
): Promise<{ data?: { id: string }; error?: string }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/posts/${postId}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text }),
  });
  return res.json();
}

/**
 * Toggle the like state for a post (COMM-03).
 * POST /api/posts/:postId/like
 *
 * The server pre-checks membership before issuing $inc so repeat calls never drift.
 * Returns the new likeCount and whether the post is now liked by the caller.
 */
export async function toggleLike(
  postId: string
): Promise<{ data?: { likeCount: number; liked: boolean }; error?: string }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/posts/${postId}/like`, {
    method: 'POST',
    headers,
  });
  return res.json();
}

/**
 * Delete the authenticated user's own post.
 * DELETE /api/posts/:postId
 *
 * The server enforces author-only deletion — a 403 is returned for non-authors.
 */
export async function deletePost(
  postId: string
): Promise<{ data?: { deleted: boolean }; error?: string }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
    method: 'DELETE',
    headers,
  });
  return res.json();
}

/**
 * Report a post or comment through the existing Report flow (COMM-03, VERI-07).
 * POST /api/users/report
 *
 * contentType: 'post' | 'comment' — extended in Report.js for 03-02.
 * reporterUid is set server-side from the verified token.
 */
export async function reportContent(payload: ReportPayload): Promise<unknown> {
  return reportUser(payload);
}
