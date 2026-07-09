import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  /** The full exact address to display — only pass this when addressRevealed is true server-side */
  address: string;
}

/**
 * AddressRevealCard (REQT-03)
 *
 * Shown on ListingDetailScreen after a host accepts a stay request.
 * Renders in green (#e8f5e9 bg / #2e7d32 text) to signal a safe, trusted reveal.
 *
 * Security (T-02-03-01): this component only renders what the server sent.
 *   It is NOT the gate — the server controls address disclosure.
 *   The server must have already determined that an accepted StayRequest exists
 *   for this listing+guest before including exactAddress in the response.
 *
 * UI-SPEC tokens:
 *   - Background: #e8f5e9
 *   - Border: #a5d6a7
 *   - Heading colour: #2e7d32
 *   - Address text: #1b5e20
 *   - Icon: Ionicons "checkmark-circle" #2e7d32
 */
export default function AddressRevealCard({ address }: Props) {
  return (
    <View
      style={styles.card}
      accessibilityRole="text"
      accessibilityLabel={`Address revealed: ${address}`}
    >
      <View style={styles.header}>
        <Ionicons name="checkmark-circle" size={20} color="#2e7d32" />
        <Text style={styles.heading}>Address revealed</Text>
      </View>
      <Text style={styles.address}>{address}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#a5d6a7',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  heading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2e7d32',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  address: {
    fontSize: 16,
    color: '#1b5e20',
    lineHeight: 22,
    fontWeight: '500',
  },
});
