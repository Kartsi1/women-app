import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';
import PendingVerificationScreen from '../screens/Auth/PendingVerificationScreen';

/**
 * Top-level navigator that gates access based on auth + verification state.
 *
 * Branches:
 *   !user                     → AuthNavigator (SignUp, SignIn)
 *   user && !isVerified        → PendingVerificationScreen (full-screen gate — D-05, VERI-05)
 *   user && isVerified         → AppNavigator (main app)
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
        <PendingVerificationScreen />
      ) : (
        <AppNavigator />
      )}
    </NavigationContainer>
  );
}
