import { initializeApp } from 'firebase/app';
// initializeAuth + getReactNativePersistence must be imported from @firebase/auth (not
// firebase/auth) so that TypeScript resolves the react-native condition in @firebase/auth's
// package.json exports map and includes getReactNativePersistence in the type definitions.
import { initializeAuth, getReactNativePersistence } from '@firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// MUST use initializeAuth (not getAuth) for React Native persistence.
// Without getReactNativePersistence(AsyncStorage) the session is lost on app restart.
// See: RESEARCH.md Pitfall 4
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
