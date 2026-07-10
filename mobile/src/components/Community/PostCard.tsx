/**
 * PostCard.tsx — community feed row component (COMM-01, COMM-02, COMM-03).
 *
 * UI-SPEC:
 *   - Author UID / name (Body/16px Semibold) + timestamp (Label/14px muted)
 *   - Post text (Body/16px, max 3 lines collapsed in feed) with #444444 color
 *   - Optional photo (full card width, 200dp tall, resizeMode 'cover')
 *   - Like row: heart-outline icon (muted #777777) + count (Label/14px)
 *   - Comment row: chatbubble-outline icon (muted) + count (Label/14px)
 *   - Report icon (flag-outline, top-right, 44×44dp touch target)
 *   - Tap anywhere on post body → onPress prop
 *
 * Like/comment/report actions are static counts here.
 * Interactive behavior (like toggle, comment navigation, report sheet) wired in 03-02.
 */

import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Post } from '../../types/community';

interface Props {
  post: Post;
  onPress?: () => void;
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

export default function PostCard({ post, onPress }: Props) {
  return (
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
              {post.authorUid.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.authorMeta}>
            <Text style={styles.authorName} numberOfLines={1}>
              {post.authorUid}
            </Text>
            <Text style={styles.timestamp}>
              {formatTimestamp(post.createdAt)}
            </Text>
          </View>
        </View>
        {/* Report icon — 44×44dp touch target (COMM-03, wired in 03-02) */}
        <TouchableOpacity
          style={styles.reportButton}
          accessibilityLabel="Report this post"
          accessibilityRole="button"
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          onPress={() => {/* wired in 03-02 */}}
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

      {/* Action row: likes + comments */}
      <View style={styles.actionRow}>
        <View style={styles.actionItem}>
          <Ionicons
            name="heart-outline"
            size={18}
            color="#777777"
            accessibilityLabel="Like post"
          />
          <Text style={styles.actionCount}>{post.likeCount}</Text>
        </View>
        <View style={styles.actionItem}>
          <Ionicons
            name="chatbubble-outline"
            size={18}
            color="#777777"
            accessibilityLabel="Comments"
          />
          <Text style={styles.actionCount}>{post.commentCount}</Text>
        </View>
      </View>
    </TouchableOpacity>
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
  },
  actionCount: {
    fontSize: 14,
    fontWeight: '400',
    color: '#777777',
  },
});
