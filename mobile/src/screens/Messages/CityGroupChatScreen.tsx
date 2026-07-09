import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MessagesStackParamList } from '../../navigation/AppNavigator';
import { getCityInfo, getCityMessages } from '../../services/api';
import { connectSocket, getSocket } from '../../services/socketService';
import { useConversationStore } from '../../store/conversationStore';
import { useAuthStore } from '../../store/authStore';
import type { Message, CityInfo } from '../../types/conversation';
import MessageBubble from '../../components/Chat/MessageBubble';
import ChatInput from '../../components/Chat/ChatInput';

type Props = NativeStackScreenProps<MessagesStackParamList, 'CityGroupChat'>;

/**
 * CityGroupChatScreen (MSG-04, MSG-05)
 *
 * Real-time city group chat. Mirrors DirectMessageScreen (02-04) in structure
 * but without the MessageRequest gate — any verified user with a homeCity set
 * can join and post in their city room.
 *
 * Security (T-02-05-01): We emit join:city with NO citySlug — the server derives
 * the city from the authenticated user's own profile. The client NEVER supplies
 * a citySlug in any event payload.
 *
 * Security (T-02-05-04): message:new listener filters by citySlug to ensure only
 * messages from the user's own city are appended to cityMessages. The scope
 * discriminator in the payload is the authoritative signal.
 *
 * Lifecycle:
 *   1. Fetch city info via api.getCityInfo → store.setCityInfo
 *   2. If citySlug is null → render set-your-city empty state (no socket work)
 *   3. Fetch history via api.getCityMessages → store.setCityMessages
 *   4. Await connectSocket() (idempotent — returns existing if already open)
 *   5. Emit join:city (NO citySlug — T-02-05-01)
 *   6. Register message:new listener → appendCityMessage only when event.citySlug
 *      matches own citySlug (T-02-05-04, scope filter)
 *   7. On unmount: socket.off('message:new'), socket.off('message:error'),
 *      emit leave:city (explicit mid-session leave — do NOT call disconnectSocket())
 *
 * Send flow (store-first optimistic):
 *   1. Append optimistic message (status='sending') with a temp id
 *   2. Emit message:city { content } — NO citySlug (T-02-05-01)
 *   3. Server writes store-first then echoes message:new → confirms/replaces optimistic entry
 *   4. message:error marks the optimistic entry failed → tap-to-retry affordance
 *
 * Push deep-link: Expo Notifications with data.type='city_message' and data.citySlug
 * opens this screen (handled via useFirebaseAuth navigationRef deep-link flow).
 */
