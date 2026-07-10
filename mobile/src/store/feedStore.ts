/**
 * feedStore.ts — Community feed Zustand store (COMM-01).
 *
 * Mirrors listingStore.ts shape per PATTERNS.md, extended with cursor pagination state.
 * Always include clear() for sign-out (pattern from all other stores).
 */

import { create } from 'zustand';
import type { Post } from '../types/community';

interface FeedState {
  posts: Post[];
  nextCursor: string | null;
  hasMore: boolean;
  isLoading: boolean;
  /** Replace the current feed with a fresh first page */
  setPosts: (posts: Post[], nextCursor: string | null, hasMore: boolean) => void;
  /** Append a subsequent page to the existing feed */
  appendPosts: (newPosts: Post[], nextCursor: string | null, hasMore: boolean) => void;
  setIsLoading: (v: boolean) => void;
  /** Reset to initial state — called on sign-out */
  clear: () => void;
}

export const useFeedStore = create<FeedState>()((set) => ({
  posts: [],
  nextCursor: null,
  hasMore: true,
  isLoading: false,

  setPosts: (posts, nextCursor, hasMore) =>
    set({ posts, nextCursor, hasMore }),

  appendPosts: (newPosts, nextCursor, hasMore) =>
    set((state) => ({
      posts: [...state.posts, ...newPosts],
      nextCursor,
      hasMore,
    })),

  setIsLoading: (isLoading) => set({ isLoading }),

  clear: () =>
    set({ posts: [], nextCursor: null, hasMore: true, isLoading: false }),
}));
