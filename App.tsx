import { useFirebaseAuth } from './src/hooks/useFirebaseAuth';
import { RootNavigator } from './src/navigation/RootNavigator';

/**
 * App root — Expo entry point.
 *
 * useFirebaseAuth() subscribes to onAuthStateChanged and the notification-tap
 * token-refresh listener BEFORE navigation renders. This is required so that
 * the D-09 notification handler is active when the app first mounts.
 */
export default function App() {
  useFirebaseAuth();
  return <RootNavigator />;
}
