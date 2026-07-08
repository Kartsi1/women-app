import { io, Socket } from 'socket.io-client';
import { auth } from '../config/firebase';
import { useSocketStore } from '../store/socketStore';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;

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

  const token = await auth.currentUser?.getIdToken();

  socket = io(API_BASE_URL, {
    auth: { token },           // verified by io.use() middleware on server
    transports: ['websocket'], // skip polling for mobile performance
    reconnection: true,
    reconnectionDelay: 1000,
  });

  const { setSocket, setConnected } = useSocketStore.getState();
  setSocket(socket);

  socket.on('connect', () => {
    setConnected(true);
  });

  socket.on('disconnect', () => {
    setConnected(false);
  });

  // Server emits 'connected' event with uid after successful auth (chatHandler.js)
  socket.on('connected', ({ uid }: { uid: string }) => {
    console.log('[Socket] Authenticated handshake confirmed for uid:', uid);
    setConnected(true);
  });

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
  const { clear } = useSocketStore.getState();
  clear();
}
