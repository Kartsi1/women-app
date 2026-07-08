import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { VerificationStackParamList } from '../../navigation/VerificationNavigator';
import { useAuthStore } from '../../store/authStore';

type Props = NativeStackScreenProps<VerificationStackParamList, 'PendingVerification'>;

/**
 * Full-screen pending verification gate (D-05, D-06, D-07, VERI-05).
 *
 * Shown to any authenticated user who is not yet verified.
 * There is NO way out of this screen until the admin approves — approval fires
 * a push notification, the tap handler forces getIdToken(true), and the
 * RootNavigator isVerified gate switches to AppNavigator.
 *
 * Features implemented in Plan 03:
 *   - Status badge (none/pending/approved/rejected)
 *   - Submitted photo thumbnails (from navigation route params)
 *   - Estimated wait time
 *   - Resubmit button (navigates to DocumentUploadScreen — D-06)
 *   - Rejection reason box (displayed when status === 'rejected' — D-07)
 */
export default function PendingVerificationScreen({ navigation, route }: Props) {
  const { verificationStatus, rejectionReason } = useAuthStore();

  // Thumbnails from the just-submitted upload (only available within the current session)
  const idDocumentUri = route.params?.idDocumentUri;
  const selfieUri = route.params?.selfieUri;

  const statusLabel: Record<string, string> = {
    none: 'Awaiting document submission',
    pending: 'Under review',
    approved: 'Approved',
    rejected: 'Rejected',
  };

  const statusColor: Record<string, string> = {
    none: '#888',
    pending: '#f59e0b',
    approved: '#16a34a',
    rejected: '#dc2626',
  };

  const label = statusLabel[verificationStatus] ?? 'Unknown';
  const color = statusColor[verificationStatus] ?? '#888';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Status badge */}
      <View style={[styles.badge, { borderColor: color }]}>
        <Text style={[styles.badgeText, { color }]}>{label}</Text>
      </View>

      <Text style={styles.heading}>Your account is under review</Text>
      <Text style={styles.body}>
        Our team verifies every member to keep the community safe. This typically takes up to 24 hours.
      </Text>

      {/* Estimated wait time */}
      <Text style={styles.estimate}>Estimated wait: up to 24 hours</Text>

      {/* Submitted photo thumbnails (shown when URIs were passed from DocumentUploadScreen) */}
      {(idDocumentUri || selfieUri) ? (
        <View style={styles.thumbnailRow}>
          {idDocumentUri ? (
            <View style={styles.thumbnailSlot}>
              <Text style={styles.thumbnailLabel}>ID Document</Text>
              <Image source={{ uri: idDocumentUri }} style={styles.thumbnail} resizeMode="cover" />
            </View>
          ) : null}
          {selfieUri ? (
            <View style={styles.thumbnailSlot}>
              <Text style={styles.thumbnailLabel}>Selfie</Text>
              <Image source={{ uri: selfieUri }} style={styles.thumbnail} resizeMode="cover" />
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Rejection reason box — populated by Plan 04's push notification approval flow (D-07) */}
      {verificationStatus === 'rejected' ? (
        <View style={styles.rejectionBox}>
          <Text style={styles.rejectionTitle}>Your submission was rejected</Text>
          {rejectionReason ? (
            <Text style={styles.rejectionReason}>{rejectionReason}</Text>
          ) : null}

          {/* Resubmit button (D-06) */}
          <TouchableOpacity
            style={styles.resubmitButton}
            onPress={() => navigation.navigate('DocumentUpload')}
          >
            <Text style={styles.resubmitButtonText}>Resubmit documents</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Resubmit button is also available when pending (D-06) */}
      {verificationStatus === 'pending' ? (
        <TouchableOpacity
          style={styles.resubmitButtonOutline}
          onPress={() => navigation.navigate('DocumentUpload')}
        >
          <Text style={styles.resubmitButtonOutlineText}>Replace submitted documents</Text>
        </TouchableOpacity>
      ) : null}
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
    marginBottom: 24,
  },
  thumbnailRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    width: '100%',
    justifyContent: 'center',
  },
  thumbnailSlot: {
    alignItems: 'center',
    flex: 1,
  },
  thumbnailLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
    textAlign: 'center',
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  rejectionBox: {
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#fca5a5',
    marginTop: 8,
    marginBottom: 16,
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
    marginBottom: 16,
  },
  resubmitButton: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  resubmitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  resubmitButtonOutline: {
    borderWidth: 1,
    borderColor: '#d4c8f5',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  resubmitButtonOutlineText: {
    color: '#6200ea',
    fontSize: 15,
    fontWeight: '600',
  },
});
