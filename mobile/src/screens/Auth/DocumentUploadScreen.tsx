import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { VerificationStackParamList } from '../../navigation/VerificationNavigator';
import { uploadVerificationDocs } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

type Props = NativeStackScreenProps<VerificationStackParamList, 'DocumentUpload'>;

/**
 * DocumentUploadScreen (VERI-02, D-05, D-06)
 *
 * Lets the user pick an ID document photo and a selfie from the media library,
 * then submits them to the backend via a multipart POST.
 *
 * Key constraints:
 * - Uses expo-image-picker launchImageLibraryAsync (no base64 — RESEARCH note)
 * - Does NOT manually set Content-Type on the upload fetch call (RESEARCH Pitfall 5)
 * - Submit is disabled until both images are picked
 * - On success: setVerificationStatus('pending') + navigate to PendingVerification
 * - On error: inline error message, no navigation
 *
 * Reachable via:
 *   VerificationNavigator initial route (verificationStatus === 'none')
 *   PendingVerificationScreen Resubmit button (verificationStatus === 'pending' | 'rejected')
 */
export default function DocumentUploadScreen({ navigation }: Props) {
  const { setVerificationStatus } = useAuthStore();

  const [idDocumentUri, setIdDocumentUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickImage(
    field: 'idDocument' | 'selfie',
    setter: (uri: string) => void
  ) {
    // Request media library permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission to access the photo library is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      // Do NOT set base64: true — RESEARCH note (slow for large images; URI sent as multipart)
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      setter(result.assets[0].uri);
      setError(null);
    }
  }

  async function handleSubmit() {
    if (!idDocumentUri || !selfieUri) return;

    setError(null);
    setLoading(true);
    try {
      const response = await uploadVerificationDocs(idDocumentUri, selfieUri) as { status?: string; error?: string };

      if (response && response.status === 'pending') {
        setVerificationStatus('pending');
        navigation.navigate('PendingVerification', {
          idDocumentUri,
          selfieUri,
        });
      } else {
        setError(response?.error ?? 'Upload failed. Please try again.');
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setError(`Upload failed: ${detail}`);
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = !!idDocumentUri && !!selfieUri && !loading;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Verify your identity</Text>
      <Text style={styles.subtitle}>
        Upload a photo of a government-issued ID and a selfie. Our team will review your submission within 24 hours.
      </Text>

      {/* ID Document picker */}
      <View style={styles.slot}>
        <Text style={styles.slotLabel}>ID Document</Text>
        <Text style={styles.slotHint}>Passport, national ID, or driver's licence</Text>
        {idDocumentUri ? (
          <Image source={{ uri: idDocumentUri }} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No image selected</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.pickButton}
          onPress={() => pickImage('idDocument', setIdDocumentUri)}
          disabled={loading}
        >
          <Text style={styles.pickButtonText}>
            {idDocumentUri ? 'Change ID photo' : 'Choose ID photo'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Selfie picker */}
      <View style={styles.slot}>
        <Text style={styles.slotLabel}>Selfie</Text>
        <Text style={styles.slotHint}>A clear photo of your face</Text>
        {selfieUri ? (
          <Image source={{ uri: selfieUri }} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No image selected</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.pickButton}
          onPress={() => pickImage('selfie', setSelfieUri)}
          disabled={loading}
        >
          <Text style={styles.pickButtonText}>
            {selfieUri ? 'Change selfie' : 'Choose selfie'}
          </Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Submit for verification</Text>
        )}
      </TouchableOpacity>

      {/* Escape hatch — sign out to return to login / use a different account. */}
      <TouchableOpacity style={styles.signOutButton} onPress={() => signOut(auth)} disabled={loading}>
        <Text style={styles.signOutText}>Sign out</Text>
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
    fontSize: 26,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
    marginBottom: 32,
  },
  signOutButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  signOutText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '600',
  },
  slot: {
    marginBottom: 28,
  },
  slotLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  slotHint: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
  },
  thumbnail: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#f5f5f5',
  },
  placeholder: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  placeholderText: {
    color: '#bbb',
    fontSize: 14,
  },
  pickButton: {
    backgroundColor: '#f3f0ff',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d4c8f5',
  },
  pickButtonText: {
    color: '#6200ea',
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    color: '#d32f2f',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#6200ea',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
