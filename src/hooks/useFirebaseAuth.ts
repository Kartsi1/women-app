import { useEffect } from 'react';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import * as Notifications from 'expo-notifications';
import { auth } from '../config/firebase';
import { useAuthStore } from '../store/authStore';

export function useFirebaseAuth() {
  const { setUser, setVerified, clear } = useAuthStore();

  // Subscribe to Firebase auth state changes and sync verification status from token claims.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const tokenResult = await getIdTokenResult(user);
        setUser(user);
        setVerified(!!tokenResult.claims.isVerified);
      } else {
        clear();
      }
    });
    return unsubscribe;
  }, []);

  // D-09: When the user taps an approval/rejection push notification, force-refresh the
  // Firebase ID token so the new isVerified custom claim is picked up immediately.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'verification_approved' || data?.type === 'verification_rejected') {
        const currentUser = auth.currentUser;
        if (currentUser) {
          await currentUser.getIdToken(true);
          // onAuthStateChanged will fire again and update the store
        }
      }
    });
    return () => subscription.remove();
  }, []);
}
