import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../navigation/AppNavigator';
import { getUserProfile } from '../../services/api';

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
 *
 * Receives the target user's Firebase UID via the 'uid' route param.
 * The backend enforces block state — a 403 response means the viewer
 * has been blocked by this user (T-05-03); this screen shows an error.
 *
 * Block/report action slot: Plan 07 will add block and report buttons here.
 */
export default function ViewProfileScreen({ route }: Props) {
  const { uid } = route.params;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      {/* ── Block / Report slot — Plan 07 ──────────────────────────────── */}
      {/* Plan 07 (block / report) will add block and report action buttons here */}
      {/* ────────────────────────────────────────────────────────────────── */}
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
  errorText: {
    fontSize: 15,
    color: '#d32f2f',
    textAlign: 'center',
  },
});
