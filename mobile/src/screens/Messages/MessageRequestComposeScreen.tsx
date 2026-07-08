import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MessagesStackParamList } from '../../navigation/AppNavigator';
import { sendMessageRequest } from '../../services/api';

type Props = NativeStackScreenProps<MessagesStackParamList, 'MessageRequestCompose'>;

const MAX_INTRO_LENGTH = 2000;

/**
 * MessageRequestComposeScreen (MSG-01)
 *
 * Allows a verified user to send a 1:1 message request to another verified
 * user. The request includes a required intro text (max 2000 chars).
 *
 * Accessed from ViewProfileScreen via the "Send message request" button.
 *
 * UX:
 *   - Intro TextInput with live character count
 *   - "Send message request" button disabled until intro is non-empty
 *   - "Sending…" at opacity 0.6 while in-flight
 *   - Inline error below the button for failure and distinct 409 text
 *   - Navigates back on success
 *
 * Security (T-02-04-03): recipientUid comes from the route param (set by
 * ViewProfileScreen, which learned it from the backend); senderUid is derived
 * from the verified token on the backend — the client never sends it.
 */
export default function MessageRequestComposeScreen({ route, navigation }: Props) {
  const { recipientUid } = route.params;

  const [intro, setIntro] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = intro.trim().length > 0 && !sending;

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const res = await sendMessageRequest(recipientUid, intro.trim()) as {
        data?: unknown;
        error?: string;
        status?: number;
      };

      if ('error' in res && res.error) {
        // 409 — duplicate pair or already connected
        if (
          res.error.toLowerCase().includes('already') ||
          res.error.toLowerCase().includes('duplicate')
        ) {
          setError('You already have a pending or accepted request with this user.');
        } else {
          setError('Request not sent. Please try again.');
        }
      } else {
        // Success — navigate back to the profile
        navigation.goBack();
      }
    } catch {
      setError('Request not sent. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Send message request</Text>
        <Text style={styles.subtitle}>
          Introduce yourself. The recipient will see this before deciding whether to chat.
        </Text>

        <Text style={styles.label}>Introduction</Text>
        <TextInput
          style={styles.introInput}
          value={intro}
          onChangeText={setIntro}
          placeholder="Write a brief introduction…"
          placeholderTextColor="#999"
          multiline
          maxLength={MAX_INTRO_LENGTH}
          textAlignVertical="top"
          editable={!sending}
          accessibilityLabel="Message request introduction"
        />
        <Text style={[styles.charCount, intro.length > MAX_INTRO_LENGTH - 100 && styles.charCountWarn]}>
          {intro.length}/{MAX_INTRO_LENGTH}
        </Text>

        {!!error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        <TouchableOpacity
          style={[styles.sendButton, (!canSend) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend}
          accessibilityLabel="Send message request"
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send message request</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  introInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    color: '#111',
    backgroundColor: '#fafafa',
    minHeight: 140,
    marginBottom: 4,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginBottom: 8,
  },
  charCountWarn: {
    color: '#e65100',
  },
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
    marginBottom: 12,
    textAlign: 'center',
  },
  sendButton: {
    backgroundColor: '#6200ea',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
