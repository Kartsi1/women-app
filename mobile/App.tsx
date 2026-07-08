import * as Notifications from 'expo-notifications';
import { useFirebaseAuth } from './src/hooks/useFirebaseAuth';
import { RootNavigator } from './src/navigation/RootNavigator';

/**
 * Set the foreground notification handler at module scope so it is active
 * before any navigation or auth logic runs.
 *
 * T-06-01: notification tap only triggers getIdToken(true) — actual access
 * derives from the signed isVerified custom claim set by the backend (D-08),
 * not from the push payload itself.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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
