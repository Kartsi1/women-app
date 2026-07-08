import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

/**
 * AvailabilityDatePicker
 *
 * Two tappable label rows (Check-in / Check-out) that open the native date picker.
 * Emits { from, to } DateRange on change.
 * Enforces to >= from.
 *
 * UI-SPEC tokens:
 *   - Label 14px / #111
 *   - Border #dddddd, radius 8
 *   - Accent #6200ea for active label
 *   - Secondary bg #f5f5f5
 */
export default function AvailabilityDatePicker({ value, onChange }: Props) {
  const [showPicker, setShowPicker] = useState<'from' | 'to' | null>(null);

  function formatDate(d: Date | null): string {
    if (!d) return 'Select date';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function handleChange(_event: DateTimePickerEvent, selected?: Date) {
    // On Android the picker closes immediately; on iOS it stays open
    if (Platform.OS === 'android') {
      setShowPicker(null);
    }
    if (!selected) return;

    if (showPicker === 'from') {
      // Enforce to >= from: if new from is after existing to, clear to
      const newTo = value.to && selected > value.to ? null : value.to;
      onChange({ from: selected, to: newTo });
    } else if (showPicker === 'to') {
      // Enforce to >= from: reject dates before from
      if (value.from && selected < value.from) return;
      onChange({ from: value.from, to: selected });
    }
  }

  function handleDismiss() {
    setShowPicker(null);
  }

  const pickerDate =
    showPicker === 'from'
      ? value.from ?? new Date()
      : value.to ?? value.from ?? new Date();

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Availability</Text>

      <TouchableOpacity
        style={styles.row}
        onPress={() => setShowPicker('from')}
        accessibilityLabel="Select check-in date"
        accessibilityRole="button"
      >
        <Text style={styles.rowLabel}>Check-in</Text>
        <Text style={[styles.rowValue, !value.from && styles.placeholder]}>
          {formatDate(value.from)}
        </Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity
        style={styles.row}
        onPress={() => setShowPicker('to')}
        accessibilityLabel="Select check-out date"
        accessibilityRole="button"
      >
        <Text style={styles.rowLabel}>Check-out</Text>
        <Text style={[styles.rowValue, !value.to && styles.placeholder]}>
          {formatDate(value.to)}
        </Text>
      </TouchableOpacity>

      {showPicker !== null && (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={showPicker === 'to' && value.from ? value.from : new Date()}
          onChange={handleChange}
          onTouchCancel={handleDismiss}
        />
      )}

      {/* iOS: explicit confirm button since the picker stays open */}
      {showPicker !== null && Platform.OS === 'ios' && (
        <TouchableOpacity
          style={styles.iosConfirm}
          onPress={handleDismiss}
          accessibilityLabel="Confirm date"
          accessibilityRole="button"
        >
          <Text style={styles.iosConfirmText}>Done</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#777777',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#111111',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6200ea',
  },
  placeholder: {
    color: '#999999',
  },
  divider: {
    height: 1,
    backgroundColor: '#dddddd',
    marginHorizontal: 14,
  },
  iosConfirm: {
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#dddddd',
  },
  iosConfirmText: {
    color: '#6200ea',
    fontSize: 16,
    fontWeight: '600',
  },
});
