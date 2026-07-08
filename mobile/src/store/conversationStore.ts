import { create } from 'zustand';
import type { Conversation, Message } from '../types/conversation';

/**
 * Zustand store for conversation list and active message thread.
 *
 * Shape mirrors profileStore / listingStore (Zustand create pattern).
 *
 * conversations   — all conversations for the current user (from listConversations)
 * activeMessages  — messages for the currently open DirectMessageScreen
 *
 * appendMessage — immutable push for real-time message:new events.
 *   Deduplicates by message id so an optimistic entry confirmed by the server
 *   does not appear twice in the list.
 *
 * clear() is called from the sign-out path alongside authStore.clear()
 * to ensure no stale DM data persists between sessions.
 */

interface ConversationState {
  conversations: Conversation[];
  activeMessages: Message[];
  setConversations: (conversations: Conversation[]) => void;
  appendMessage: (message: Message) => void;
  setActiveMessages: (messages: Message[]) => void;
  clear: () => void;
}

export const useConversationStore = create<ConversationState>()((set, get) => ({
  conversations: [],
  activeMessages: [],

  setConversations: (conversations) => set({ conversations }),

  appendMessage: (message) => {
    const existing = get().activeMessages;
    // Dedupe: if a message with the same id already exists (e.g. optimistic entry
    // was confirmed), replace it. Otherwise append.
    const idx = existing.findIndex((m) => m.id === message.id);
    if (idx !== -1) {
      const updated = [...existing];
      updated[idx] = message;
      set({ activeMessages: updated });
    } else {
      set({ activeMessages: [message, ...existing] });
    }
  },

  setActiveMessages: (messages) => set({ activeMessages: messages }),

  clear: () => set({ conversations: [], activeMessages: [] }),
}));
