import { create } from 'zustand';
import type { Conversation, Message, CityInfo } from '../types/conversation';

/**
 * Zustand store for conversation list, active DM thread, and city group chat.
 *
 * Shape mirrors profileStore / listingStore (Zustand create pattern).
 *
 * DM state (02-04):
 *   conversations   — all accepted 1:1 conversations for the current user
 *   activeMessages  — messages for the currently open DirectMessageScreen
 *
 * City group chat state (02-05):
 *   cityInfo        — city slug + homeCity from GET /api/conversations/city
 *   cityMessages    — messages for the currently open CityGroupChatScreen
 *
 * The DM and city message arrays are SEPARATE and MUST stay separate —
 * group messages must never surface in a DM thread and vice-versa (T-02-05-04).
 *
 * appendMessage — immutable push for real-time message:new DM events.
 *   Deduplicates by message id so an optimistic entry confirmed by the server
 *   does not appear twice in the list.
 *
 * appendCityMessage — immutable push for real-time city message:new events.
 *   Deduplicates by message id (same pattern as appendMessage).
 *   Callers must filter by citySlug BEFORE calling this function (done in
 *   CityGroupChatScreen's message:new listener — T-02-05-04).
 *
 * clear() is called from the sign-out path alongside authStore.clear()
 * to ensure no stale DM or city data persists between sessions.
 */

interface ConversationState {
  // DM state (02-04)
  conversations: Conversation[];
  activeMessages: Message[];
  setConversations: (conversations: Conversation[]) => void;
  appendMessage: (message: Message) => void;
  setActiveMessages: (messages: Message[]) => void;
  // City group chat state (02-05)
  cityInfo: CityInfo | null;
  cityMessages: Message[];
  setCityInfo: (info: CityInfo | null) => void;
  setCityMessages: (messages: Message[]) => void;
  appendCityMessage: (message: Message) => void;
  // Shared
  clear: () => void;
}

export const useConversationStore = create<ConversationState>()((set, get) => ({
  // ── DM state (02-04) ───────────────────────────────────────────────────────
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

  // ── City group chat state (02-05) ─────────────────────────────────────────
  cityInfo: null,
  cityMessages: [],

  setCityInfo: (info) => set({ cityInfo: info }),

  setCityMessages: (messages) => set({ cityMessages: messages }),

  appendCityMessage: (message) => {
    const existing = get().cityMessages;
    // Dedupe: if a message with the same id already exists (e.g. optimistic entry
    // confirmed by the server via message:new), replace it. Otherwise prepend
    // (cityMessages is displayed newest-first in an inverted FlatList).
    const idx = existing.findIndex((m) => m.id === message.id);
    if (idx !== -1) {
      const updated = [...existing];
      updated[idx] = message;
      set({ cityMessages: updated });
    } else {
      set({ cityMessages: [message, ...existing] });
    }
  },

  // ── Shared ─────────────────────────────────────────────────────────────────
  // Reset ALL state on sign-out — no stale DM or city data between sessions.
  clear: () =>
    set({
      conversations: [],
      activeMessages: [],
      cityInfo: null,
      cityMessages: [],
    }),
}));
