import { create } from 'zustand';
import type { Conversation, Message, CityInfo } from '../types/conversation';
import { getMessageRequestInbox } from '../services/api';

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
 *   Deduplicates by message id and RECONCILES optimistic entries: a server echo
 *   (non-'opt_' id) replaces the oldest matching optimistic entry (same sender,
 *   same trimmed content, status 'sending'/'failed') in place, so a sent message
 *   shows exactly one bubble.
 *
 * appendCityMessage — immutable push for real-time city message:new events.
 *   Same dedupe + optimistic reconcile as appendMessage (shared mergeIncoming).
 *   Callers must filter by citySlug BEFORE calling this function (done in
 *   CityGroupChatScreen's message:new listener — T-02-05-04).
 *
 * pendingRequestCount — number of pending incoming message requests; drives the red
 *   badge on the Requests pill and the Messages tab badge. Set from the inbox,
 *   incremented by the global socket 'message_request:new' listener, refreshed via
 *   refreshPendingRequestCount().
 *
 * clear() is called from the sign-out path alongside authStore.clear()
 * to ensure no stale DM or city data persists between sessions.
 */

const OPTIMISTIC_PREFIX = 'opt_';

/**
 * Merge an incoming message into a newest-first list.
 *  (a) same id exists -> replace in place
 *  (b) server echo (non-optimistic id) -> replace the OLDEST matching optimistic entry
 *      (same sender, same trimmed content, status sending/failed) in place
 *  (c) otherwise prepend
 */
function mergeIncoming(list: Message[], message: Message): Message[] {
  const sameId = list.findIndex((m) => m.id === message.id);
  if (sameId !== -1) {
    const updated = [...list];
    updated[sameId] = message;
    return updated;
  }

  if (!message.id.startsWith(OPTIMISTIC_PREFIX)) {
    const incomingContent = message.content.trim();
    // Newest-first list: the oldest matching optimistic entry has the highest index.
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (
        m.id.startsWith(OPTIMISTIC_PREFIX) &&
        (m.status === 'sending' || m.status === 'failed') &&
        m.senderUid === message.senderUid &&
        m.content.trim() === incomingContent
      ) {
        const updated = [...list];
        updated[i] = message;
        return updated;
      }
    }
  }

  return [message, ...list];
}

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
  // Pending message requests (quick umq)
  pendingRequestCount: number;
  setPendingRequestCount: (count: number) => void;
  incrementPendingRequestCount: () => void;
  refreshPendingRequestCount: () => Promise<void>;
  // Shared
  clear: () => void;
}

export const useConversationStore = create<ConversationState>()((set, get) => ({
  // ── DM state (02-04) ───────────────────────────────────────────────────────
  conversations: [],
  activeMessages: [],

  setConversations: (conversations) => set({ conversations }),

  appendMessage: (message) => set({ activeMessages: mergeIncoming(get().activeMessages, message) }),

  setActiveMessages: (messages) => set({ activeMessages: messages }),

  // ── City group chat state (02-05) ─────────────────────────────────────────
  cityInfo: null,
  cityMessages: [],

  setCityInfo: (info) => set({ cityInfo: info }),

  setCityMessages: (messages) => set({ cityMessages: messages }),

  appendCityMessage: (message) => set({ cityMessages: mergeIncoming(get().cityMessages, message) }),

  // ── Pending message requests (quick umq) ──────────────────────────────────
  pendingRequestCount: 0,

  setPendingRequestCount: (count) => set({ pendingRequestCount: count }),

  incrementPendingRequestCount: () =>
    set({ pendingRequestCount: get().pendingRequestCount + 1 }),

  refreshPendingRequestCount: async () => {
    try {
      const res = await getMessageRequestInbox();
      if (Array.isArray(res.data)) {
        set({ pendingRequestCount: res.data.length });
      }
    } catch {
      // keep the previous value on failure
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
      pendingRequestCount: 0,
    }),
}));
