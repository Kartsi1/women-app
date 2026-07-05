import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../navigation/AppNavigator';
import { useProfileStore } from '../../store/profileStore';
import { useAuthStore } from '../../store/authStore';
import { getMyProfile } from '../../services/api';

type Props = NativeStackScreenProps<AppStackParamList, 'Profile'>;

/**
 * ProfileScreen (PROF-01, PROF-02, PROF-03)
 *
 * Displays the current verified user's own profile:
 *   - Profile photo (or placeholder if not set)
 *   - Display name
 *   - Verification badge (PROF-02) — shown when isVerified is true in authStore
 *   - Bio and home city
 *   - Host/trip stat counters (PROF-03; both 0 until housing feature ships)
 *   - Edit Profile button → navigates to EditProfile
 *
 * Loads profile data from the backend on mount and caches it in profileStore.
 */
export default function ProfileScreen({ navigation }: Props) {
  const { profile, setProfile } = useProfileStore();
  const { isVerified } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyProfile() as { data?: typeof profile; error?: string };
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

  if (loading && !profile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6200ea" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Profile photo */}
      {profile?.photoURL ? (
        <Image source={{ uri: profile.photoURL }} style={styles.photo} />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.photoPlaceholderText}>No photo</Text>
        </View>
      )}

      {/* Display name */}
      <Text style={styles.displayName}>{profile?.displayName ?? '—'}</Text>

      {/* Verification badge (PROF-02) */}
      {isVerified && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Verified</Text>
        </View>
      )}

      {/* Bio */}
      {!!profile?.bio && (
        <Text style={styles.bio}>{profile.bio}</Text>
      )}

      {/* Home city */}
      {!!profile?.homeCity && (
        <Text style={styles.homeCity}>{profile.homeCity}</Text>
      )}

      {/* Host / trip stat counters (PROF-03) */}
      <Text style={styles.stats}>
        Stays hosted: {profile?.hostsCount ?? 0} · Trips: {profile?.tripsCount ?? 0}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={styles.editButton}
        onPress={() => navigation.navigate('EditProfile')}
      >
        <Text style={styles.editButtonText}>Edit Profile</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
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
  error: {
    color: '#d32f2f',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  editButton: {
    backgroundColor: '#6200ea',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
