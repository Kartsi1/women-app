import { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import AvailabilityDatePicker, { DateRange } from '../Common/AvailabilityDatePicker';

interface Props {
  visible: boolean;
  initialValue: DateRange;
  onClose: () => void;
  onApply: (range: DateRange) => void;
}

/**
 * FilterSheet
 *
 * Slide-up modal for date-range filtering of map search results (LIST-05).
 * Manages its own local DateRange draft; emits via onApply when the user taps "Apply".
 *
 * UI-SPEC:
 *   - Background: #f5f5f5 (secondary)
 *   - Contains AvailabilityDatePicker + "Apply" CTA (accent #6200ea)
 *   - Modal slides up from the bottom (slide animation)
 */
export default function FilterSheet({ visible, initialValue, onClose, onApply }: Props) {
  const [draft, setDraft] = useState<DateRange>(initialValue);

  function handleApply() {
    onApply(draft);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        accessibilityLabel="Close filter sheet"
      />
      <SafeAreaView style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title}>Filter by dates</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityLabel="Close filter"
            accessibilityRole="button"
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <AvailabilityDatePicker value={draft} onChange={setDraft} />
        </View>

        <TouchableOpacity
          style={styles.applyButton}
          onPress={handleApply}
          accessibilityLabel="Apply date filter"
          accessibilityRole="button"
        >
          <Text style={styles.applyButtonText}>Apply</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    backgroundColor: '#f5f5f5',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#dddddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111111',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    color: '#777777',
  },
  content: {
    marginBottom: 8,
  },
  applyButton: {
    backgroundColor: '#6200ea',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    marginTop: 8,
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
