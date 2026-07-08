import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';
import { VerificationNavigator } from './VerificationNavigator';
import { disconnectSocket } from '../services/socketService';

/**
 * Top-level navigator that gates access based on auth + verification state.
 *
 * Branches:
 *   !user                     → AuthNavigator (SignUp, SignIn)
 *   user && !isVerified        → VerificationNavigator (DocumentUpload + PendingVerification)
 *   user && isVerified         → AppNavigator (main app — bottom-tab shell)
 *
 * VerificationNavigator replaces the previous direct render of
 * PendingVerificationScreen because DocumentUploadScreen and
 * PendingVerificationScreen must share a navigation stack so the
 * Resubmit button (D-06) can navigate between them.
 *
 * Client-side gate is defense-in-depth; authoritative enforcement is the backend
 * requireVerified middleware (T-02-01).
 *
 * Socket.io lifecycle:
 *  - connectSocket() is called in AppNavigator once user lands in the verified shell
 *  - disconnectSocket() is called here when user signs out (user becomes null)
 */
export function RootNavigator() {
  const { user, isVerified } = useAuthStore();

  // Disconnect socket when the user signs out (user transitions to null)
  useEffect(() => {
    if (!user) {
      disconnectSocket();
    }
  }, [user]);

  return (
    <NavigationContainer>
      {!user ? (
        <AuthNavigator />
      ) : !isVerified ? (
        <VerificationNavigator />
      ) : (
        <AppNavigator />
      )}
    </NavigationContainer>
  );
}
