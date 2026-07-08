import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * SafetyChip (LIST-03 / T-02-02-01)
 *
 * Amber pill with lock icon + "Address hidden until accepted".
 * Always shown to guests when addressRevealed is false.
 * Never shown after address is revealed (AddressRevealCard shown instead in 02-03).
 *
 * UI-SPEC:
 *   - Background: #fff3e0 (Safety / address-hidden)
 *   - Text/icon: #e65100
 *   - accessibilityRole="text", importantForAccessibility="yes"
 */
export default function SafetyChip() {
  return (
    <View
      style={styles.chip}
      accessibilityRole="text"
      importantForAccessibility="yes"
      accessibilityLabel="Address hidden until stay request is accepted"
    >
      <Ionicons name="lock-closed" size={14} color="#e65100" style={styles.icon} />
      <Text style={styles.text}>Address hidden until accepted</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fff3e0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  icon: {
    // already coloured via prop
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e65100',
  },
});
