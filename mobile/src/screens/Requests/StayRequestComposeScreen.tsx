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
import type { HousingStackParamList } from '../../navigation/AppNavigator';
import AvailabilityDatePicker, { DateRange } from '../../components/Common/AvailabilityDatePicker';
import { createStayRequest } from '../../services/api';

type Props = NativeStackScreenProps<HousingStackParamList, 'StayRequestCompose'>;

const MAX_INTRO = 500;

/**
 * StayRequestComposeScreen (REQT-01)
 *
 * Allows a verified guest to compose and send a dated stay request with an intro message.
 *
 * Form validation (all server-mirrored):
 *   - checkIn + checkOut: both required; checkOut >= checkIn (AvailabilityDatePicker enforces)
 *   - intro: required, non-empty, max 500 chars with live counter
 *   - "Request stay" button disabled until both dates and a non-empty intro are set
 *
 * UX flow:
 *   - "Requesting…" label + opacity 0.6 while in-flight
 *   - Inline error on failure ("Request not sent. Please try again.")
 *   - On success: navigate to RequestStatus screen
 */
export default function StayRequestComposeScreen({ route, navigation }: Props) {
  const { listingId } = route.params;

  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [intro, setIntro] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    dateRange.from !== null &&
    dateRange.to !== null &&
    intro.trim().length > 0 &&
    intro.length <= MAX_INTRO;

  async function handleSubmit() {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createStayRequest({
        listingId,
        checkIn: dateRange.from!.toISOString(),
        checkOut: dateRange.to!.toISOString(),
        intro: intro.trim(),
      });
      if (res.error) {
        setError('Request not sent. Please try again.');
      } else if (res.data?.id) {
        navigation.navigate('RequestStatus', { requestId: res.data.id });
      } else {
        setError('Request not sent. Please try again.');
      }
    } catch {
      setError('Request not sent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Back */}
        <TouchableOpacity
          style={styles.headerBack}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.headerBackText}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Request a stay</Text>
        <Text style={styles.subtitle}>Select dates and introduce yourself to the host.</Text>

        {/* Date picker pre-filled from listing availability */}
        <AvailabilityDatePicker value={dateRange} onChange={setDateRange} />

        {/* Intro message */}
        <Text style={styles.label}>Your introduction</Text>
        <TextInput
          style={styles.introInput}
          value={intro}
          onChangeText={setIntro}
          placeholder="Tell the host a little about yourself and why you're travelling…"
          placeholderTextColor="#999999"
          multiline
          maxLength={MAX_INTRO}
          accessibilityLabel="Introduction message"
        />
        {/* Live character count */}
        <Text
          style={[
            styles.charCount,
            intro.length > MAX_INTRO - 50 && styles.charCountWarning,
          ]}
        >
          {intro.length}/{MAX_INTRO}
        </Text>

        {/* Inline error */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Bottom padding for sticky button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky submit */}
      <View style={styles.stickyBottom}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!isValid || submitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!isValid || submitting}
          accessibilityLabel={submitting ? 'Requesting…' : 'Request stay'}
          accessibilityRole="button"
          accessibilityState={{ disabled: !isValid || submitting }}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {submitting ? 'Requesting…' : 'Request stay'}
            </Text>
          )}
        </TouchableOpacity>
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
    marginBottom: 8,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 15,
    color: '#666666',
    lineHeight: 22,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 8,
    marginTop: 8,
  },
  introInput: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#111111',
    minHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: '#fafafa',
    lineHeight: 22,
  },
  charCount: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 16,
  },
  charCountWarning: {
    color: '#e65100',
  },
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
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
});