export default function CityGroupChatScreen(_props: Props) {
  const currentUserUid = useAuthStore((s) => s.user?.uid) ?? '';
  const { cityInfo, cityMessages, setCityInfo, setCityMessages, appendCityMessage } =
    useConversationStore();

  const [loading, setLoading] = useState(true);
  const [cityLoadError, setCityLoadError] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);

  // Ref to hold the resolved citySlug for use inside stable socket callbacks
  const citySlugRef = useRef<string | null>(null);

  // ── City info + history + socket setup ────────────────────────────────────

  const setupChat = useCallback(async () => {
    // 1. Fetch city info
    let resolvedCityInfo: CityInfo | null = null;
    try {
      const res = await getCityInfo();
      if (res.data) {
        resolvedCityInfo = res.data;
        setCityInfo(res.data);
        citySlugRef.current = res.data.citySlug;
      } else if (res.error) {
        setCityLoadError(res.error);
        setLoading(false);
        return undefined;
      }
    } catch {
      setCityLoadError('Failed to load city info. Please try again.');
      setLoading(false);
      return undefined;
    }

    // 2. If no citySlug — render the set-your-city empty state and stop here
    if (!resolvedCityInfo?.citySlug) {
      setLoading(false);
      return undefined;
    }

    // 3. Fetch city message history
    try {
      const res = await getCityMessages();
      if (res.data) {
        const mapped: Message[] = res.data.map((m) => {
          const raw = m as unknown as Record<string, unknown>;
          return {
            id: String(raw._id ?? raw.id ?? ''),
            senderUid: String(raw.senderUid ?? ''),
            senderName: raw.senderName ? String(raw.senderName) : undefined,
            content: String(raw.content ?? ''),
            createdAt: String(raw.createdAt ?? new Date().toISOString()),
            citySlug: String(raw.citySlug ?? resolvedCityInfo!.citySlug),
            status: 'delivered' as const,
          };
        });
        setCityMessages(mapped);
      }
    } catch {
      // History load failure is non-fatal — the user can still chat live
    } finally {
      setLoading(false);
    }

    // 4. Connect socket (idempotent)
    const socket = await connectSocket();

    // 5. Emit join:city — NO citySlug (T-02-05-01)
    socket.emit('join:city');

    // Track member count from joined:city acknowledgement
    const onJoinedCity = (data: Record<string, unknown>) => {
      if (typeof data.memberCount === 'number') {
        setMemberCount(data.memberCount);
      }
    };
    socket.on('joined:city', onJoinedCity);

    // 6. Listen for new messages — filter by citySlug (T-02-05-04)
    const onMessageNew = (data: Record<string, unknown>) => {
      const incomingCitySlug = String(data.citySlug ?? '');
      // Scope filter: only append if this message belongs to our city (T-02-05-04)
      if (!incomingCitySlug || incomingCitySlug !== citySlugRef.current) return;

      const incoming: Message = {
        id: String(data._id ?? ''),
        senderUid: String(data.senderUid ?? ''),
        senderName: data.senderName ? String(data.senderName) : undefined,
        content: String(data.content ?? ''),
        createdAt: String(data.createdAt ?? new Date().toISOString()),
        citySlug: incomingCitySlug,
        status: 'delivered',
      };
      appendCityMessage(incoming);
    };

    const onMessageError = () => {
      // Mark the most recent 'sending' optimistic city entry as failed
      useConversationStore.setState((state) => ({
        cityMessages: state.cityMessages.map((m) =>
          m.status === 'sending' ? { ...m, status: 'failed' } : m
        ),
      }));
    };

    socket.on('message:new', onMessageNew);
    socket.on('message:error', onMessageError);

    // Return cleanup (called on unmount)
    return () => {
      socket.off('message:new', onMessageNew);
      socket.off('message:error', onMessageError);
      socket.off('joined:city', onJoinedCity);
      // Explicit mid-session leave (locked decision — avoids zombie city rooms)
      // Do NOT call disconnectSocket() — the socket is shared across all screens
      socket.emit('leave:city');
    };
  }, [setCityInfo, setCityMessages, appendCityMessage]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    setupChat().then((fn) => {
      cleanup = fn;
    });
    return () => {
      if (cleanup) cleanup();
    };
  }, [setupChat]);

  // ── Send ──────────────────────────────────────────────────────────────────

  function handleSend(content: string) {
    const socket = getSocket();
    if (!socket?.connected) return;

    // Optimistic bubble
    const tempId = `opt_city_${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      senderUid: currentUserUid,
      senderName: undefined, // own messages don't show the sender label
      content,
      createdAt: new Date().toISOString(),
      citySlug: citySlugRef.current ?? undefined,
      status: 'sending',
    };
    appendCityMessage(optimistic);

    // Emit message:city with content ONLY — NO citySlug (T-02-05-01)
    socket.emit('message:city', { content });
  }

  function handleRetry(message: Message) {
    const socket = getSocket();
    if (!socket?.connected || !message.content) return;

    // Reset status to sending and re-emit
    useConversationStore.setState((state) => ({
      cityMessages: state.cityMessages.map((m) =>
        m.id === message.id ? { ...m, status: 'sending' } : m
      ),
    }));
    socket.emit('message:city', { content: message.content });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6200ea" />
      </View>
    );
  }

  // Error state
  if (cityLoadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{cityLoadError}</Text>
      </View>
    );
  }

  // Set-your-city empty state — user has no homeCity set
  if (!cityInfo?.citySlug) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>City Chat</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Set your home city to join the chat</Text>
          <Text style={styles.emptySubtitle}>
            Go to your profile and update your home city to connect with women in your area.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header: city name + optional member count */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>City: {cityInfo.homeCity}</Text>
        {memberCount !== null && (
          <Text style={styles.memberCount}>{memberCount} online</Text>
        )}
      </View>

      {/* Inverted FlatList — newest at bottom (standard chat layout) */}
      <FlatList
        data={cityMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            isOwn={item.senderUid === currentUserUid}
            onRetry={handleRetry}
            senderName={item.senderUid !== currentUserUid ? item.senderName : undefined}
          />
        )}
        inverted
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              Be the first to say hi in {cityInfo.homeCity} chat.
            </Text>
          </View>
        }
      />

      <ChatInput onSend={handleSend} />
    </KeyboardAvoidingView>
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
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  memberCount: {
    fontSize: 14,      // Label/14px per UI-SPEC
    color: '#777777',  // body-muted per UI-SPEC
    marginTop: 2,
  },
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111',
    textAlign: 'center',
    marginBottom: 8,
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
  },
});
