import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { MessagesStackParamList } from '../../navigation/AppNavigator';
import { listConversations } from '../../services/api';
import { useConversationStore } from '../../store/conversationStore';
import { useAuthStore } from '../../store/authStore';
import type { Conversation } from '../../types/conversation';

type Props = NativeStackScreenProps<MessagesStackParamList, 'ConversationList'>;

/**
 * ConversationListScreen (MSG-03)
 *
 * Root screen of the Messages tab. Replaces MessagesPlaceholderScreen (plan 02-01).
 * Shows all accepted 1:1 conversations for the authenticated user, sorted by
 * most recently active first.
 *
 * Header entry point navigates to MessageRequestInbox.
 * Each row taps to DirectMessageScreen.
 * Empty state: "No conversations yet" + CTA to visit a profile.
 *
 * Fetches on mount and on every tab focus via useFocusEffect.
 */
export default function ConversationListScreen({ navigation }: Props) {
  const { conversations, setConversations } = useConversationStore();
  const currentUserUid = useAuthStore((s) => s.user?.uid);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listConversations() as { data?: unknown[]; error?: string };
      if (res.data) {
        const mapped: Conversation[] = (res.data as Record<string, unknown>[]).map((c) => ({
          id: String(c._id ?? c.id ?? ''),
          participants: Array.isArray(c.participants)
            ? (c.participants as string[])
            : [],
          lastMessageAt: c.lastMessageAt ? String(c.lastMessageAt) : undefined,
          lastMessagePreview: c.lastMessagePreview ? String(c.lastMessagePreview) : undefined,
        }));
        setConversations(mapped);
      } else if (res.error) {
        setError(res.error);
      }
    } catch {
      setError('Failed to load conversations.');
    } finally {
      setLoading(false);
    }
  }, [setConversations]);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  function getOtherUid(conversation: Conversation): string {
    return conversation.participants.find((p) => p !== currentUserUid) ?? '';
  }

  function renderItem({ item }: { item: Conversation }) {
    const otherUid = getOtherUid(item);
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() =>
          navigation.navigate('DirectMessage', {
            conversationId: item.id,
            otherUid,
          })
        }
        accessibilityLabel={`Open conversation with ${otherUid}`}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{otherUid.slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={styles.rowContent}>
          <Text style={styles.participantName} numberOfLines={1}>
            {otherUid}
          </Text>
          {!!item.lastMessagePreview && (
            <Text style={styles.preview} numberOfLines={1}>
              {item.lastMessagePreview}
            </Text>
          )}
        </View>
        {!!item.lastMessageAt && (
          <Text style={styles.timestamp}>
            {new Date(item.lastMessageAt).toLocaleDateString()}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header row with inbox entry point */}
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <TouchableOpacity
          style={styles.inboxButton}
          onPress={() => navigation.navigate('MessageRequestInbox')}
          accessibilityLabel="Open message requests inbox"
        >
          <Text style={styles.inboxButtonText}>Requests</Text>
        </TouchableOpacity>
      </View>

      {/* City chat entry — always visible above the conversations list (02-05, MSG-04) */}
      <TouchableOpacity
        style={styles.cityChatRow}
        onPress={() => navigation.navigate('CityGroupChat')}
        accessibilityLabel="Open city group chat"
        accessibilityRole="button"
      >
        <View style={styles.cityAvatar}>
          <Text style={styles.cityAvatarIcon}>🏙</Text>
        </View>
        <View style={styles.cityRowContent}>
          <Text style={styles.cityChatTitle}>City chat</Text>
          <Text style={styles.cityChatSubtitle}>Connect with women in your city</Text>
        </View>
      </TouchableOpacity>

      {loading && conversations.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6200ea" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadConversations}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={
            conversations.length === 0 ? styles.emptyContainer : styles.listContent
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySubtitle}>
                Visit a member's profile to send a message request.
              </Text>
            </View>
          }
          refreshing={loading}
          onRefresh={loadConversations}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
  },
  inboxButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f3f0ff',
    borderRadius: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  inboxButtonText: {
    color: '#6200ea',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e8e0ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#6200ea',
    fontWeight: '700',
    fontSize: 14,
  },
  rowContent: {
    flex: 1,
    marginRight: 8,
  },
  participantName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  preview: {
    fontSize: 13,
    color: '#666',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorText: {
    fontSize: 15,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#6200ea',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  // City chat entry (02-05, MSG-04)
  cityChatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: '#e8e0ff',
    backgroundColor: '#faf8ff',
  },
  cityAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6200ea',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cityAvatarIcon: {
    fontSize: 20,
  },
  cityRowContent: {
    flex: 1,
  },
  cityChatTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6200ea',
    marginBottom: 2,
  },
  cityChatSubtitle: {
    fontSize: 13,
    color: '#666',
  },
});
