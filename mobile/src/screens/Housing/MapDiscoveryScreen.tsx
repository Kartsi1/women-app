import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HousingStackParamList } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<HousingStackParamList, 'MapDiscovery'>;

/**
 * MapDiscoveryScreen — placeholder replaced in Task 3.
 * @placeholder replaced by full implementation in Task 3 of this plan
 */
export default function MapDiscoveryScreen({ navigation: _navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Map loading…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  text: { fontSize: 16, color: '#777' },
});
