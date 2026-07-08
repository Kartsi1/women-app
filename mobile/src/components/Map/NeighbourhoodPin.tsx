import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Listing } from '../../types/listing';

interface Props {
  listing: Listing;
  selected?: boolean;
}

/**
 * NeighbourhoodPin
 *
 * Custom Marker child component for react-native-maps.
 * Purple circle with house Ionicon.
 * Accent #6200ea fill when selected; white fill when not selected.
 *
 * accessibilityLabel: "Listing in [area], [dates]"
 *
 * UI-SPEC: accent #6200ea (selected), #ffffff background (unselected)
 */
export default function NeighbourhoodPin({ listing, selected = false }: Props) {
  // Build accessibility label: "Listing in [area], [dates]"
  const area = listing.citySlug
    ? listing.citySlug.replace(/-/g, ' ')
    : 'unknown area';

  const firstDate = listing.availabilityDates?.[0];
  let datesLabel = '';
  if (firstDate) {
    const from = new Date(firstDate.from).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric',
    });
    const to = new Date(firstDate.to).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric',
    });
    datesLabel = `, ${from} – ${to}`;
  }

  const a11yLabel = `Listing in ${area}${datesLabel}`;

  return (
    <View
      style={[styles.pin, selected && styles.pinSelected]}
      accessibilityLabel={a11yLabel}
      accessibilityRole="button"
    >
      <Ionicons
        name="home"
        size={18}
        color={selected ? '#ffffff' : '#6200ea'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#6200ea',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  pinSelected: {
    backgroundColor: '#6200ea',
    borderColor: '#4a00b0',
  },
});
