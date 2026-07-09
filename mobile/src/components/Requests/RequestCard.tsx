import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { StayRequestData } from '../../services/api';

interface Props {
  request: StayRequestData;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

/**
 * RequestCard (REQT-02)
 *
 * Renders a single stay request in the host inbox.
 *
 * Layout:
 *   - Guest UID (shortened) + date range
 *   - Intro preview (2 lines)
 *   - Status badge — green "Accepted" when accepted (hides action buttons)
 *   - Accept button (accent #6200ea) + Decline button (destructive #d32f2f)
 *
 * Security (T-02-03-02):
 *   The server enforces host-only accept/decline — these buttons only call the API.
 *   The UI also only appears in HostInboxScreen which is only reachable after sign-in.
 *
 * Accessibility:
 *   Decline button includes accessibilityLabel naming the consequence.
 */
export default function RequestCard({ request, onAccept, onDecline }: Props) {
  const checkInStr = new Date(request.checkIn).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const checkOutStr = new Date(request.checkOut).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const guestDisplay = request.guestUid.slice(0, 8) + '…';

  return (
    <View style={styles.card}>
      {/* Guest + dates */}
      <View style={styles.headerRow}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{request.guestUid[0].toUpperCase()}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.guestLabel}>{guestDisplay}</Text>
          <Text style={styles.dateRange}>{checkInStr} → {checkOutStr}</Text>
        </View>
        {/* Status badge */}
        {request.status === 'accepted' && (
          <View style={styles.acceptedBadge}>
            <Text style={styles.acceptedBadgeText}>Accepted</Text>
          </View>
        )}
        {request.status === 'declined' && (
          <View style={styles.declinedBadge}>
            <Text style={styles.declinedBadgeText}>Declined</Text>
          </View>
        )}
      </View>

      {/* Intro preview */}
      <Text style={styles.intro} numberOfLines={2}>{request.intro}</Text>

      {/* Action buttons — hidden once a decision has been made */}
      {request.status === 'pending' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => onAccept(request._id)}
            accessibilityLabel="Accept this stay request"
            accessibilityRole="button"
          >
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.declineButton}
            onPress={() => onDecline(request._id)}
            accessibilityLabel="Decline this stay request — this action cannot be undone"
            accessibilityRole="button"
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eeeeee',
    padding: 16,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8eaf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6200ea',
  },
  headerInfo: {
    flex: 1,
  },
  guestLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    fontFamily: 'monospace' as const,
  },
  dateRange: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
  acceptedBadge: {
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  acceptedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2e7d32',
  },
  declinedBadge: {
    backgroundColor: '#fce4ec',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  declinedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#c62828',
  },
  intro: {
    fontSize: 14,
    color: '#444444',
    lineHeight: 20,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#6200ea',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  acceptButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d32f2f',
    minHeight: 44,
    justifyContent: 'center',
  },
  declineButtonText: {
    color: '#d32f2f',
    fontSize: 14,
    fontWeight: '600',
  },
});
