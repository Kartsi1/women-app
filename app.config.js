/**
 * Dynamic Expo config — replaces static app.json so we can read
 * EXPO_PUBLIC_GOOGLE_MAPS_API_KEY at build time without hardcoding it.
 *
 * IMPORTANT: EXPO_PUBLIC_* vars are embedded in the client bundle and are NOT secret.
 * Protect the key via Google Cloud Console API key restrictions.
 *
 * User setup required (plan 02-01 user_setup):
 *   1. Create a Google Maps API key in Google Cloud Console
 *      → Enable "Maps SDK for Android"
 *      → Restrict to your Android app package name
 *   2. Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to your .env file
 *   3. Run `eas init` in /mobile to replace YOUR_EAS_PROJECT_ID with a real project ID
 */

const mapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name: 'mobile',
    slug: 'mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      config: {
        // Google Maps API key for Android native map rendering (RESEARCH Pattern 8)
        // Value injected from EXPO_PUBLIC_GOOGLE_MAPS_API_KEY env var at build time
        googleMaps: {
          apiKey: mapsApiKey,
        },
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#E6F4FE',
        },
      ],
      [
        'react-native-maps',
        {
          // androidGoogleMapsApiKey is the plugin config key for react-native-maps
          // The actual key value comes from the android.config.googleMaps.apiKey above
          // Setting both ensures correct injection regardless of plugin version behaviour
          androidGoogleMapsApiKey: mapsApiKey,
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'WomenApp uses your location to show nearby housing listings.',
        },
      ],
      '@react-native-community/datetimepicker',
    ],
    extra: {
      eas: {
        projectId: 'YOUR_EAS_PROJECT_ID',
      },
    },
  },
};
