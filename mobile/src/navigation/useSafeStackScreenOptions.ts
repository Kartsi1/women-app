import { useMemo } from 'react';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Shared native-stack screenOptions for every stack in the app.
 *
 * Expo 57 / RN 0.86 always render edge-to-edge on Android, and all stacks use
 * headerShown: false, so screen content would otherwise draw from y=0 underneath
 * the status bar (buttons untappable). contentStyle applies the real top safe-area
 * inset once, centrally. The bottom tab bar already handles the bottom inset.
 */
export function useSafeStackScreenOptions(): NativeStackNavigationOptions {
  const insets = useSafeAreaInsets();
  return useMemo(
    () => ({
      headerShown: false,
      contentStyle: { paddingTop: insets.top, backgroundColor: '#fff' },
    }),
    [insets.top],
  );
}
