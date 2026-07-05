import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAuthStore } from '../../store/authStore';

/**
 * Full-screen pending verification gate (D-05, VERI-05).
 *
 * Shown to any authenticated user who is not yet verified.
 * There is NO navigation target from this screen — the user cannot
 * leave it until the admin approves their account, at which point
 * onAuthStateChanged fires, updates isVerified, and RootNavigator
 * switches to AppNavigator.
 *
 * Slots for Plan 03 (document upload) and Plan 04 (admin approval):
 *   - Photo thumbnails slot: labeled comment below
 *   - Rejection reason + Resubmit button: rendered when status === 'rejected'
 */
export default function PendingVerificationScreen() {
  const { verificationStatus, rejectionReason } = useAuthStore();

  const statusLabel = {
    none: 'Awaiting document submission',
    pending: 'Under review',
    approved: 'Approved',
    rejected: 'Rejected',
  }[verificationStatus] ?? 'Unknown';

  const statusColor = {
    none: '#888',
    pending: '#f59e0b',
    approved: '#16a34a',
    rejected: '#dc2626',
  }[verificationStatus] ?? '#888';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Status badge */}
      <View style={[styles.badge, { borderColor: statusColor }]}>
        <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
      </View>

      <Text style={styles.heading}>Your account is under review</Text>
      <Text style={styles.body}>
        Our team verifies every member to keep the community safe. This typically takes up to 24 hours.
      </Text>

      {/* Estimated wait time */}
      <Text style={styles.estimate}>Estimated wait: up to 24 hours</Text>

      {/* ── PLAN 03 SLOT ─────────────────────────────────────────────────────
          Document upload thumbnail row goes here.
          Plan 03 (verification-docs upload) will add:
            <VerificationPhotosRow />
          ─────────────────────────────────────────────────────────────────── */}

      {/* Rejection reason + resubmit slot — populated when Plan 04 sets status to 'rejected' */}
      {verificationStatus === 'rejected' && (
        <View style={styles.rejectionBox}>
          <Text style={styles.rejectionTitle}>Your submission was rejected</Text>
          {rejectionReason ? (
            <Text style={styles.rejectionReason}>{rejectionReason}</Text>
          ) : null}

          {/* ── PLAN 03 SLOT ──────────────────────────────────────────────────
              Resubmit button goes here once Plan 03 builds the upload flow.
              Plan 03 will replace this placeholder with:
                <ResubmitButton />
              ──────────────────────────────────────────────────────────────── */}
          <Text style={styles.resubmitPlaceholder}>Resubmit — coming in Plan 03</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    borderWidth: 2,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 24,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  estimate: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
  },
  rejectionBox: {
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#fca5a5',
    marginTop: 16,
  },
  rejectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 8,
  },
  rejectionReason: {
    fontSize: 14,
    color: '#555',
    marginBottom: 12,
  },
  resubmitPlaceholder: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
});
