// Platform map shim — web fallback.
// react-native-maps is native-only: importing it under react-native-web throws
// "codegenNativeComponent is not a function" at module load. This stub keeps the web
// bundle running (web is a dev convenience; maps are an Android/iOS feature) by
// rendering a placeholder instead of a real map. Metro picks this file on web.
import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

// Marker renders nothing on web. Accepts (and ignores) the native Marker props so
// call sites type-check identically across platforms.
type MarkerProps = {
  coordinate?: { latitude: number; longitude: number };
  children?: React.ReactNode;
  [key: string]: unknown;
};
export function Marker(_props: MarkerProps): React.ReactElement | null {
  return null;
}

type MapViewProps = {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  [key: string]: unknown;
};

// No imperative ref methods are used by the current screens, so a plain component
// suffices. Children (Markers) are intentionally not rendered — the web map is a
// non-interactive placeholder.
export default function MapView({ style }: MapViewProps): React.ReactElement {
  return (
    <View style={[styles.fallback, style]}>
      <Text style={styles.text}>
        Карта доступна в мобильном приложении (Android / iOS).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: 24,
    minHeight: 200,
  },
  text: {
    fontSize: 14,
    color: '#777777',
    textAlign: 'center',
  },
});
