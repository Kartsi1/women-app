import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HousingStackParamList } from '../../navigation/AppNavigator';
import { getListingDetail } from '../../services/api';
import type { StayRequestData } from '../../services/api';
import AddressRevealCard from '../../components/Listings/AddressRevealCard';

type Props = NativeStackScreenProps<HousingStackParamList, 'RequestStatus'>;

/**
 * RequestStatusScreen (REQT-03, REQT-04)
 *
 * Read-only view of a sent stay request's status (pending / accepted / declined).
 * Navigated to from StayRequestComposeScreen on success, or via push notification deep-link.
 *
 * When status is 'accepted', fetches the listing detail which now includes
 * the revealed exact address — surfaces AddressRevealCard.
 *
 * Deep-link handling:
 *   Push notifications of type 'stay_request' include requestId in the data payload.
 *   The notification response handler in push.ts navigates here with that requestId.
 */
export default function RequestStatusScreen({ route, navigation }: Props) {
  const { requestId, listingId: routeListingId } = route.params;

  // We receive the requestId from the push notification or from the compose screen.
  // If we also received a listingId, we can immediately try to fetch the listing detail
  // to show the address reveal. Otherwise we show a generic status view.
  const [listing, setListing] = useState<{ exactAddress: string | null; addressRevealed: boolean; id: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (routeListingId) {
      loadListing(routeListingId);
    }
  }, [routeListingId]);

  async function loadListing(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await getListingDetail(id);
      if (res.data) {
        setListing({
          id: res.data.id,
          exactAddress: res.data.exactAddress,
          addressRevealed: res.data.addressRevealed,
        });
      }
    } catch {
      // Non-fatal — the status view is still useful without the address
      setError('Could not load listing details.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Back */}
      <TouchableOpacity
        style={styles.headerBack}
        onPress={() => navigation.goBack()}
        accessibilityLabel="Go back"
        accessibilityRole="button"
      >
        <Text style={styles.headerBackText}>‹ Back</Text>
      </TouchableOpacity>

      <View style={styles.body}>
        <Text style={styles.title}>Request sent</Text>
        <Text style={styles.requestId}>Request ID: {requestId}</Text>

        {/* Status description */}
        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusPending}>Pending host response</Text>
          <Text style={styles.statusHint}>
            You will receive a push notification when the host accepts or declines your request.
          </Text>
        </View>

        {/* Address reveal — shown when the listing detail reports addressRevealed=true */}
        {loading && <ActivityIndicator color="#6200ea" style={{ marginTop: 24 }} />}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {listing?.addressRevealed && listing.exactAddress ? (
          <View style={styles.revealSection}>
            <Text style={styles.revealSectionTitle}>Your stay is confirmed</Text>
            <AddressRevealCard address={listing.exactAddress} />
            <TouchableOpacity
              style={styles.backToListingButton}
              onPress={() => {
                if (listing.id) {
                  navigation.navigate('ListingDetail', { listingId: listing.id });
                }
              }}
              accessibilityLabel="View listing"
              accessibilityRole="button"
            >
              <Text style={styles.backToListingText}>View listing details</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  headerBack: {
    paddingHorizontal: 24,
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
  body: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
    lineHeight: 34,
  },
  requestId: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 24,
    fontFamily: 'monospace' as const,
  },
  statusBox: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eeeeee',
    padding: 16,
    marginBottom: 24,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statusPending: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  statusHint: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  revealSection: {
    marginTop: 8,
  },
  revealSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2e7d32',
    marginBottom: 12,
  },
  backToListingButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#6200ea',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  backToListingText: {
    color: '#6200ea',
    fontSize: 15,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
    marginTop: 8,
  },
});
