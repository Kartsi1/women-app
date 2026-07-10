import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

/**
 * ReviewEligibleBanner — shown on ProfileScreen when the current user has
 * a pending (eligible) review they haven't yet submitted for a stay.
 *
 * Design (03-UI-SPEC.md Copywriting):
 *   - Body: "You stayed with [Name]. Leave a review before [date]."
 *   - CTA: "Leave review" (accent text)
 *   - date is computed from revealDeadline (display only — NOT a gate)
 *   - Navigates to ReviewCompose with stayRequestId + subject info
 *
 * @param stayRequestId    - MongoDB ObjectId of the stay (passed to ReviewCompose)
 * @param subjectName      - Display name of the person to review
 * @param subjectUid       - Firebase UID (passed to ReviewCompose for server use)
 * @param revealDeadline   - ISO date from server — displayed as deadline hint
 * @param onPress          - called when "Leave review" is tapped
 */

interface Props {
  stayRequestId: string;
  subjectName: string;
  subjectUid?: string;
  revealDeadline?: string;
  onPress: () => void;
}

export default function ReviewEligibleBanner({
  subjectName,
  revealDeadline,
  onPress,
}: Props) {
  const deadlineDisplay = revealDeadline
    ? new Date(revealDeadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  return (
    <View style={styles.banner}>
      <Text style={styles.body}>
        You stayed with {subjectName}.
        {deadlineDisplay ? ` Leave a review before ${deadlineDisplay}.` : ' Leave a review.'}
      </Text>
      <TouchableOpacity
        style={styles.cta}
        onPress={onPress}
        accessibilityLabel={`Leave review for ${subjectName}`}
        accessibilityRole="button"
      >
        <Text style={styles.ctaText}>Leave review</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#6200ea',
  },
  body: {
    fontSize: 14,
    color: '#444444',
    lineHeight: 20,
    marginBottom: 8,
  },
  cta: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: 8,
  },
  ctaText: {
    fontSize: 14,
    color: '#6200ea',
    fontWeight: '600',
  },
});
