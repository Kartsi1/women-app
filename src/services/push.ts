import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { savePushToken } from './api';

/**
 * Requests notification permissions, obtains an Expo push token, and saves it
 * to the backend for the authenticated user.
 *
 * Returns the token string on success, or null if:
 *  - permission is denied
 *  - EAS projectId is not yet configured in app.json extra.eas.projectId
 *    (run `eas init` in mobile/ to populate it)
 *  - registration fails for any other reason
 *
 * T-06-02: the backend push-token endpoint keys on req.user.uid from the
 * verified Firebase token, so only the authenticated user's token is saved.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Android requires a notification channel for push tokens to be usable.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  // Check existing permission before prompting (avoids prompt on every login).
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('[push] Notification permission not granted — push registration skipped');
    return null;
  }

  // Read the EAS project ID from app.json extra.eas.projectId.
  // getExpoPushTokenAsync requires this when EAS Build is in use; it will
  // not work with the placeholder value left before `eas init` is run.
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId || projectId === 'YOUR_EAS_PROJECT_ID') {
    console.warn(
      '[push] EAS projectId not configured — run `eas init` in mobile/ then update app.json'
    );
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    await savePushToken(token);
    return token;
  } catch (error) {
    console.error('[push] Failed to register Expo push token:', error);
    return null;
  }
}
