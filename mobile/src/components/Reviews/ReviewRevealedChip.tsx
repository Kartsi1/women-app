import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * ReviewRevealedChip — green pill shown when the blind-release predicate has
 * fired server-side and both reviews are now visible (state === 'revealed').
 *
 * Design (03-UI-SPEC.md — mirrors phase-2 AddressRevealCard chip-variant):
 *   - Background: #e8f5e9 (green light)
 *   - Text/icon: #2e7d32 (green dark)
 *   - Shape: pill (border-radius 20dp), padding 8dp (sm)
 *   - Icon: checkmark-circle-outline (Ionicons), left-aligned
 *   - Copy: "Reviews revealed"
 *   - accessibilityRole='text', importantForAccessibility='yes'
 */

export default function ReviewRevealedChip() {
  return (
    <View
      style={styles.chip}
      accessibilityRole="text"
      importantForAccessibility="yes"
      accessibilityLabel="Reviews revealed"
    >
      <Ionicons name="checkmark-circle-outline" size={16} color="#2e7d32" style={styles.icon} />
      <Text style={styles.chipText}>Reviews revealed</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  icon: {
    marginRight: 6,
  },
  chipText: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '600',
  },
});
