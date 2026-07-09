/**
 * TypeScript interfaces for 1:1 Direct Messaging (MSG-01, MSG-02, MSG-03).
 *
 * These mirror the backend MongoDB document shapes returned by the conversation
 * and message-request REST endpoints.
 */

/**
 * A pending/accepted/declined message request sent from one verified user
 * to another. The gate object that controls whether a Conversation exists.
 */
export interface MessageRequest {
  id: string;
  senderUid: string;
  intro: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt?: string;
}

/**
 * An accepted 1:1 conversation channel between two verified users.
 * A Conversation is created only when a MessageRequest is accepted.
 *
 * participants: exactly two Firebase UIDs, server-sorted.
 */
export interface Conversation {
  id: string;
  participants: string[];
  lastMessageAt?: string;
  lastMessagePreview?: string;
}

/**
 * A single message within a Conversation or a city group chat.
 * Messages are stored in a separate MongoDB collection (locked decision —
 * avoids 16MB doc limit).
 *
 * senderUid: always the Firebase UID of the sender (from socket.data.uid on the
 * backend — never trusted from the client payload).
 *
 * senderName (02-05, group messages only): the sender's display name, denormalised
 * on the backend at message create time from socket.data.displayName. Only populated
 * for group (city) messages; absent for DMs. Used to render the sender label above
 * non-own group message bubbles.
 *
 * citySlug (02-05, group messages only): the scope discriminator on message:new
 * events from the socket. CityGroupChatScreen filters by this value to ensure only
 * messages for the user's own city are appended to cityMessages. Absent for DMs.
 *
 * The optional `status` field is used client-side for optimistic UI:
 *   'sending'  — optimistic bubble, not yet confirmed by server
 *   'delivered' — confirmed by message:new event
 *   'failed'   — message:error received; tap-to-retry affordance
 */
export interface Message {
  id: string;
  conversationId?: string;  // set for DM messages, absent for group messages
  senderUid: string;
  content: string;
  createdAt: string;
  status?: 'sending' | 'delivered' | 'failed';
  // City group chat fields (02-05 — absent for DM messages)
  senderName?: string;      // denormalised sender display name (group only)
  citySlug?: string;        // scope discriminator (group only)
}

/**
 * City info returned by GET /api/conversations/city (MSG-04, 02-05).
 *
 * citySlug: the normalised city room slug derived from homeCity on the server.
 *   null when the user has not yet set a home city (mobile shows a set-your-city empty state).
 * homeCity: the raw homeCity string from the user's profile (for display).
 *   null when the user has not yet set a home city.
 */
export interface CityInfo {
  citySlug: string | null;
  homeCity: string | null;
}
