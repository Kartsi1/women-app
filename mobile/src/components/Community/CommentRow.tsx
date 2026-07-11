/**
 * CommentRow.tsx — a single comment in the PostDetailScreen comment list (COMM-02).
 *
 * UI-SPEC (03-UI-SPEC.md):
 *   - Avatar (28×28dp) + author name (Body/16px Semibold) + text (Body/16px)
 *   - Timestamp (Label/14px muted)
 *   - Report icon (flag-outline, 44×44dp touch target) — opens report bottom-sheet
 *     with title "Report this comment?"
 *   - No nesting (flat list only)
 *
 * Report uses the existing reportContent() function (contentType 'comment', VERI-07).
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Comment } from '../../types/community';
import type { CommunityStackParamList } from '../../navigation/AppNavigator';
import { reportContent } from '../../services/api';

interface Props {
  comment: Comment;
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

export default function CommentRow({ comment }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<CommunityStackParamList>>();
  const [reportVisible, setReportVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSending, setReportSending] = useState(false);

  const openProfile = () => navigation.navigate('ViewProfile', { uid: comment.authorUid });

  async function handleSubmitReport() {
    if (!reportReason.trim()) return;
    setReportSending(true);
    try {
      await reportContent({
        contentType: 'comment',
        contentId: comment._id,
        reportedUid: comment.authorUid,
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
      <View style={styles.row}>
        {/* Avatar — 28×28dp */}
        <TouchableOpacity style={styles.avatar} onPress={openProfile}>
          <Text style={styles.avatarText}>
            {(comment.authorName || 'Member').charAt(0).toUpperCase()}
          </Text>
        </TouchableOpacity>

        {/* Content */}
        <View style={styles.content}>
          <Text
            style={styles.authorName}
            numberOfLines={1}
            onPress={openProfile}
            accessibilityLabel={`View ${comment.authorName || 'member'}'s profile`}
          >
            {comment.authorName || 'Member'}
          </Text>
          <Text style={styles.commentText}>{comment.text}</Text>
          <Text style={styles.timestamp}>{formatTimestamp(comment.createdAt)}</Text>
        </View>

        {/* Report icon — 44×44dp touch target */}
        <TouchableOpacity
          style={styles.reportButton}
          onPress={() => setReportVisible(true)}
          accessibilityLabel="Report this comment"
          accessibilityRole="button"
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Ionicons name="flag-outline" size={16} color="#aaaaaa" />
        </TouchableOpacity>
      </View>

      {/* Report bottom-sheet */}
      <Modal
        visible={reportVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReportVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Report this comment?</Text>
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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e8d5ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6200ea',
  },
  content: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#111111',
    lineHeight: 22,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 14,
    fontWeight: '400',
    color: '#777777',
  },
  reportButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
