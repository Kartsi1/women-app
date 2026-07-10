import { View, Text, StyleSheet } from 'react-native';
import StarRatingInput from './StarRatingInput';
import type { Review } from '../../types/community';

/**
 * ReviewCard — shows a single revealed review.
 *
 * Rendered only after the blind-release predicate fires (state === 'revealed').
 * The caller is responsible for only passing reviews that the server has made
 * visible — ReviewCard never inspects or overrides the reveal state.
 *
 * Design (03-UI-SPEC.md):
 *   - Reviewer name: Body/16px Semibold (#111111)
 *   - Read-only StarRatingInput (32dp icon size)
 *   - Review text: Body/16px (#444444)
 *   - Timestamp: Label/14px muted (#777777)
 *   - Card border: #dddddd, background #ffffff
 */

interface Props {
  review: Review;
  reviewerName?: string; // display name of the reviewer (optional — falls back to 'Reviewer')
  label?: string;        // e.g. "Your review (submitted)" or "[Name]'s review"
}

export default function ReviewCard({ review, reviewerName, label }: Props) {
  const timestamp = new Date(review.submittedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={styles.card}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Text style={styles.reviewerName}>{reviewerName ?? 'Reviewer'}</Text>

      <StarRatingInput value={review.rating} readOnly iconSize={20} />

      <Text style={styles.text}>{review.text}</Text>

      <Text style={styles.timestamp}>{timestamp}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 8,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 8,
  },
  text: {
    fontSize: 16,
    color: '#444444',
    lineHeight: 24,
    marginTop: 8,
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 14,
    color: '#777777',
    marginTop: 4,
  },
});
