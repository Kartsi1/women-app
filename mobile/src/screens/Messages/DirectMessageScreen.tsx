import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MessagesStackParamList } from '../../navigation/AppNavigator';
import { getConversationMessages } from '../../services/api';
import { connectSocket, getSocket } from '../../services/socketService';
import { useConversationStore } from '../../store/conversationStore';
import { useAuthStore } from '../../store/authStore';
import type { Message } from '../../types/conversation';
import MessageBubble from '../../components/Chat/MessageBubble';
import ChatInput from '../../components/Chat/ChatInput';

type Props = NativeStackScreenProps<MessagesStackParamList, 'DirectMessage'>;

/**
 * DirectMessageScreen (MSG-03, MSG-05)
 *
 * Real-time 1:1 chat screen. First real-time screen in the codebase built on
 * top of the authenticated socket from plan 02-01.
 *
 * Lifecycle:
 *   1. Fetch history via api.getConversationMessages → store.setActiveMessages
 *   2. Await connectSocket() (idempotent — returns existing if already open)
 *   3. Emit join:dm { otherUid } to enter the DM room
 *   4. Register message:new listener → store.appendMessage (dedupes optimistic entries)
 *   5. On unmount: socket.off('message:new'), socket.off('message:error'),
 *      emit leave:dm { otherUid } (explicit mid-session leave per locked decision)
 *      — do NOT call disconnectSocket() — the socket is shared and stays open
 *
 * Send flow (store-first optimistic):
 *   1. Append optimistic message (status='sending') with a temp id
 *   2. Emit message:dm { otherUid, content }
 *   3. message:new from server replaces the optimistic entry (matched by content+senderUid)
 *   4. message:error marks the optimistic entry failed → tap-to-retry affordance
 *
 * Push deep-link: Expo Notifications link data.type='dm_message' with conversationId
 * opens this screen (handled by RootNavigator in a future slice; the param structure
 * is ready here).
 *
 * Security (T-02-04-01, T-02-04-02, T-02-04-03):
 *   - All auth and gate enforcement happens on the server; the client only emits events
 *   - senderUid for own messages is taken from authStore (same uid the server trusts
 *     from the socket token), not hardcoded in events
 */
export default function DirectMessageScreen({ route, navigation }: Props) {
  const { conversationId, otherUid } = route.params;
  const currentUserUid = useAuthStore((s) => s.user?.uid) ?? '';

  const { activeMessages, appendMessage, setActiveMessages } = useConversationStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tracks failed optimistic message temp ids for retry
  const optimisticRef = useRef<Map<string, string>>(new Map()); // tempId → content

  // ── History fetch + socket setup ──────────────────────────────────────────

  const setupChat = useCallback(async () => {
    // 1. Fetch history
    try {
      const res = await getConversationMessages(conversationId) as {
        data?: unknown[];
        error?: string;
      };
      if (res.data) {
        const mapped: Message[] = (res.data as Record<string, unknown>[]).map((m) => ({
          id: String(m._id ?? m.id ?? ''),
          conversationId,
          senderUid: String(m.senderUid ?? ''),
          content: String(m.content ?? ''),
          createdAt: String(m.createdAt ?? new Date().toISOString()),
          status: 'delivered' as const,
        }));
        setActiveMessages(mapped);
      }
    } catch {
      setError('Failed to load messages. Pull to refresh.');
    } finally {
      setLoading(false);
    }

    // 2. Connect socket (idempotent)
    const socket = await connectSocket();

    // 3. Join DM room
    socket.emit('join:dm', { otherUid });

    // 4. Listen for new messages
    const onMessageNew = (data: Record<string, unknown>) => {
      const incoming: Message = {
        id: String(data._id ?? ''),
        conversationId: String(data.conversationId ?? conversationId),
        senderUid: String(data.senderUid ?? ''),
        content: String(data.content ?? ''),
        createdAt: String(data.createdAt ?? new Date().toISOString()),
        status: 'delivered',
      };
      appendMessage(incoming);
    };

    const onMessageError = () => {
      // Mark the most recent 'sending' optimistic entry as failed
      useConversationStore.setState((state) => ({
        activeMessages: state.activeMessages.map((m) =>
          m.status === 'sending' ? { ...m, status: 'failed' } : m
        ),
      }));
    };

    socket.on('message:new', onMessageNew);
    socket.on('message:error', onMessageError);

    // Return cleanup
    return () => {
      socket.off('message:new', onMessageNew);
      socket.off('message:error', onMessageError);
      socket.emit('leave:dm', { otherUid });
    };
  }, [conversationId, otherUid, appendMessage, setActiveMessages]);

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
    const tempId = `opt_${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      conversationId,
      senderUid: currentUserUid,
      content,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };
    appendMessage(optimistic);
    optimisticRef.current.set(tempId, content);

    socket.emit('message:dm', { otherUid, content });
  }

  function handleRetry(message: Message) {
    const socket = getSocket();
    if (!socket?.connected || !message.content) return;

    // Reset status to sending and re-emit
    useConversationStore.setState((state) => ({
      activeMessages: state.activeMessages.map((m) =>
        m.id === message.id ? { ...m, status: 'sending' } : m
      ),
    }));
    socket.emit('message:dm', { otherUid, content: message.content });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6200ea" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header: back + tap to view the other member's profile */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Text style={styles.headerBack}>‹ Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('ViewProfile', { uid: otherUid })}
          accessibilityLabel="View profile"
        >
          <Text style={styles.headerProfile}>View profile</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Inverted FlatList — newest at bottom (standard chat layout) */}
      <FlatList
        data={activeMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            isOwn={item.senderUid === currentUserUid}
            onRetry={handleRetry}
          />
        )}
        inverted
        contentContainerStyle={styles.messageList}
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
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerBack: {
    fontSize: 16,
    color: '#6200ea',
    fontWeight: '600',
  },
  headerProfile: {
    fontSize: 15,
    color: '#6200ea',
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorBanner: {
    backgroundColor: '#ffebee',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 13,
    textAlign: 'center',
  },
});
