/**
 * PostDetailScreen.tsx — full post view with chronological comments (COMM-02, COMM-03).
 *
 * UI-SPEC (03-UI-SPEC.md, PostDetailScreen):
 *   - Navigation header: "Post" title
 *   - ScrollView (not FlatList — MVP scale) wrapping full PostCard + comments
 *   - Full PostCard at top (text not collapsed, full photo shown)
 *   - "Comments" section header (Heading/20px/600) + count (Label/14px muted)
 *   - CommentRow list (chronological)
 *   - CommentInput fixed at bottom; KeyboardAvoidingView wraps entire screen
 *   - Empty comments: "No comments yet. Start the conversation."
 *   - Optimistic comment append — on error shows 'Comment not posted — tap to retry.'
 *   - If focusComment: true in route params, autofocus the CommentInput on mount
 *
 * Navigated from:
 *   - PostCard onPress (tap anywhere on body)
 *   - PostCard comment affordance (focusComment: true)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommunityStackParamList } from '../../navigation/AppNavigator';
import { getComments, createComment } from '../../services/api';
import { useFeedStore } from '../../store/feedStore';
import type { Comment, Post } from '../../types/community';
import PostCard from '../../components/Community/PostCard';
import CommentRow from '../../components/Community/CommentRow';
import CommentInput, { CommentInputHandle } from '../../components/Community/CommentInput';

type Props = NativeStackScreenProps<CommunityStackParamList, 'PostDetail'>;

export default function PostDetailScreen({ route, navigation }: Props) {
  const { postId, focusComment } = route.params;

  // Try to find the post in the feedStore (warm path) — avoids an extra API call
  const postFromStore = useFeedStore((s) => s.posts.find((p) => p._id === postId));
  const updatePost = useFeedStore((s) => s.updatePost);

  const [post, setPost] = useState<Post | null>(postFromStore ?? null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentError, setCommentError] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const commentInputRef = useRef<CommentInputHandle>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Load comments on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingComments(true);
      try {
        const result = await getComments(postId);
        if (!cancelled && result.data) {
          setComments(result.data);
        }
      } catch {
        // Non-fatal — show empty state
      } finally {
        if (!cancelled) setLoadingComments(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [postId]);

  // Autofocus comment input if navigated with focusComment:true
  useEffect(() => {
    if (focusComment) {
      // Delay slightly so the screen has rendered
      const t = setTimeout(() => commentInputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [focusComment]);

  // Sync post from store if it updates (e.g. optimistic like from this screen)
  useEffect(() => {
    if (postFromStore) {
      setPost(postFromStore);
    }
  }, [postFromStore]);

  const handleSendComment = useCallback(async (text: string) => {
    if (!post) return;
    setCommentError('');
    setSendingComment(true);

    // Optimistic append — placeholder with temp id
    const optimistic: Comment = {
      _id: `temp-${Date.now()}`,
      postId,
      authorUid: 'me', // replaced on server response
      text,
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [...prev, optimistic]);
    // Optimistically bump commentCount in feed store
    updatePost(postId, { commentCount: (post.commentCount ?? 0) + 1 });

    try {
      const result = await createComment(postId, text);
      if (result.data) {
        // Replace optimistic entry with server-confirmed comment (re-fetch keeps it simple)
        const updated = await getComments(postId);
        if (updated.data) setComments(updated.data);
      } else {
        // Revert optimistic comment
        setComments((prev) => prev.filter((c) => c._id !== optimistic._id));
        updatePost(postId, { commentCount: Math.max(0, (post.commentCount ?? 0)) });
        setCommentError('Comment not posted — tap to retry.');
      }
    } catch {
      setComments((prev) => prev.filter((c) => c._id !== optimistic._id));
      updatePost(postId, { commentCount: Math.max(0, (post.commentCount ?? 0)) });
      setCommentError('Comment not posted — tap to retry.');
    } finally {
      setSendingComment(false);
      // Scroll to bottom after comment added
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [post, postId, updatePost]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Full PostCard — text not collapsed, full photo */}
        {post ? (
          <PostCard
            post={{ ...post, text: post.text }} // not collapsed
            onPress={() => {/* already on detail */}}
            onCommentPress={() => commentInputRef.current?.focus()}
          />
        ) : (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#6200ea" />
          </View>
        )}

        {/* Comments section */}
        <View style={styles.commentsHeader}>
          <Text style={styles.commentsTitle}>Comments</Text>
          <Text style={styles.commentsCount}>
            {loadingComments ? '' : `${comments.length}`}
          </Text>
        </View>

        {loadingComments ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#6200ea" />
          </View>
        ) : comments.length === 0 ? (
          <Text style={styles.emptyText}>No comments yet. Start the conversation.</Text>
        ) : (
          comments.map((c) => <CommentRow key={c._id} comment={c} />)
        )}

        {/* Comment error */}
        {commentError ? (
          <TouchableOpacity onPress={() => setCommentError('')} style={styles.errorBox}>
            <Text style={styles.errorText}>{commentError}</Text>
          </TouchableOpacity>
        ) : null}

        {/* Bottom padding for fixed input */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Fixed comment input */}
      <CommentInput
        ref={commentInputRef}
        onSend={handleSendComment}
        disabled={sendingComment}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 60,
  },
  backText: {
    fontSize: 16,
    color: '#6200ea',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111111',
  },
  scrollContent: {
    paddingBottom: 8,
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginTop: 8,
    gap: 8,
  },
  commentsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111111',
  },
  commentsCount: {
    fontSize: 14,
    fontWeight: '400',
    color: '#777777',
  },
  emptyText: {
    fontSize: 14,
    color: '#777777',
    textAlign: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  errorBox: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff5f5',
  },
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
  },
  bottomPadding: {
    height: 16,
  },
});
