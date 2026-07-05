import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';
import { VerificationNavigator } from './VerificationNavigator';

/**
 * Top-level navigator that gates access based on auth + verification state.
 *
 * Branches:
 *   !user                     → AuthNavigator (SignUp, SignIn)
 *   user && !isVerified        → VerificationNavigator (DocumentUpload + PendingVerification)
 *   user && isVerified         → AppNavigator (main app)
 *
 * VerificationNavigator replaces the previous direct render of
 * PendingVerificationScreen because DocumentUploadScreen and
 * PendingVerificationScreen must share a navigation stack so the
 * Resubmit button (D-06) can navigate between them.
 *
 * Client-side gate is defense-in-depth; authoritative enforcement is the backend
 * requireVerified middleware (T-02-01).
 */
export function RootNavigator() {
  const { user, isVerified } = useAuthStore();

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
