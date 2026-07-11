/**
 * PostCard.tsx — community feed row component (COMM-01, COMM-02, COMM-03).
 *
 * UI-SPEC:
 *   - Author UID / name (Body/16px Semibold) + timestamp (Label/14px muted)
 *   - Post text (Body/16px, max 3 lines collapsed in feed) with #444444 color
 *   - Optional photo (full card width, 200dp tall, resizeMode 'cover')
 *   - Like row: heart-outline #777777 (unliked) / heart #6200ea (liked) + count (Label/14px)
 *   - Comment affordance: chatbubble-outline + count — navigates to PostDetail with focusComment
 *   - Report icon (flag-outline, top-right, 44×44dp touch target) — opens report bottom-sheet
 *   - Tap anywhere on post body → onPress prop
 *
 * Like is optimistic (03-02, COMM-03): optimistically updates feedStore → calls API →
 *   on error reverts and shows 'Couldn't update like. Try again.'
 * Report uses existing reportUser() with contentType 'post' (VERI-07 report flow).
 */

import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Post } from '../../types/community';
import { toggleLike, reportContent } from '../../services/api';
import { useFeedStore } from '../../store/feedStore';
import { useAuthStore } from '../../store/authStore';

interface Props {
  post: Post;
  onPress?: () => void;
  /** Navigate to PostDetail with keyboard focused on comment input */
  onCommentPress?: () => void;
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function PostCard({ post, onPress, onCommentPress }: Props) {
  const { user } = useAuthStore();
  const updatePost = useFeedStore((s) => s.updatePost);

  // Report bottom-sheet state
  const [reportVisible, setReportVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [likeError, setLikeError] = useState('');

  const isLiked = !!(user && post.likedBy?.includes(user.uid));

  // ---------------------------------------------------------------------------
  // Like toggle — optimistic update (T-03-02-01 idempotency is server-side)
  // ---------------------------------------------------------------------------
  async function handleLike() {
    if (!user) return;

    // Capture original state for potential revert
    const originalLikeCount = post.likeCount;
    const originalLikedBy = post.likedBy ?? [];

    // Optimistic update
    const newLiked = !isLiked;
    const newLikeCount = newLiked ? originalLikeCount + 1 : Math.max(0, originalLikeCount - 1);
    const newLikedBy = newLiked
      ? [...originalLikedBy, user.uid]
      : originalLikedBy.filter((uid) => uid !== user.uid);
    updatePost(post._id, { likeCount: newLikeCount, likedBy: newLikedBy });
    setLikeError('');

    try {
      const result = await toggleLike(post._id);
      if (result.data) {
        // Sync with server's authoritative count
        updatePost(post._id, {
          likeCount: result.data.likeCount,
          likedBy: result.data.liked
            ? [...(post.likedBy ?? []).filter((uid) => uid !== user.uid), user.uid]
            : (post.likedBy ?? []).filter((uid) => uid !== user.uid),
        });
      } else {
        // Revert
        updatePost(post._id, { likeCount: originalLikeCount, likedBy: originalLikedBy });
        setLikeError("Couldn't update like. Try again.");
      }
    } catch {
      // Revert on network error
      updatePost(post._id, { likeCount: originalLikeCount, likedBy: originalLikedBy });
      setLikeError("Couldn't update like. Try again.");
    }
  }

  // ---------------------------------------------------------------------------
  // Report submission
  // ---------------------------------------------------------------------------
  async function handleSubmitReport() {
    if (!reportReason.trim()) return;
    setReportSending(true);
    try {
      await reportContent({
        contentType: 'post',
        contentId: post._id,
        reportedUid: post.authorUid,
        reason: reportReason.trim(),
      });
      setReportVisible(false);
      setReportReason('');
      Alert.alert('', "Report sent. We'll review it.");
    } catch {
      Alert.alert('Error', 'Failed to send report. Please try again.');
    } finally {
      setReportSending(false);
    }
  }

  return (
    <>
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="View post"
      >
        {/* Header row: author + timestamp + report icon */}
        <View style={styles.header}>
          <View style={styles.authorInfo}>
            {/* Avatar placeholder — 36×36dp */}
            <View style={styles.avatar} accessibilityLabel="Author avatar">
              <Text style={styles.avatarText}>
                {(post.authorName || 'Member').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.authorMeta}>
              <Text style={styles.authorName} numberOfLines={1}>
                {post.authorName || 'Member'}
              </Text>
              <Text style={styles.timestamp}>
                {formatTimestamp(post.createdAt)}
              </Text>
            </View>
          </View>
          {/* Report icon — 44×44dp touch target (COMM-03) */}
          <TouchableOpacity
            style={styles.reportButton}
            accessibilityLabel="Report this post"
            accessibilityRole="button"
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            onPress={() => setReportVisible(true)}
          >
            <Ionicons name="flag-outline" size={18} color="#777777" />
          </TouchableOpacity>
        </View>

        {/* Post text — max 3 lines collapsed in feed */}
        <Text style={styles.postText} numberOfLines={3}>
          {post.text}
        </Text>

        {/* Optional photo — full card width, 200dp tall */}
        {post.photoUrl ? (
          <Image
            source={{ uri: post.photoUrl }}
            style={styles.photo}
            resizeMode="cover"
            accessibilityLabel="Post photo"
          />
        ) : null}

        {/* Like error (transient) */}
        {likeError ? (
          <Text style={styles.likeError}>{likeError}</Text>
        ) : null}

        {/* Action row: likes + comments */}
        <View style={styles.actionRow}>
          {/* Like button — interactive toggle with optimistic update */}
          <TouchableOpacity
            style={styles.actionItem}
            onPress={handleLike}
            accessibilityLabel={isLiked ? 'Unlike post' : 'Like post'}
            accessibilityRole="button"
            accessibilityState={{ selected: isLiked }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={18}
              color={isLiked ? '#6200ea' : '#777777'}
            />
            <Text style={styles.actionCount}>{post.likeCount}</Text>
          </TouchableOpacity>

          {/* Comment affordance — navigates to PostDetail (focusComment: true) */}
          <TouchableOpacity
            style={styles.actionItem}
            onPress={onCommentPress}
            accessibilityLabel="Add a comment"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chatbubble-outline" size={18} color="#777777" />
            <Text style={styles.actionCount}>{post.commentCount}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Report bottom-sheet — Modal */}
      <Modal
        visible={reportVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReportVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Report this post?</Text>
            <TextInput
              style={styles.reasonInput}
              value={reportReason}
              onChangeText={setReportReason}
              placeholder="What's the problem?"
              placeholderTextColor="#999"
              multiline
              accessibilityLabel="Report reason"
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!reportReason.trim() || reportSending) && styles.sendButtonDisabled,
              ]}
              onPress={handleSubmitReport}
              disabled={!reportReason.trim() || reportSending}
              accessibilityRole="button"
              accessibilityLabel="Send report"
            >
              <Text style={styles.sendButtonText}>
                {reportSending ? 'Sending…' : 'Send report'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => { setReportVisible(false); setReportReason(''); }}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e8d5ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6200ea',
  },
  authorMeta: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  timestamp: {
    fontSize: 14,
    fontWeight: '400',
    color: '#777777',
    marginTop: 1,
  },
  reportButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#444444',
    lineHeight: 24,
    marginBottom: 8,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  likeError: {
    fontSize: 12,
    color: '#d32f2f',
    marginBottom: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    minWidth: 44,
  },
  actionCount: {
    fontSize: 14,
    fontWeight: '400',
    color: '#777777',
  },
  // Report bottom-sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 16,
    textAlign: 'center',
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111',
    minHeight: 80,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  sendButton: {
    backgroundColor: '#6200ea',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: '#777777',
    fontSize: 16,
  },
});
