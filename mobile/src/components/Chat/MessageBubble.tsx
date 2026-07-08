import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Message } from '../../types/conversation';

interface Props {
  message: Message;
  /** True when the message was sent by the current user (shown right, own style). */
  isOwn: boolean;
  /** Called with the message when the user taps a failed bubble to retry. */
  onRetry?: (message: Message) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUBBLE_MAX_WIDTH = SCREEN_WIDTH * 0.75; // max 75% per UI-SPEC

/**
 * MessageBubble
 *
 * Renders a single chat message bubble with the UI-SPEC visual treatment:
 *
 *   Own message   — right-aligned, white (#ffffff) with light border (#dddddd)
 *   Other message — left-aligned, light grey (#f5f5f5)
 *
 * Content: Body/16px text.
 * Timestamp: Label/14px muted grey below the content.
 * Max-width: 75% of screen width.
 *
 * Optimistic states (driven by `message.status`):
 *   'sending'  — shows a clock/pending indicator below the content
 *   'delivered' — normal render, no indicator
 *   'failed'   — shows "Message not delivered — tap to retry" in #d32f2f;
 *                 the entire bubble is wrapped in a TouchableOpacity that calls onRetry
 */
export default function MessageBubble({ message, isOwn, onRetry }: Props) {
  const isFailed = message.status === 'failed';
  const isSending = message.status === 'sending';

  const bubbleStyle = [
    styles.bubble,
    isOwn ? styles.ownBubble : styles.otherBubble,
    isFailed && styles.failedBubble,
  ];

  const content = (
    <View style={[styles.wrapper, isOwn ? styles.wrapperRight : styles.wrapperLeft]}>
      <View style={bubbleStyle}>
        <Text style={styles.content}>{message.content}</Text>

        {isSending && (
          <Text style={styles.pendingIndicator}>Sending…</Text>
        )}

        {isFailed && (
          <Text style={styles.failedText}>
            Message not delivered — tap to retry
          </Text>
        )}

        <Text style={styles.timestamp}>
          {formatTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );

  if (isFailed && onRetry) {
    return (
      <TouchableOpacity
        onPress={() => onRetry(message)}
        accessibilityLabel="Message not delivered. Tap to retry sending."
        accessibilityRole="button"
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  wrapperRight: {
    alignItems: 'flex-end',
  },
  wrapperLeft: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: BUBBLE_MAX_WIDTH,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ownBubble: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dddddd',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#f5f5f5',
    borderBottomLeftRadius: 4,
  },
  failedBubble: {
    borderColor: '#d32f2f',
    borderWidth: 1,
  },
  content: {
    fontSize: 16,
    color: '#111',
    lineHeight: 22,
  },
  pendingIndicator: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  failedText: {
    fontSize: 12,
    color: '#d32f2f',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 4,
    textAlign: 'right',
  },
});
