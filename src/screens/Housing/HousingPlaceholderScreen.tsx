import { View, Text, StyleSheet } from 'react-native';

/**
 * Temporary placeholder for the Housing tab.
 *
 * Will be replaced by MapDiscoveryScreen (plan 02-02) when the
 * listing map and geo-search feature slices are implemented.
 */
export default function HousingPlaceholderScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Housing</Text>
      <Text style={styles.sub}>Coming soon — plan 02-02</Text>
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
