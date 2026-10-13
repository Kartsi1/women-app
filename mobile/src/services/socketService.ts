import { io, Socket } from 'socket.io-client';
import { auth } from '../config/firebase';
import { useSocketStore } from '../store/socketStore';
import { useConversationStore } from '../store/conversationStore';
import { presentLocalNotification } from './push';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;
let forceRefreshNext = false;
let authRetryUsed = false;

/**
 * Connect to the backend Socket.io server using the Firebase ID token.
 *
 * The token is sent via socket.handshake.auth.token so the backend
 * io.use() middleware (chatHandler.js) can verify it before accepting
 * the connection (T-02-01-01, T-02-01-02).
 *
 * Returns the existing socket if already connected (idempotent).
 */
export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  socket = io(API_BASE_URL, {
    // Callback form: a current token is fetched on every (re)connection attempt.
    // Verified by the io.use() middleware on the server. Never log the token.
    auth: (cb) => {
      const user = auth.currentUser;
      if (!user) {
        cb({});
        return;
      }
      const force = forceRefreshNext;
      forceRefreshNext = false;
      user
        .getIdToken(force)
        .then((token) => cb({ token }))
        .catch(() => cb({}));
    },
    transports: ['websocket'], // skip polling for mobile performance
    reconnection: true,
    reconnectionDelay: 1000,
  });

  const { setSocket, setConnected } = useSocketStore.getState();
  setSocket(socket);

  socket.on('connect', () => {
    authRetryUsed = false;
    setConnected(true);
  });

  // socket.io-client does not auto-reconnect after a middleware rejection.
  // On an auth rejection refresh the token once and reconnect; otherwise give
  // up (REST authFetch owns sign-out — the socket never signs out).
  socket.on('connect_error', (err: Error) => {
    const authRejected = err.message === 'Invalid token' || err.message === 'Missing auth token';
    if (authRejected && !authRetryUsed && auth.currentUser) {
      authRetryUsed = true;
      forceRefreshNext = true;
      console.warn('[Socket] auth rejected — refreshing token and retrying once');
      socket?.connect();
      return;
    }
    console.warn('[Socket] connect_error:', err.message);
  });

  socket.on('disconnect', () => {
    setConnected(false);
  });

  // Server emits 'connected' event with uid after successful auth (chatHandler.js)
  socket.on('connected', ({ uid }: { uid: string }) => {
    console.log('[Socket] Authenticated handshake confirmed for uid:', uid);
    setConnected(true);
  });

  // Single global registration point for incoming message requests (server emits
  // to room user:<uid>, see chatHandler.js). Bumps the badge count and shows a
  // local system notification.
  socket.on(
    'message_request:new',
    (payload: {
      requestId: string;
      senderUid: string;
      senderDisplayName: string | null;
      intro: string;
    }) => {
      useConversationStore.getState().incrementPendingRequestCount();
      void presentLocalNotification(
        'New message request',
        `New message request from ${payload.senderDisplayName || 'a member'}`,
        { type: 'message_request', requestId: payload.requestId },
      );
    },
  );

  return socket;
}

/**
 * Return the current socket instance (null if not yet connected).
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Disconnect and clean up the socket instance.
 * Called from the authStore.clear() / sign-out path.
 */
export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  forceRefreshNext = false;
  authRetryUsed = false;
  const { clear } = useSocketStore.getState();
  clear();
}
