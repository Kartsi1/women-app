/**
 * CommentInput.tsx — fixed bottom comment input row for PostDetailScreen (COMM-02).
 *
 * UI-SPEC (03-UI-SPEC.md):
 *   - Fixed bottom row: TextInput (Body/16px, flex:1, placeholder "Add a comment…")
 *     + send IconButton (Ionicons "send", accent #6200ea)
 *   - Min-height 48px
 *   - KeyboardAvoidingView wrapper (same as ChatInput)
 *   - Send disabled until text non-empty
 *   - Clears input after successful send
 *
 * Mirrors ChatInput.tsx — same layout and behaviour, different placeholder and
 * accessibility labels.
 */

import { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface CommentInputHandle {
  focus: () => void;
}

interface Props {
  /** Called with trimmed comment text when the user sends. */
  onSend: (text: string) => void;
  /** When true the input and send button are disabled (e.g. during network request). */
  disabled?: boolean;
}

const CommentInput = forwardRef<CommentInputHandle, Props>(function CommentInput(
  { onSend, disabled = false },
  ref
) {
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  const canSend = text.trim().length > 0 && !disabled;

  function handleSend() {
    if (!canSend) return;
    const trimmed = text.trim();
    setText('');
    onSend(trimmed);
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
          placeholder="Add a comment…"
          placeholderTextColor="#999"
          multiline
          maxLength={500}
          editable={!disabled}
          returnKeyType="default"
          blurOnSubmit={false}
          accessibilityLabel="Add a comment"
        />
        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend}
          accessibilityLabel="Send comment"
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
});

export default CommentInput;

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
