import { View, Text, StyleSheet } from 'react-native';
import StarRatingInput from './StarRatingInput';

/**
 * ReviewSummaryBar — compact row for ProfileScreen showing aggregated review stats.
 *
 * Design (03-UI-SPEC.md):
 *   - Renders NOTHING when revealedReviewCount is 0 (no "0 reviews" placeholder
 *     to avoid false impression for new users)
 *   - Average stars (Label/14px, e.g. "4.3")
 *   - Read-only StarRatingInput (small, 16dp icons) showing the rounded average
 *   - Review count (Label/14px muted, e.g. "· 12 reviews")
 *
 * @param avgRating          - average from server (null when no revealed reviews)
 * @param revealedReviewCount - count of revealed reviews (hide bar when 0)
 */

interface Props {
  avgRating: number | null;
  revealedReviewCount: number;
}

export default function ReviewSummaryBar({ avgRating, revealedReviewCount }: Props) {
  // Render nothing when there are no revealed reviews
  if (!revealedReviewCount || revealedReviewCount === 0) {
    return null;
  }

  // Round to one decimal for display
  const displayAvg = avgRating !== null ? avgRating.toFixed(1) : '—';
  // Star display uses rounded integer for the visual indicator
  const starValue = avgRating !== null ? Math.round(avgRating) : 0;

  return (
    <View style={styles.row}>
      <Text style={styles.avg}>{displayAvg}</Text>
      <StarRatingInput value={starValue} readOnly iconSize={16} />
      <Text style={styles.count}>· {revealedReviewCount} review{revealedReviewCount !== 1 ? 's' : ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avg: {
    fontSize: 14,
    color: '#111111',
    fontWeight: '400',
    marginRight: 6,
  },
  count: {
    fontSize: 14,
    color: '#777777',
    marginLeft: 4,
  },
});
