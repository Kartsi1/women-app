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
  /**
   * Shallow-merge a patch into the post with the given id.
   * Used for optimistic like count updates (03-02, COMM-03):
   *   updatePost(postId, { likeCount: post.likeCount + 1, liked: true })
   * On error the caller should revert by calling updatePost again with the original values.
   */
  updatePost: (id: string, patch: Partial<Post>) => void;
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

  updatePost: (id, patch) =>
    set((state) => ({
      posts: state.posts.map((p) =>
        String(p._id) === String(id) ? { ...p, ...patch } : p
      ),
    })),

  clear: () =>
    set({ posts: [], nextCursor: null, hasMore: true, isLoading: false }),
}));
