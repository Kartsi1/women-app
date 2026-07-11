import { useEffect } from 'react';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import * as Notifications from 'expo-notifications';
import { auth } from '../config/firebase';
import { useAuthStore } from '../store/authStore';
import { registerForPushNotifications } from '../services/push';
import { getMyProfile } from '../services/api';
import { navigationRef } from '../navigation/navigationRef';

type ProfileResponse = {
  data?: {
    verificationStatus?: 'none' | 'pending' | 'approved' | 'rejected';
    rejectionReason?: string | null;
  };
};

export function useFirebaseAuth() {
  const { setUser, setVerified, setVerificationStatus, clear, setExpoPushToken } = useAuthStore();

  // Subscribe to Firebase auth state changes and sync verification status from token claims.
  // After a successful login, register for push notifications once per session.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const tokenResult = await getIdTokenResult(user);
        setUser(user);
        setVerified(!!tokenResult.claims.isVerified);

        // Restore verification workflow state from the backend so a reload /
        // cold-start lands on the correct verification screen (pending vs upload)
        // instead of always resetting to DocumentUpload. Fails soft to 'none'.
        try {
          const profile = (await getMyProfile()) as ProfileResponse;
          if (profile?.data?.verificationStatus) {
            setVerificationStatus(
              profile.data.verificationStatus,
              profile.data.rejectionReason ?? null,
            );
          }
        } catch {
          // leave default; VerificationNavigator falls back to DocumentUpload
        }

        // Register for push notifications on login. Guard against duplicate
        // registration within the same session by checking the store directly.
        // Registering on login (not only on approval) guarantees a token exists
        // BEFORE the admin approves, so the approval push can be delivered.
        if (!useAuthStore.getState().expoPushToken) {
          registerForPushNotifications().then((token) => {
            if (token) setExpoPushToken(token);
          });
        }
      } else {
        clear();
      }
    });
    return unsubscribe;
  }, []);

  // D-09 + REQT-04: Notification response handler.
  //
  // Handles two notification types:
  //   1. verification_approved / verification_rejected: force-refresh the Firebase ID token
  //      so the new isVerified custom claim is picked up immediately (D-09).
  //   2. stay_request: deep-link to the appropriate screen based on the viewer's role:
  //      - Host receiving a new request → HostInbox
  //      - Guest receiving accept/decline → RequestStatus (with requestId + listingId)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (!data) return;

      // Verification push — force-refresh token so custom claim propagates (D-09)
      if (data.type === 'verification_approved' || data.type === 'verification_rejected') {
        const currentUser = auth.currentUser;
        if (currentUser) {
          await currentUser.getIdToken(true);
          // onAuthStateChanged will fire again and update the store
        }
        return;
      }

      // Stay request push — deep-link to the right screen (REQT-04)
      // Use `as never` cast on the route name to bypass react-navigation's
      // strict generic typing on the untyped navigationRef (the ref is created
      // without type params so the navigate signature accepts `never` for both args).
      if (data.type === 'stay_request' && navigationRef.isReady()) {
        if (data.status) {
          // Guest receiving accepted/declined decision → Housing > RequestStatus
          const requestParams: Record<string, string> = { requestId: data.requestId ?? '' };
          if (data.listingId) requestParams.listingId = data.listingId;
          // @ts-expect-error — untyped navigationRef; deep-link into nested navigator is safe
          navigationRef.current?.navigate('Housing', {
            screen: 'RequestStatus',
            params: requestParams,
          });
        } else {
          // Host receiving a new stay request → Housing > HostInbox
          // @ts-expect-error — untyped navigationRef; safe nested navigation
          navigationRef.current?.navigate('Housing', {
            screen: 'HostInbox',
          });
        }
      }
    });
    return () => subscription.remove();
  }, []);
}
