import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../navigation/AppNavigator';
import { getUserProfile, blockUser, reportUser } from '../../services/api';

type Props = NativeStackScreenProps<AppStackParamList, 'ViewProfile'>;

/**
 * Public profile shape returned by GET /api/users/:uid.
 * Only contains the explicit projection — no private fields (T-05-02).
 */
interface PublicProfile {
  uid: string;
  displayName?: string;
  bio?: string;
  homeCity?: string;
  photoURL?: string | null;
  isVerified: boolean;
  hostsCount: number;
  tripsCount: number;
}

/**
 * ViewProfileScreen (PROF-04)
 *
 * Displays another verified user's public profile:
 *   - Profile photo
 *   - Display name
 *   - Verification badge (when isVerified)
 *   - Bio and home city
 *   - Host/trip stat counters (stubbed to 0 in Phase 1)
 *   - Block action (VERI-06) — prevents blocked user viewing caller's profile
 *   - Report action (VERI-07) — submits a reason to admins for review
 *
 * Receives the target user's Firebase UID via the 'uid' route param.
 * The backend enforces block state — a 403 response means the viewer
 * has been blocked by this user (T-05-03); this screen shows an error.
 */
export default function ViewProfileScreen({ route, navigation }: Props) {
  const { uid } = route.params;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Block state
  const [blocking, setBlocking] = useState(false);

  // Report modal state
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [uid]);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const res = await getUserProfile(uid) as { data?: PublicProfile; error?: string };
      if (res.data) {
        setProfile(res.data);
      } else if (res.error) {
        setError(res.error);
      }
    } catch {
      setError('Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Block the viewed user (VERI-06).
   * On success, navigate back — the blocked user can no longer view this profile.
   */
  async function handleBlock() {
    if (blocking) return;
    Alert.alert(
      'Block user',
      'This user will no longer be able to view your profile. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setBlocking(true);
            try {
              await blockUser(uid);
              Alert.alert('Blocked', 'User has been blocked.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch {
              Alert.alert('Error', 'Failed to block user. Please try again.');
            } finally {
              setBlocking(false);
            }
          },
        },
      ]
    );
  }

  /**
   * Submit a report for admin review (VERI-07).
   * The reason field must be non-empty — the submit button is disabled otherwise.
   */
  async function handleReport() {
    const trimmedReason = reportReason.trim();
    if (!trimmedReason) return;

    setSubmittingReport(true);
    try {
      await reportUser({ reportedUid: uid, contentType: 'user', reason: trimmedReason });
      setReportModalVisible(false);
      setReportReason('');
      Alert.alert('Reported', 'Thank you. Your report has been submitted for review.');
    } catch {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setSubmittingReport(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6200ea" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Profile not available.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Profile photo */}
      {profile.photoURL ? (
        <Image source={{ uri: profile.photoURL }} style={styles.photo} />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.photoPlaceholderText}>No photo</Text>
        </View>
      )}

      {/* Display name */}
      <Text style={styles.displayName}>{profile.displayName ?? '—'}</Text>

      {/* Verification badge (PROF-02) */}
      {profile.isVerified && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Verified</Text>
        </View>
      )}

      {/* Bio */}
      {!!profile.bio && (
        <Text style={styles.bio}>{profile.bio}</Text>
      )}

      {/* Home city */}
      {!!profile.homeCity && (
        <Text style={styles.homeCity}>{profile.homeCity}</Text>
      )}

      {/* Host / trip stat counters (PROF-03) */}
      <Text style={styles.stats}>
        Stays hosted: {profile.hostsCount} · Trips: {profile.tripsCount}
      </Text>

      {/* ── Block / Report actions — Plan 07 (VERI-06, VERI-07) ─────────── */}
      <View style={styles.safetyActions}>
        <TouchableOpacity
          style={[styles.blockButton, blocking && styles.buttonDisabled]}
          onPress={handleBlock}
          disabled={blocking}
          accessibilityLabel="Block this user"
        >
          <Text style={styles.blockButtonText}>
            {blocking ? 'Blocking…' : 'Block'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.reportButton}
          onPress={() => setReportModalVisible(true)}
          accessibilityLabel="Report this user"
        >
          <Text style={styles.reportButtonText}>Report</Text>
        </TouchableOpacity>
      </View>
      {/* ───────────────────────────────────────────────────────────────── */}

      {/* Report modal (VERI-07) */}
      <Modal
        visible={reportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!submittingReport) {
            setReportModalVisible(false);
            setReportReason('');
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Report user</Text>
            <Text style={styles.modalSubtitle}>
              Describe why you are reporting this user. A reason is required.
            </Text>

            <TextInput
              style={styles.reasonInput}
              placeholder="Enter reason…"
              placeholderTextColor="#999"
              value={reportReason}
              onChangeText={setReportReason}
              multiline
              maxLength={500}
              editable={!submittingReport}
              accessibilityLabel="Report reason"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setReportModalVisible(false);
                  setReportReason('');
                }}
                disabled={submittingReport}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              {/* Submit disabled until reason is non-empty (T-07-04) */}
              <TouchableOpacity
                style={[
                  styles.modalSubmitButton,
                  (!reportReason.trim() || submittingReport) && styles.buttonDisabled,
                ]}
                onPress={handleReport}
                disabled={!reportReason.trim() || submittingReport}
                accessibilityLabel="Submit report"
              >
                <Text style={styles.modalSubmitText}>
                  {submittingReport ? 'Submitting…' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 48,
    alignItems: 'center',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  photoPlaceholderText: {
    color: '#999',
    fontSize: 12,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    textAlign: 'center',
  },
  badge: {
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  badgeText: {
    color: '#2e7d32',
    fontSize: 13,
    fontWeight: '600',
  },
  bio: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  homeCity: {
    fontSize: 14,
    color: '#777',
    marginBottom: 8,
  },
  stats: {
    fontSize: 14,
    color: '#555',
    marginBottom: 24,
    marginTop: 4,
  },
  // Safety actions row
  safetyActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  blockButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#ffebee',
    alignItems: 'center',
  },
  blockButtonText: {
    color: '#c62828',
    fontSize: 15,
    fontWeight: '600',
  },
  reportButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#fff3e0',
    alignItems: 'center',
  },
  reportButtonText: {
    color: '#e65100',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: 15,
    color: '#d32f2f',
    textAlign: 'center',
  },
  // Report modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 16,
    lineHeight: 20,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#111',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#555',
    fontSize: 15,
    fontWeight: '600',
  },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#6200ea',
    alignItems: 'center',
  },
  modalSubmitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
