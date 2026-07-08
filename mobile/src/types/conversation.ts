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
 * A single message within a Conversation.
 * Messages are stored in a separate MongoDB collection (locked decision —
 * avoids 16MB doc limit).
 *
 * senderUid: always the Firebase UID of the sender (from socket.data.uid on the
 * backend — never trusted from the client payload).
 *
 * The optional `status` field is used client-side for optimistic UI:
 *   'sending'  — optimistic bubble, not yet confirmed by server
 *   'delivered' — confirmed by message:new event
 *   'failed'   — message:error received; tap-to-retry affordance
 */
export interface Message {
  id: string;
  conversationId: string;
  senderUid: string;
  content: string;
  createdAt: string;
  status?: 'sending' | 'delivered' | 'failed';
}
