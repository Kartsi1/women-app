/**
 * PostPhotoAttachment.tsx — single-photo picker for CreatePostScreen (COMM-01).
 *
 * Uses expo-image-picker v57 per mobile/AGENTS.md requirement.
 * Docs: https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/
 *
 * Requests media library permission before launching the picker.
 * Shows a 160×160dp preview tile when a photo is selected, with a remove button.
 * Shows an 'Add photo' tap target when empty.
 *
 * UI-SPEC: 160×160dp preview, "×" remove overlay (accessibilityLabel 'Remove photo').
 */

import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

interface Props {
  value: string | null;
  onChange: (uri: string | null) => void;
}

export default function PostPhotoAttachment({ value, onChange }: Props) {
  const [requesting, setRequesting] = useState(false);

  async function handlePickPhoto() {
    if (requesting) return;
    setRequesting(true);
    try {
      // Request media library permission before launching picker (COMM-01 acceptance criterion)
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert(
          'Permission required',
          'Please allow access to your photo library to attach a photo.'
        );
        return;
      }

      // expo-image-picker v57: MediaType is a string union 'images' | 'videos' | 'livePhotos'
      // ImagePicker.MediaType enum does not exist in v57 — use the string literal directly
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as ImagePicker.MediaType,
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        onChange(result.assets[0].uri);
      }
    } catch (err) {
      console.warn('[PostPhotoAttachment] image picker error:', err);
    } finally {
      setRequesting(false);
    }
  }

  function handleRemove() {
    onChange(null);
  }

  if (value) {
    return (
      <View style={styles.previewContainer}>
        <Image
          source={{ uri: value }}
          style={styles.preview}
          resizeMode="cover"
          accessibilityLabel="Selected photo"
        />
        <TouchableOpacity
          style={styles.removeButton}
          onPress={handleRemove}
          accessibilityLabel="Remove photo"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.removeButtonText}>×</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.addButton}
      onPress={handlePickPhoto}
      accessibilityLabel="Add photo"
      accessibilityRole="button"
      disabled={requesting}
    >
      <Text style={styles.addButtonIcon}>📷</Text>
      <Text style={styles.addButtonText}>Add photo</Text>
    </TouchableOpacity>
  );
}

const TILE_SIZE = 160;

const styles = StyleSheet.create({
  previewContainer: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    position: 'relative',
  },
  preview: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '600',
  },
  addButton: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#dddddd',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    gap: 8,
  },
  addButtonIcon: {
    fontSize: 28,
  },
  addButtonText: {
    fontSize: 14,
    color: '#777777',
    fontWeight: '400',
  },
});
