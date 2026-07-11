import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HousingStackParamList } from '../../navigation/AppNavigator';
import { getListingDetail } from '../../services/api';
import type { Listing } from '../../types/listing';
import SafetyChip from '../../components/Listings/SafetyChip';
import AddressRevealCard from '../../components/Listings/AddressRevealCard';

type Props = NativeStackScreenProps<HousingStackParamList, 'ListingDetail'>;

const SCREEN_WIDTH = Dimensions.get('window').width;

/**
 * ListingDetailScreen (LIST-03, REQT-01)
 *
 * Full listing detail view.
 *
 * Address hiding (T-02-02-01):
 *   - Always renders SafetyChip when addressRevealed is false (this slice: always false for guests)
 *   - Never infers address from coordinates
 *   - exactAddress null in plan 02-02; reveal wired in plan 02-03 (REQT-03)
 *
 * Layout:
 *   - Full-width 200dp photo carousel (horizontal scroll)
 *   - Title / owner / area
 *   - SafetyChip (guests) or AddressRevealCard (after acceptance — plan 02-03)
 *   - Description, house rules, availability dates
 *   - Sticky bottom: "Request stay" (guest) or "Manage listing" (owner)
 */
export default function ListingDetailScreen({ route, navigation }: Props) {
  const { listingId } = route.params;

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadListing();
  }, [listingId]);

  async function loadListing() {
    setLoading(true);
    setError(null);
    try {
      const res = await getListingDetail(listingId);
      if (res.data) {
        setListing(res.data);
      } else {
        setError(res.error ?? 'Listing not found.');
      }
    } catch {
      setError('Failed to load listing. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#6200ea" />
      </View>
    );
  }

  if (error || !listing) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorText}>{error ?? 'Listing not found.'}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const coords = listing.neighbourhoodCoords ?? listing.location?.coordinates;
  const areaLabel = listing.citySlug
    ? listing.citySlug.replace(/-/g, ' ')
    : coords
    ? `${coords[1].toFixed(3)}, ${coords[0].toFixed(3)}`
    : null;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.headerBackText}>‹ Back</Text>
        </TouchableOpacity>

        {/* Photo carousel — full-width, 200dp height */}
        {listing.photos && listing.photos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            pagingEnabled
            style={styles.photoCarousel}
          >
            {listing.photos.map((uri, index) => (
              <Image
                key={index}
                source={{ uri }}
                style={[styles.carouselPhoto, { width: SCREEN_WIDTH }]}
                accessibilityLabel={`Listing photo ${index + 1}`}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderIcon}>🏠</Text>
          </View>
        )}

        <View style={styles.body}>
          {/* Title */}
          <Text style={styles.title}>{listing.title}</Text>

          {/* Area */}
          {areaLabel && (
            <Text style={styles.areaLabel}>{areaLabel}</Text>
          )}

          {/* View host profile — hidden on your own listing */}
          {!listing.isOwner && listing.ownerUid ? (
            <Text
              style={styles.hostLink}
              onPress={() => navigation.navigate('ViewProfile', { uid: listing.ownerUid })}
              accessibilityLabel="View host profile"
            >
              View host profile
            </Text>
          ) : null}

          {/* Address reveal card (green) when accepted; SafetyChip (amber) otherwise.
              Mutually exclusive — server controls which field is populated (T-02-03-01). */}
          {listing.addressRevealed && listing.exactAddress ? (
            <AddressRevealCard address={listing.exactAddress} />
          ) : (
            <View style={styles.safetyChipContainer}>
              <SafetyChip />
            </View>
          )}

          {/* Description */}
          {listing.description ? (
            <>
              <Text style={styles.sectionHeader}>About this space</Text>
              <Text style={styles.bodyText}>{listing.description}</Text>
            </>
          ) : null}

          {/* House rules */}
          {listing.houseRules ? (
            <>
              <Text style={styles.sectionHeader}>House rules</Text>
              <Text style={styles.bodyText}>{listing.houseRules}</Text>
            </>
          ) : null}

          {/* Availability dates */}
          {listing.availabilityDates && listing.availabilityDates.length > 0 ? (
            <>
              <Text style={styles.sectionHeader}>Availability</Text>
              {listing.availabilityDates.map((d, i) => (
                <Text key={i} style={styles.dateRow}>
                  {new Date(d.from).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                  {' → '}
                  {new Date(d.to).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </Text>
              ))}
            </>
          ) : null}
        </View>

        {/* Bottom padding for sticky button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View style={styles.stickyBottom}>
        {listing.isOwner ? (
          <TouchableOpacity
            style={[styles.ctaButton, styles.ctaButtonSecondary]}
            accessibilityLabel="Manage listing"
            accessibilityRole="button"
            onPress={() => {
              // Placeholder: manage listing flow (02-03)
            }}
          >
            <Text style={styles.ctaButtonSecondaryText}>Manage listing</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.ctaButton}
            accessibilityLabel="Request stay"
            accessibilityRole="button"
            onPress={() => {
              navigation.navigate('StayRequestCompose', { listingId: listing.id });
            }}
          >
            <Text style={styles.ctaButtonText}>Request stay</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 14,
    color: '#6200ea',
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerBackButton: {
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  headerBackText: {
    fontSize: 17,
    color: '#6200ea',
    fontWeight: '600',
  },
  photoCarousel: {
    height: 200,
  },
  carouselPhoto: {
    height: 200,
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    height: 200,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderIcon: {
    fontSize: 64,
  },
  body: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 6,
    lineHeight: 34,
  },
  areaLabel: {
    fontSize: 16,
    color: '#777777',
    marginBottom: 16,
    textTransform: 'capitalize',
  },
  hostLink: {
    fontSize: 15,
    color: '#6200ea',
    fontWeight: '600',
    marginBottom: 16,
  },
  safetyChipContainer: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111111',
    marginTop: 20,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 16,
    color: '#444444',
    lineHeight: 24,
  },
  dateRow: {
    fontSize: 14,
    color: '#444444',
    marginBottom: 4,
    lineHeight: 22,
  },
  stickyBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#dddddd',
  },
  ctaButton: {
    backgroundColor: '#6200ea',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  ctaButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  ctaButtonSecondary: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#6200ea',
  },
  ctaButtonSecondaryText: {
    color: '#6200ea',
    fontSize: 16,
    fontWeight: '600',
  },
});
