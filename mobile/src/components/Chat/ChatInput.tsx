import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  /** Called with the trimmed message text when the user submits. */
  onSend: (text: string) => void;
  /** When true the input and send button are disabled. */
  disabled?: boolean;
}

/**
 * ChatInput
 *
 * Fixed-bottom chat input row per UI-SPEC:
 *   - KeyboardAvoidingView wrapper so the input rises with the software keyboard
 *   - Multiline TextInput (Body/16px, flex:1) with transparent placeholder
 *   - Send IconButton (Ionicons "send", accent #6200ea, min 44×44dp)
 *   - Min-height 48dp for the input row
 *   - Disabled/no-op when the input is empty (send button hidden/inactive)
 *   - Clears the input after successful onSend call
 *
 * Exposed via the `onSend(text)` prop — the parent screen handles the
 * socket emit and optimistic state update.
 */
export default function ChatInput({ onSend, disabled = false }: Props) {
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const canSend = text.trim().length > 0 && !disabled;

  function handleSend() {
    if (!canSend) return;
    const trimmed = text.trim();
    setText('');
    onSend(trimmed);
    // Re-focus so the user can keep typing
    inputRef.current?.focus();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.row}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message…"
          placeholderTextColor="#bbb"
          multiline
          maxLength={2000}
          editable={!disabled}
          returnKeyType="default"
          blurOnSubmit={false}
          accessibilityLabel="Type a message"
        />
        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend}
          accessibilityLabel="Send message"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSend }}
        >
          <Ionicons
            name="send"
            size={22}
            color={canSend ? '#6200ea' : '#ccc'}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111',
    lineHeight: 22,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
