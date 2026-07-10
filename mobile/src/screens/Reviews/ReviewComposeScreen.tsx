import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/AppNavigator';
import StarRatingInput from '../../components/Reviews/StarRatingInput';
import { createReview, getStayReviews } from '../../services/api';
import { useReviewStore } from '../../store/reviewStore';

type Props = NativeStackScreenProps<AppStackParamList, 'ReviewCompose'>;

const MIN_TEXT_LENGTH = 20;

/**
 * ReviewComposeScreen (REVW-01, REVW-02)
 *
 * Allows a verified user to compose and submit an immutable star+text review
 * for a completed stay.
 *
 * Validation (UX-only — server re-validates as authoritative):
 *   - rating >= 1 (star selection required)
 *   - text.trim().length >= 20 (minimum 20 characters)
 *   - Submit button disabled until both criteria are met
 *
 * Immutability: the immutability notice "Reviews are final and cannot be edited
 * after submission." is shown below the submit button at all times, before and
 * after entry, to set expectation before tapping submit.
 *
 * On submit:
 *   - Button shows "Submitting…" + opacity 0.6
 *   - On success: refreshes stay review state in reviewStore, then goBack()
 *   - On error: shows inline error "Review not submitted. Please try again."
 *
 * Security: reviewerUid, direction, and subjectUid are derived server-side
 * from the verified Firebase token + StayRequest — never sent by this screen.
 *
 * Pattern: mobile/src/screens/Requests/StayRequestComposeScreen.tsx
 */
export default function ReviewComposeScreen({ route, navigation }: Props) {
  const { stayRequestId, subjectName, subjectUid } = route.params;

  const { setReviewState } = useReviewStore();

  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textLength = text.trim().length;
  const isValid = rating >= 1 && textLength >= MIN_TEXT_LENGTH;

  const textCountLabel = textLength < MIN_TEXT_LENGTH
    ? `${textLength}/${MIN_TEXT_LENGTH} minimum`
    : `${textLength} characters`;

  async function handleSubmit() {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await createReview({ stayRequestId, rating, text: text.trim() });

      if (res.error) {
        setError('Review not submitted. Please try again.');
      } else if (res.data?.id) {
        // Refresh the review state in the store so callers see 'waiting' state
        const refreshed = await getStayReviews(stayRequestId);
        if (refreshed.data) {
          setReviewState(stayRequestId, refreshed.data);
        }
        navigation.goBack();
      } else {
        setError('Review not submitted. Please try again.');
      }
    } catch {
      setError('Review not submitted. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back */}
        <TouchableOpacity
          style={styles.headerBack}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.headerBackText}>‹ Back</Text>
        </TouchableOpacity>

        {/* Screen title */}
        <Text style={styles.title}>Leave a review</Text>

        {/* Subject */}
        {subjectName ? (
          <View style={styles.subjectRow}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {subjectName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.subjectName}>{subjectName}</Text>
          </View>
        ) : null}

        {/* Star rating — required; rating 0 = unset */}
        <Text style={styles.label}>Your rating</Text>
        <StarRatingInput value={rating} onChange={setRating} />
        {rating === 0 ? (
          <Text style={styles.validationHint}>Please select a star rating.</Text>
        ) : null}

        {/* Review text */}
        <Text style={[styles.label, { marginTop: 20 }]}>Your review</Text>
        <TextInput
          style={styles.textInput}
          value={text}
          onChangeText={setText}
          placeholder="Share your experience…"
          placeholderTextColor="#999999"
          multiline
          textAlignVertical="top"
          accessibilityLabel="Review text"
        />

        {/* Live character count / minimum indicator */}
        <Text
          style={[
            styles.charCount,
            textLength < MIN_TEXT_LENGTH && text.length > 0 && styles.charCountWarning,
          ]}
        >
          {text.length > 0 ? textCountLabel : `0/${MIN_TEXT_LENGTH} minimum`}
        </Text>

        {text.length > 0 && textLength < MIN_TEXT_LENGTH ? (
          <Text style={styles.validationHint}>Please write at least 20 characters.</Text>
        ) : null}

        {/* Inline error */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Bottom padding for sticky button */}
        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Sticky submit area */}
      <View style={styles.stickyBottom}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!isValid || submitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!isValid || submitting}
          accessibilityLabel={submitting ? 'Submitting…' : 'Submit review'}
          accessibilityRole="button"
          accessibilityState={{ disabled: !isValid || submitting }}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {submitting ? 'Submitting…' : 'Submit review'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Immutability notice — always visible below button */}
        <Text style={styles.immutabilityNotice}>
          Reviews are final and cannot be edited after submission.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  headerBack: {
    paddingTop: 24,
    paddingBottom: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  headerBackText: {
    fontSize: 17,
    color: '#6200ea',
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 20,
    lineHeight: 34,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '600',
    color: '#555555',
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111111',
    minHeight: 120,
    backgroundColor: '#fafafa',
    lineHeight: 24,
  },
  charCount: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'right',
    marginTop: 4,
  },
  charCountWarning: {
    color: '#e65100',
  },
  validationHint: {
    fontSize: 14,
    color: '#d32f2f',
    marginTop: 4,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
    marginTop: 8,
    marginBottom: 8,
    lineHeight: 20,
  },
  stickyBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#dddddd',
  },
  submitButton: {
    backgroundColor: '#6200ea',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  immutabilityNotice: {
    fontSize: 14,
    color: '#777777',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
});
