import { View, Text, StyleSheet } from 'react-native';

/**
 * Temporary placeholder for the Messages tab.
 *
 * Will be replaced by ConversationListScreen (plan 02-04) when the
 * real-time DM + city group chat slices are implemented.
 */
export default function MessagesPlaceholderScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Messages</Text>
      <Text style={styles.sub}>Coming soon — plan 02-04</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 24,
    fontWeight: '600',
    color: '#6200ea',
  },
  sub: {
    marginTop: 8,
    fontSize: 14,
    color: '#888',
  },
});
