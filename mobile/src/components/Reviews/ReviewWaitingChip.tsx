import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * ReviewWaitingChip — amber pill shown when the reviewer has submitted but
 * the counterpart's review is still withheld by the server (state === 'waiting').
 *
 * SAFETY INVARIANT (T-03-04-01):
 *   This component MUST NOT accept, receive, or render any counterpart review
 *   content. The component interface is intentionally designed with no prop
 *   for counterpart text/rating. The blind-release gate lives server-side (03-03);
 *   this chip communicates the wait honestly without any access to withheld content.
 *
 * Design (03-UI-SPEC.md — mirrors phase-2 SafetyChip exactly):
 *   - Background: #fff3e0 (amber light)
 *   - Text/icon: #e65100 (amber dark)
 *   - Shape: pill (border-radius 20dp), padding 8dp (sm)
 *   - Icon: hourglass-outline (Ionicons), left-aligned
 *   - Copy: "Review submitted — reveal pending"
 *   - Optional deadline hint below: "Reveals on [date] if [Name] hasn't responded"
 *     - Date is computed client-side from revealDeadline for display only
 *     - This is NOT a gate — the server decides when to reveal
 *   - accessibilityRole='text', importantForAccessibility='yes'
 *
 * @param revealDeadline - ISO date string from server (display only)
 * @param counterpartName - name for the hint line (optional)
 */

interface Props {
  revealDeadline?: string;  // ISO 8601 — used for deadline hint display only
  counterpartName?: string; // for the hint "if [Name] hasn't responded"
}

export default function ReviewWaitingChip({ revealDeadline, counterpartName }: Props) {
  // Format deadline for display only — NOT a reveal gate
  const deadlineDisplay = revealDeadline
    ? new Date(revealDeadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  return (
    <View style={styles.wrapper}>
      <View
        style={styles.chip}
        accessibilityRole="text"
        importantForAccessibility="yes"
        accessibilityLabel="Review submitted — reveal pending"
      >
        <Ionicons name="hourglass-outline" size={16} color="#e65100" style={styles.icon} />
        <Text style={styles.chipText}>Review submitted — reveal pending</Text>
      </View>
      {deadlineDisplay ? (
        <Text style={styles.hint}>
          Reveals on {deadlineDisplay}
          {counterpartName ? ` if ${counterpartName} hasn't responded` : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 6,
  },
  chipText: {
    fontSize: 14,
    color: '#e65100',
    fontWeight: '600',
  },
  hint: {
    fontSize: 14,
    color: '#777777',
    marginTop: 6,
    marginLeft: 4,
  },
});
