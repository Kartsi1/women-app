import { create } from 'zustand';
import type { StayReviews } from '../types/community';

/**
 * Review store for blind-release stay review state (REVW-03).
 *
 * Keyed by stayRequestId so multiple stay review states can be cached
 * simultaneously (e.g. while viewing a stay request and its counterpart's profile).
 *
 * The server state field ('waiting' | 'revealed' | 'eligible' | 'not_eligible')
 * is stored exactly as received — the client never derives or overrides it.
 *
 * Pattern: mobile/src/store/profileStore.ts (Zustand single-shape store)
 */
interface ReviewStoreState {
  // keyed by stayRequestId — StayReviews is the full server response shape
  reviewStates: Record<string, StayReviews>;
  /**
   * Store or update the review state for a specific stay.
   * Called after getStayReviews returns successfully.
   */
  setReviewState: (stayRequestId: string, state: StayReviews) => void;
  /** Reset all cached review states — called on sign-out. */
  clear: () => void;
}

export const useReviewStore = create<ReviewStoreState>()((set) => ({
  reviewStates: {},
  setReviewState: (stayRequestId, state) =>
    set((s) => ({
      reviewStates: { ...s.reviewStates, [stayRequestId]: state },
    })),
  clear: () => set({ reviewStates: {} }),
}));
