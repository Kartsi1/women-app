import { View, Text, Image, StyleSheet } from 'react-native';
import type { Listing } from '../../types/listing';
import { mediaUri } from '../../utils/media';

interface Props {
  listing: Listing;
}

/**
 * ListingCard
 *
 * Horizontal card for listing search results / map summary callout.
 *
 * UI-SPEC:
 *   - Photo thumb: 80×80
 *   - Title: Heading 20px / 600
 *   - Area label (city slug): Label 14px / muted #777
 *   - Date range: Label 14px
 *   - "Free stay" tag: accent #6200ea, small pill
 *   - Card bg: #f5f5f5
 */
export default function ListingCard({ listing }: Props) {
  const photoUrl = listing.photoUrl ?? listing.photos?.[0];

  // Format date range from first availability window
  const firstDate = listing.availabilityDates?.[0];
  let dateLabel = '';
  if (firstDate) {
    const from = new Date(firstDate.from).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    const to = new Date(firstDate.to).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    dateLabel = `${from} – ${to}`;
  }

  return (
    <View style={styles.card}>
      {/* Photo thumbnail */}
      {photoUrl ? (
        <Image source={{ uri: mediaUri(photoUrl) }} style={styles.photo} accessibilityLabel="Listing photo" />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.photoPlaceholderText}>🏠</Text>
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {listing.title}
        </Text>

        {listing.citySlug || listing.location?.coordinates ? (
          <Text style={styles.area}>
            {listing.citySlug
              ? listing.citySlug.replace(/-/g, ' ')
              : 'Nearby'}
          </Text>
        ) : null}

        {dateLabel ? (
          <Text style={styles.dates}>{dateLabel}</Text>
        ) : null}

        <View style={styles.freeTag}>
          <Text style={styles.freeTagText}>Free stay</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 8,
    flexShrink: 0,
  },
  photoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  photoPlaceholderText: {
    fontSize: 28,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111111',
    lineHeight: 26,
  },
  area: {
    fontSize: 14,
    color: '#777777',
    textTransform: 'capitalize',
  },
  dates: {
    fontSize: 14,
    color: '#444444',
  },
  freeTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#ede7f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 2,
  },
  freeTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6200ea',
  },
});
