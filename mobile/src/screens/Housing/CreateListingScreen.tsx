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
import MapView, { Marker, Region } from 'react-native-maps';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import { useListingStore } from '../../store/listingStore';
import { createListing } from '../../services/api';
import AvailabilityDatePicker, { DateRange } from '../../components/Common/AvailabilityDatePicker';
import PhotoGridUploader from '../../components/Common/PhotoGridUploader';
import type { HousingStackParamList } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<HousingStackParamList, 'CreateListing'>;

/**
 * CreateListingScreen (LIST-01, LIST-02)
 *
 * Allows a verified host to publish a free housing listing.
 *
 * Fields: title, description, house rules, availability dates, photos,
 * neighbourhood pin on map (tap to place), exact address (stored safely).
 *
 * CTA disabled until: title + at least one availability date range + location set.
 * Loading label: "Publishing…" at opacity 0.6.
 * On success: navigate to MapDiscovery.
 *
 * Address handling (T-02-02-01):
 *   - exactAddress is submitted as a separate field
 *   - location.coordinates stores [lng, lat] — neighbourhood centroid tapped on map
 *   - Coordinate flip comment: GeoJSON stores [lng, lat]; MapView uses {latitude, longitude}
 */
export default function CreateListingScreen({ navigation }: Props) {
  const { user } = useAuthStore();
  const { setSelectedListing } = useListingStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [houseRules, setHouseRules] = useState('');
  const [exactAddress, setExactAddress] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

  // Pin location — placed by tapping the map
  // MapView coordinate: {latitude, longitude}
  // GeoJSON/backend: [longitude, latitude] — flip on submit (Pitfall 2)
  const [pinCoordinate, setPinCoordinate] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Derive citySlug from user's homeCity (lowercase, spaces→hyphens)
  const homeCity = (user as { homeCity?: string } | null)?.homeCity ?? '';
  const citySlug = homeCity.toLowerCase().replace(/\s+/g, '-') || 'unknown';

  // Default map region — general location (user may not have location permission here)
  const defaultRegion: Region = {
    latitude: 48.8566,
    longitude: 2.3522,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };

  const isValid =
    title.trim().length > 0 &&
    dateRange.from !== null &&
    dateRange.to !== null &&
    pinCoordinate !== null;

  async function handlePublish() {
    if (!isValid) return;
    if (!pinCoordinate) return;

    if (exactAddress.trim().length === 0) {
      Alert.alert('Address required', 'Please enter the exact address for the listing.');
      return;
    }

    setPublishing(true);
    try {
      // GeoJSON stores [longitude, latitude] — flip from MapView {latitude, longitude} (Pitfall 2)
      const coordinates: [number, number] = [pinCoordinate.longitude, pinCoordinate.latitude];

      const res = await createListing({
        title: title.trim(),
        description: description.trim() || undefined,
        houseRules: houseRules.trim() || undefined,
        citySlug,
        exactAddress: exactAddress.trim(),
        // [lng, lat] — longitude FIRST per GeoJSON spec (Pitfall 2 coordinate flip)
        coordinates,
        availabilityDates:
          dateRange.from && dateRange.to
            ? [{ from: dateRange.from.toISOString(), to: dateRange.to.toISOString() }]
            : [],
        photoUris: photoUris.length > 0 ? photoUris : undefined,
      });

      if (res.error) {
        Alert.alert('Error', res.error);
        return;
      }

      // Clear selected listing so MapDiscovery reloads fresh results
      setSelectedListing(null);
      navigation.navigate('MapDiscovery');
    } catch {
      Alert.alert('Error', 'Failed to publish listing. Please try again.');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>New listing</Text>

      <Text style={styles.label}>Title *</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Cosy room near city centre"
        autoCapitalize="sentences"
        maxLength={200}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        value={description}
        onChangeText={setDescription}
        placeholder="Describe your space, neighbourhood, local tips..."
        multiline
        maxLength={2000}
        textAlignVertical="top"
      />
      <Text style={styles.charCount}>{description.length}/2000</Text>

      <Text style={styles.label}>House rules</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        value={houseRules}
        onChangeText={setHouseRules}
        placeholder="e.g. No smoking, quiet hours after 22:00..."
        multiline
        maxLength={1000}
        textAlignVertical="top"
      />
      <Text style={styles.charCount}>{houseRules.length}/1000</Text>

      {/* Availability date picker */}
      <Text style={styles.sectionHeader}>Availability *</Text>
      <AvailabilityDatePicker value={dateRange} onChange={setDateRange} />

      {/* Photos */}
      <Text style={styles.sectionHeader}>Photos</Text>
      <PhotoGridUploader uris={photoUris} onChange={setPhotoUris} maxPhotos={10} />

      {/* Neighbourhood pin placement on map */}
      <Text style={styles.sectionHeader}>Neighbourhood location *</Text>
      <Text style={styles.mapHint}>
        Tap the map to place a pin at your neighbourhood — this approximate location
        is shown to users. Your exact address is kept private.
      </Text>
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          provider="google"
          initialRegion={defaultRegion}
          onPress={(e) => {
            // Capture MapView coordinate {latitude, longitude}
            // Converted to [lng, lat] on submit (GeoJSON flip — Pitfall 2)
            setPinCoordinate(e.nativeEvent.coordinate);
          }}
        >
          {pinCoordinate && (
            <Marker
              coordinate={pinCoordinate}
              pinColor="#6200ea"
              title="Neighbourhood pin"
            />
          )}
        </MapView>
        {!pinCoordinate && (
          <View style={styles.mapOverlayHint} pointerEvents="none">
            <Text style={styles.mapOverlayHintText}>Tap to place pin</Text>
          </View>
        )}
      </View>

      {/* Exact address — stored safely, shown only after acceptance (T-02-02-01) */}
      <Text style={styles.sectionHeader}>Exact address *</Text>
      <Text style={styles.addressHint}>
        Your full address is stored securely and revealed only to guests whose
        stay request you accept.
      </Text>
      <TextInput
        style={styles.input}
        value={exactAddress}
        onChangeText={setExactAddress}
        placeholder="123 Main Street, Apt 4, City"
        autoCapitalize="words"
      />

      {/* Publish CTA */}
      <TouchableOpacity
        style={[
          styles.publishButton,
          (!isValid || publishing) && styles.publishButtonDisabled,
        ]}
        onPress={handlePublish}
        disabled={!isValid || publishing}
        accessibilityLabel={publishing ? 'Publishing listing' : 'Publish listing'}
        accessibilityRole="button"
      >
        {publishing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.publishButtonText}>
            {publishing ? 'Publishing…' : 'Publish listing'}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#ffffff',
    padding: 24,
    paddingTop: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 8,
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111111',
    backgroundColor: '#fafafa',
    marginBottom: 16,
  },
  multilineInput: {
    height: 100,
    marginBottom: 4,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'right',
    marginBottom: 16,
  },
  mapHint: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 8,
    lineHeight: 20,
  },
  mapContainer: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dddddd',
    marginBottom: 16,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapOverlayHint: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  mapOverlayHintText: {
    color: '#ffffff',
    fontSize: 13,
  },
  addressHint: {
    fontSize: 13,
    color: '#777777',
    marginBottom: 8,
    lineHeight: 18,
  },
  publishButton: {
    backgroundColor: '#6200ea',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    marginTop: 8,
  },
  publishButtonDisabled: {
    opacity: 0.6,
  },
  publishButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 32,
  },
});
