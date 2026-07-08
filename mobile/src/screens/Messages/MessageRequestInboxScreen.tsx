import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { MessagesStackParamList } from '../../navigation/AppNavigator';
import { getMessageRequestInbox, updateMessageRequestStatus } from '../../services/api';
import type { MessageRequest } from '../../types/conversation';

type Props = NativeStackScreenProps<MessagesStackParamList, 'MessageRequestInbox'>;

/**
 * MessageRequestInboxScreen (MSG-02)
 *
 * Displays pending 1:1 message requests addressed to the authenticated user.
 *
 * Each row shows:
 *   - Sender UID (placeholder until profile-enriched in a future slice)
 *   - Intro preview
 *   - Accept (accent #6200ea) and Decline (destructive #d32f2f) actions
 *
 * Accept: calls updateMessageRequestStatus('accepted') → navigates to DirectMessage
 *         for the returned conversationId.
 * Decline: opens a confirmation modal → "Yes, decline" (red) calls 'declined' + refreshes.
 *
 * Empty state: "No message requests" copy.
 * Destructive buttons include accessibilityLabel naming the consequence.
 *
 * Mirrors HostInboxScreen from plan 02-03.
 */
export default function MessageRequestInboxScreen({ navigation }: Props) {
  const [requests, setRequests] = useState<MessageRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Decline confirmation sheet state
  const [declineTarget, setDeclineTarget] = useState<MessageRequest | null>(null);
  const [declining, setDeclining] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null); // id of request being accepted

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMessageRequestInbox() as { data?: unknown[]; error?: string };
      if (res.data) {
        // Map server shape (_id) to client interface (id)
        const mapped = res.data.map((r: unknown) => {
          const item = r as Record<string, unknown>;
          return {
            id: String(item._id ?? item.id ?? ''),
            senderUid: String(item.senderUid ?? ''),
            intro: String(item.intro ?? ''),
            status: (item.status as MessageRequest['status']) ?? 'pending',
            createdAt: item.createdAt ? String(item.createdAt) : undefined,
          };
        });
        setRequests(mapped);
      } else if (res.error) {
        setError(res.error);
      }
    } catch {
      setError('Failed to load requests. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh the inbox every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadInbox();
    }, [loadInbox])
  );

  async function handleAccept(request: MessageRequest) {
    if (accepting) return;
    setAccepting(request.id);
    try {
      const res = await updateMessageRequestStatus(request.id, 'accepted') as {
        data?: unknown;
        conversationId?: string;
        error?: string;
      };
      if (res.conversationId) {
        // Navigate to the conversation — otherUid is the sender of the request
        navigation.replace('DirectMessage', {
          conversationId: res.conversationId,
          otherUid: request.senderUid,
        });
      } else if (res.error) {
        Alert.alert('Error', res.error);
        await loadInbox();
      }
    } catch {
      Alert.alert('Error', 'Failed to accept request. Please try again.');
    } finally {
      setAccepting(null);
    }
  }

  async function handleDeclineConfirm() {
    if (!declineTarget || declining) return;
    setDeclining(true);
    try {
      await updateMessageRequestStatus(declineTarget.id, 'declined');
      setDeclineTarget(null);
      await loadInbox();
    } catch {
      Alert.alert('Error', 'Failed to decline request. Please try again.');
    } finally {
      setDeclining(false);
    }
  }

  function renderItem({ item }: { item: MessageRequest }) {
    const isAccepting = accepting === item.id;
    return (
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.senderLabel}>From: {item.senderUid}</Text>
          <Text style={styles.introPreview} numberOfLines={3}>
            {item.intro}
          </Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.acceptButton, isAccepting && styles.buttonDisabled]}
            onPress={() => handleAccept(item)}
            disabled={isAccepting || !!accepting}
            accessibilityLabel={`Accept message request from ${item.senderUid}`}
          >
            {isAccepting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.acceptButtonText}>Accept</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.declineButton, (isAccepting || !!accepting) && styles.buttonDisabled]}
            onPress={() => setDeclineTarget(item)}
            disabled={isAccepting || !!accepting}
            accessibilityLabel={`Decline message request from ${item.senderUid} — this cannot be undone`}
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading && requests.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6200ea" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadInbox}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Message requests</Text>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={requests.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No message requests</Text>
            <Text style={styles.emptySubtitle}>
              When someone sends you a message request, it will appear here.
            </Text>
          </View>
        }
        refreshing={loading}
        onRefresh={loadInbox}
      />

      {/* Decline confirmation modal */}
      <Modal
        visible={!!declineTarget}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!declining) setDeclineTarget(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Decline {declineTarget?.senderUid ?? ''}'s request?
            </Text>
            <Text style={styles.modalSubtitle}>
              The sender will be notified that their request was declined.
              This cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.goBackButton}
                onPress={() => setDeclineTarget(null)}
                disabled={declining}
              >
                <Text style={styles.goBackText}>Go back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDeclineButton, declining && styles.buttonDisabled]}
                onPress={handleDeclineConfirm}
                disabled={declining}
                accessibilityLabel="Confirm decline — the sender will be notified"
              >
                {declining ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmDeclineText}>Yes, decline</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    padding: 24,
    paddingBottom: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardContent: {
    marginBottom: 12,
  },
  senderLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  introPreview: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#6200ea',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d32f2f',
  },
  declineButtonText: {
    color: '#d32f2f',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
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
  // Decline confirmation modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  goBackButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  goBackText: {
    color: '#555',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmDeclineButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#d32f2f',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  confirmDeclineText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
