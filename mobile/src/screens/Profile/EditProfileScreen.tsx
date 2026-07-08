import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../navigation/AppNavigator';
import { useProfileStore } from '../../store/profileStore';
import { updateProfile, uploadProfilePhoto, getMyProfile } from '../../services/api';
import { Profile } from '../../store/profileStore';

type Props = NativeStackScreenProps<AppStackParamList, 'EditProfile'>;

/**
 * EditProfileScreen (PROF-01)
 *
 * Allows the verified user to update:
 *   - Display name
 *   - Bio (max 500 characters — enforced client-side + server-side)
 *   - Home city
 *   - Profile photo (via expo-image-picker → uploadProfilePhoto)
 *
 * On save: calls updateProfile, refreshes profileStore from server, navigates back.
 * On photo change: calls uploadProfilePhoto, then refreshes store for the signed URL.
 */
export default function EditProfileScreen({ navigation }: Props) {
  const { profile, setProfile } = useProfileStore();

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [homeCity, setHomeCity] = useState(profile?.homeCity ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow access to your photo library to change your profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      // No base64 — URI sent as multipart (RESEARCH Pitfall 5 / DocumentUpload pattern)
    });

    if (result.canceled || !result.assets?.[0]) return;

    setUploadingPhoto(true);
    try {
      await uploadProfilePhoto(result.assets[0].uri);
      // Refresh store to get the new signed URL from the server
      const res = await getMyProfile() as { data?: Profile; error?: string };
      if (res.data) setProfile(res.data);
    } catch {
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (bio.length > 500) {
      Alert.alert('Bio too long', 'Bio must not exceed 500 characters.');
      return;
    }

    setSaving(true);
    try {
      const res = await updateProfile({ displayName, bio, homeCity }) as { data?: Profile; error?: string };
      if (res.data) {
        setProfile(res.data);
        navigation.goBack();
      } else {
        Alert.alert('Error', res.error ?? 'Failed to save profile.');
      }
    } catch {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Edit Profile</Text>

      <Text style={styles.label}>Display Name</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Your name"
        autoCapitalize="words"
      />

      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, styles.bioInput]}
        value={bio}
        onChangeText={setBio}
        placeholder="Tell the community about yourself"
        multiline
        maxLength={500}
        textAlignVertical="top"
      />
      <Text style={styles.charCount}>{bio.length}/500</Text>

      <Text style={styles.label}>Home City</Text>
      <TextInput
        style={styles.input}
        value={homeCity}
        onChangeText={setHomeCity}
        placeholder="Your home city"
        autoCapitalize="words"
      />

      <TouchableOpacity
        style={styles.photoButton}
        onPress={handlePickPhoto}
        disabled={uploadingPhoto || saving}
      >
        {uploadingPhoto ? (
          <ActivityIndicator color="#6200ea" />
        ) : (
          <Text style={styles.photoButtonText}>Change Photo</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.saveButton, (saving || uploadingPhoto) && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving || uploadingPhoto}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111',
    backgroundColor: '#fafafa',
    marginBottom: 16,
  },
  bioInput: {
    height: 100,
    marginBottom: 4,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginBottom: 16,
  },
  photoButton: {
    borderWidth: 1,
    borderColor: '#d4c8f5',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#f3f0ff',
    marginBottom: 16,
    minHeight: 48,
    justifyContent: 'center',
  },
  photoButtonText: {
    color: '#6200ea',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#6200ea',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
