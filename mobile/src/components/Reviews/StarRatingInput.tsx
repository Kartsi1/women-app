import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * StarRatingInput — interactive or read-only 5-star rating widget.
 *
 * Design (03-UI-SPEC.md):
 *   - 5 Ionicons star / star-outline icons
 *   - Visual icon size: 32×32dp (or overridden by iconSize prop)
 *   - Touch target: 44×44dp per star (enforced via minWidth/minHeight on TouchableOpacity)
 *   - Filled colour: #f9a825 (amber gold)
 *   - Empty colour:  #dddddd
 *   - No half-stars — only integer ratings 1-5
 *   - Interactive stars: accessibilityRole='button' + accessibilityLabel='[N] star'
 *   - Read-only variant: no press handlers (pass readOnly={true})
 *   - Gap between stars: 8dp (sm token)
 *
 * Security: StarRatingInput enforces 1-5 range via the onChange call — a tap
 * on star N always calls onChange(N). The submit button in ReviewComposeScreen
 * is disabled when value is 0 (unset); the server re-validates the range on POST.
 */

interface Props {
  value: number;          // current rating 0-5; 0 = unset (no stars filled)
  onChange?: (rating: number) => void; // omit or undefined for read-only
  readOnly?: boolean;     // explicit read-only flag; also implied when onChange is absent
  iconSize?: number;      // visual icon size in dp; default 32
}

const TOUCH_SIZE = 44;   // 44dp minimum touch target per star (UI-SPEC + accessibility)
const DEFAULT_ICON = 32; // visual icon size

const STAR_FILLED_COLOR = '#f9a825';
const STAR_EMPTY_COLOR  = '#dddddd';

export default function StarRatingInput({
  value,
  onChange,
  readOnly = false,
  iconSize = DEFAULT_ICON,
}: Props) {
  const isInteractive = !readOnly && typeof onChange === 'function';

  return (
    <View style={styles.row} accessibilityRole="none">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        const icon   = filled ? 'star' : 'star-outline';
        const color  = filled ? STAR_FILLED_COLOR : STAR_EMPTY_COLOR;

        if (isInteractive) {
          return (
            <TouchableOpacity
              key={star}
              style={[
                styles.touchTarget,
                { minWidth: TOUCH_SIZE, minHeight: TOUCH_SIZE },
              ]}
              onPress={() => onChange!(star)}
              accessibilityRole="button"
              accessibilityLabel={`${star} star`}
              accessibilityState={{ selected: star <= value }}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Ionicons name={icon} size={iconSize} color={color} />
            </TouchableOpacity>
          );
        }

        // Read-only — no press handler, no interaction
        return (
          <View
            key={star}
            style={[styles.touchTarget, { minWidth: iconSize + 8, minHeight: iconSize }]}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            <Ionicons name={icon} size={iconSize} color={color} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  touchTarget: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8, // sm spacing between stars
  },
});
