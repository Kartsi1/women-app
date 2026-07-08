import { View, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  uris: string[];
  onChange: (uris: string[]) => void;
  maxPhotos?: number;
}

/**
 * PhotoGridUploader
 *
 * 3-column grid of 100×100 photo tiles.
 * - "+" tile to add photos (expo-image-picker from library)
 * - "×" overlay to remove a photo
 * - Returns an array of local file URIs (max 10)
 *
 * UI-SPEC tokens: #f5f5f5 background, #6200ea accent, #999 placeholder
 * All interactive tiles have accessibilityLabel.
 */
export default function PhotoGridUploader({
  uris,
  onChange,
  maxPhotos = 10,
}: Props) {
  async function handleAdd() {
    if (uris.length >= maxPhotos) {
      Alert.alert('Photo limit', `You can upload up to ${maxPhotos} photos.`);
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Allow access to your photo library to upload listing photos.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    onChange([...uris, result.assets[0].uri]);
  }

  function handleRemove(index: number) {
    onChange(uris.filter((_, i) => i !== index));
  }

  return (
    <View style={styles.container}>
      {uris.map((uri, index) => (
        <View key={uri + index} style={styles.tile}>
          <Image source={{ uri }} style={styles.image} accessibilityLabel={`Photo ${index + 1}`} />
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemove(index)}
            accessibilityLabel={`Remove photo ${index + 1}`}
            accessibilityRole="button"
          >
            <Ionicons name="close-circle" size={22} color="#d32f2f" />
          </TouchableOpacity>
        </View>
      ))}

      {uris.length < maxPhotos && (
        <TouchableOpacity
          style={styles.addTile}
          onPress={handleAdd}
          accessibilityLabel="Add photo"
          accessibilityRole="button"
        >
          <Ionicons name="add" size={32} color="#999999" />
          <Text style={styles.addLabel}>Add photo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tile: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 11,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dddddd',
    borderStyle: 'dashed',
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addLabel: {
    fontSize: 11,
    color: '#999999',
  },
});
