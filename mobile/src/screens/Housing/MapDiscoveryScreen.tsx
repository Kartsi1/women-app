import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import MapView, { Marker, Region } from '../../components/Map/MapView';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HousingStackParamList } from '../../navigation/AppNavigator';
import { useListingStore } from '../../store/listingStore';
import { searchListings } from '../../services/api';
import type { Listing } from '../../types/listing';
import type { DateRange } from '../../components/Common/AvailabilityDatePicker';
import NeighbourhoodPin from '../../components/Map/NeighbourhoodPin';
import FilterSheet from '../../components/Map/FilterSheet';

type Props = NativeStackScreenProps<HousingStackParamList, 'MapDiscovery'>;

const DEFAULT_RADIUS_M = 10000;

/**
 * MapDiscoveryScreen (LIST-03, LIST-04, LIST-05)
 *
 * Shows verified users a map of neighbourhood pins for active listings near them.
 * - Requests expo-location foreground permission; shows error copy on deny
 * - Centers map on user's location
 * - Calls api.searchListings with the current region centre + active date filter
 * - Renders NeighbourhoodPin Marker per listing
 *   coordinate: { latitude: coords[1], longitude: coords[0] }  ← [lng,lat] flip (Pitfall 2)
 * - Float search bar overlay at top
 * - Filter FAB → FilterSheet for date-range narrowing
 * - onRegionChangeComplete re-queries with new centre
 * - Tap pin → summary → navigate to ListingDetail
 * - Empty state: "No listings in this area"
 * - FAB at bottom-right: "List your space" → CreateListing
 *
 * Replaces HousingPlaceholderScreen from plan 02-01.
 */
export default function MapDiscoveryScreen({ navigation }: Props) {
  const { listings, setListings, selectedListing, setSelectedListing } = useListingStore();

  const [locationError, setLocationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateRange>({ from: null, to: null });
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);

  // Track current map centre for re-queries
  const currentRegionRef = useRef<Region | null>(null);

  // Fetch listings for a given region centre + active date filter
  const fetchListings = useCallback(
    async (region: Region, filter: DateRange) => {
      setLoading(true);
      try {
        const params: Parameters<typeof searchListings>[0] = {
          lat: region.latitude,
          lng: region.longitude,
          radiusM: DEFAULT_RADIUS_M,
        };
        if (filter.from && filter.to) {
          params.fromDate = filter.from.toISOString();
          params.toDate = filter.to.toISOString();
        }
        const res = await searchListings(params);
        if (res.data) {
          setListings(res.data);
        }
      } catch {
        // Non-fatal: map still shown, listings may be stale
      } finally {
        setLoading(false);
      }
    },
    [setListings]
  );

  // Request location + initial load when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function init() {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError(
            'Location access is needed to show listings near you.\n' +
            'Please enable it in Settings and try again.'
          );
          return;
        }
        setLocationError(null);

        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (cancelled) return;

          const region: Region = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          };
          setInitialRegion(region);
          currentRegionRef.current = region;
          await fetchListings(region, dateFilter);
        } catch {
          if (!cancelled) {
            setLocationError('Could not get your location. Please try again.');
          }
        }
      }

      init();
      return () => { cancelled = true; };
    }, [fetchListings, dateFilter])
  );

  function handleRegionChangeComplete(region: Region) {
    currentRegionRef.current = region;
    // Re-query when the user pans the map
    fetchListings(region, dateFilter);
  }

  function handleFilterApply(range: DateRange) {
    setDateFilter(range);
    if (currentRegionRef.current) {
      fetchListings(currentRegionRef.current, range);
    }
  }

  function handlePinPress(listing: Listing) {
    setSelectedListing(listing);
  }

  function handleOpenDetail() {
    if (!selectedListing?.id) return;
    navigation.navigate('ListingDetail', { listingId: selectedListing.id });
  }

  // Location permission denied
  if (locationError) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <Text style={styles.errorText}>{locationError}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => setLocationError(null)}
          accessibilityRole="button"
          accessibilityLabel="Retry location access"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Waiting for location
  if (!initialRegion) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#6200ea" />
        <Text style={styles.loadingText}>Finding your location…</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        style={StyleSheet.absoluteFill}
        provider="google"
        showsUserLocation
        initialRegion={initialRegion}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {listings.map((listing) => {
          const coords = listing.location?.coordinates ?? listing.neighbourhoodCoords;
          if (!coords) return null;

          return (
            <Marker
              key={listing.id}
              coordinate={{
                // [lng, lat] from backend → {latitude: coords[1], longitude: coords[0]}
                // Flip: GeoJSON stores [longitude, latitude]; MapView uses {latitude, longitude}
                // (Pitfall 2 — coordinate flip)
                latitude: coords[1],
                longitude: coords[0],
              }}
              onPress={() => handlePinPress(listing)}
            >
              <NeighbourhoodPin
                listing={listing}
                selected={selectedListing?.id === listing.id}
              />
            </Marker>
          );
        })}
      </MapView>

      {/* Floating top bar: search label + filter button */}
      <SafeAreaView style={styles.topBar} pointerEvents="box-none">
        <View style={styles.searchBar}>
          <Text style={styles.searchLabel}>Find housing</Text>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setFilterSheetOpen(true)}
            accessibilityLabel="Open date filter"
            accessibilityRole="button"
          >
            <Text style={styles.filterButtonText}>
              {dateFilter.from && dateFilter.to ? '● Dates' : 'Filter'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color="#6200ea" />
        </View>
      )}

      {/* Empty state — shown when map loaded but no results */}
      {!loading && listings.length === 0 && (
        <View style={styles.emptyState} pointerEvents="none">
          <Text style={styles.emptyStateText}>No listings in this area</Text>
          <Text style={styles.emptyStateSubtext}>
            Try adjusting dates or zooming out to see more
          </Text>
        </View>
      )}

      {/* Selected listing summary card */}
      {selectedListing && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryContent}>
            <Text style={styles.summaryTitle} numberOfLines={1}>
              {selectedListing.title}
            </Text>
            {selectedListing.availabilityDates?.[0] && (
              <Text style={styles.summaryDates}>
                {new Date(selectedListing.availabilityDates[0].from).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                {' – '}
                {new Date(selectedListing.availabilityDates[0].to).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.summaryButton}
            onPress={handleOpenDetail}
            accessibilityLabel="View listing details"
            accessibilityRole="button"
          >
            <Text style={styles.summaryButtonText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.summaryDismiss}
            onPress={() => setSelectedListing(null)}
            accessibilityLabel="Dismiss listing summary"
            accessibilityRole="button"
          >
            <Text style={styles.summaryDismissText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* FAB: List your space */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateListing')}
        accessibilityLabel="List your space"
        accessibilityRole="button"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Filter sheet */}
      <FilterSheet
        visible={filterSheetOpen}
        initialValue={dateFilter}
        onClose={() => setFilterSheetOpen(false)}
        onApply={handleFilterApply}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#777777',
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#6200ea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    gap: 8,
  },
  searchLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#6200ea',
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 8,
  },
  emptyState: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxWidth: 280,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#777777',
    textAlign: 'center',
  },
  summaryCard: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    gap: 10,
  },
  summaryContent: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  summaryDates: {
    fontSize: 13,
    color: '#777777',
    marginTop: 2,
  },
  summaryButton: {
    backgroundColor: '#6200ea',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  summaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryDismiss: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryDismissText: {
    fontSize: 16,
    color: '#999999',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6200ea',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    color: '#ffffff',
    lineHeight: 32,
    fontWeight: '400',
  },
});
