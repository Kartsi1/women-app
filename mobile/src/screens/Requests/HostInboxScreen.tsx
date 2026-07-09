import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HousingStackParamList } from '../../navigation/AppNavigator';
import { getHostInbox, updateStayRequestStatus } from '../../services/api';
import type { StayRequestData } from '../../services/api';
import RequestCard from '../../components/Requests/RequestCard';

type Props = NativeStackScreenProps<HousingStackParamList, 'HostInbox'>;

/**
 * HostInboxScreen (REQT-02)
 *
 * Shows the authenticated host all incoming stay requests for their listings.
 * Host can accept immediately or open a confirmation sheet before declining.
 *
 * UX patterns:
 *   - ProfileScreen fetch pattern: loading state, error state, FlatList
 *   - Accept: immediate call to updateStayRequestStatus(id, 'accepted'), refresh list
 *   - Decline: confirmation Alert ("Decline this request?" / "Yes, decline" red / "Cancel")
 *             then updateStayRequestStatus(id, 'declined'), refresh list
 *   - Empty state: "No stay requests yet"
 *
 * Security (T-02-03-02): host-only enforcement is server-side in updateRequestStatus.
 */
export default function HostInboxScreen({ navigation }: Props) {
  const [requests, setRequests] = useState<StayRequestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadInbox();
  }, []);

  async function loadInbox() {
    setLoading(true);
    setError(null);
    try {
      const res = await getHostInbox();
      if (res.data) {
        setRequests(res.data);
      } else {
        setError(res.error ?? 'Failed to load inbox.');
      }
    } catch {
      setError('Failed to load inbox. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const handleAccept = useCallback(async (id: string) => {
    setUpdatingId(id);
    try {
      const res = await updateStayRequestStatus(id, 'accepted');
      if (res.error) {
        Alert.alert('Error', 'Could not accept this request. Please try again.');
      } else {
        // Optimistic update — replace the item in the list
        setRequests((prev) =>
          prev.map((r) => (r._id === id ? { ...r, status: 'accepted' as const } : r))
        );
      }
    } catch {
      Alert.alert('Error', 'Could not accept this request. Please try again.');
    } finally {
      setUpdatingId(null);
    }
  }, []);

  const handleDecline = useCallback((id: string) => {
    Alert.alert(
      'Decline request',
      'Decline this stay request? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, decline',
          style: 'destructive',
          onPress: async () => {
            setUpdatingId(id);
            try {
              const res = await updateStayRequestStatus(id, 'declined');
              if (res.error) {
                Alert.alert('Error', 'Could not decline this request. Please try again.');
              } else {
                setRequests((prev) =>
                  prev.map((r) => (r._id === id ? { ...r, status: 'declined' as const } : r))
                );
              }
            } catch {
              Alert.alert('Error', 'Could not decline this request. Please try again.');
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ]
    );
  }, []);

  if (loading) {
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
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadInbox}
          accessibilityLabel="Retry"
          accessibilityRole="button"
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Stay requests</Text>
      </View>

      {/* List */}
      {updatingId && (
        <View style={styles.updatingBanner}>
          <ActivityIndicator size="small" color="#6200ea" />
          <Text style={styles.updatingText}>Updating…</Text>
        </View>
      )}

      <FlatList
        data={requests}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <RequestCard
            request={item}
            onAccept={handleAccept}
            onDecline={handleDecline}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>No stay requests yet</Text>
            <Text style={styles.emptySubtitle}>
              When guests request a stay at your listing, they will appear here.
            </Text>
          </View>
        }
        onRefresh={loadInbox}
        refreshing={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: 24,
  },
  header: {
    backgroundColor: '#ffffff',
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  backButton: {
    marginBottom: 4,
    minHeight: 36,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: '#6200ea',
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111111',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: {
    fontSize: 14,
    color: '#6200ea',
  },
  updatingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ede7f6',
    paddingVertical: 8,
    gap: 8,
  },
  updatingText: {
    fontSize: 13,
    color: '#6200ea',
    fontWeight: '500',
  },
});
