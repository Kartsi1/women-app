import { create } from 'zustand';
import { Socket } from 'socket.io-client';

interface SocketState {
  socket: Socket | null;
  connected: boolean;
  setSocket: (socket: Socket | null) => void;
  setConnected: (connected: boolean) => void;
  clear: () => void;
}

/**
 * Zustand store for the Socket.io connection singleton.
 *
 * Follows the nullable-singleton pattern from authStore.ts.
 * socketService.ts writes to this store on connect/disconnect events.
 */
export const useSocketStore = create<SocketState>()((set) => ({
  socket: null,
  connected: false,
  setSocket: (socket) => set({ socket }),
  setConnected: (connected) => set({ connected }),
  clear: () => set({ socket: null, connected: false }),
}));
