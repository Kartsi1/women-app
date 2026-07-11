import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DocumentUploadScreen from '../screens/Auth/DocumentUploadScreen';
import PendingVerificationScreen from '../screens/Auth/PendingVerificationScreen';
import { useAuthStore } from '../store/authStore';

/**
 * Navigation param list for the verification flow.
 *
 * PendingVerification accepts optional photo URIs from DocumentUploadScreen
 * so thumbnails of the just-uploaded images can be shown without a server
 * round-trip (they are only available within the session — no persistence needed
 * for thumbnails at this stage).
 */
export type VerificationStackParamList = {
  DocumentUpload: undefined;
  PendingVerification: { idDocumentUri?: string; selfieUri?: string } | undefined;
};

const Stack = createNativeStackNavigator<VerificationStackParamList>();

/**
 * VerificationNavigator wraps DocumentUploadScreen and PendingVerificationScreen
 * so that navigation between them (initial upload → pending gate, and
 * pending gate → resubmit) works via React Navigation.
 *
 * Initial route is derived from verificationStatus in the auth store:
 *   'none'              → DocumentUploadScreen (first-time upload or after cold-start reset)
 *   'pending'|'rejected' → PendingVerificationScreen
 *
 * NOTE: verificationStatus is not persisted across cold-starts — on a fresh
 * launch it defaults to 'none'. Users with an existing pending submission will
 * therefore see DocumentUploadScreen first; they can submit again (D-06) or
 * the status will be correctly restored once Plan 04/05 adds an API fetch on
 * auth state change.
 *
 * Dev note: the plan specified adding DocumentUpload to AuthNavigator, but
 * AuthNavigator is only rendered for unauthenticated users — after sign-up the
 * auth state listener fires before the screen can navigate there. Using a
 * dedicated VerificationNavigator is the correct pattern for navigation between
 * DocumentUpload and PendingVerification while the user is authenticated but
 * unverified. (Rule 1 deviation — routing would be broken with AuthNavigator.)
 */
export function VerificationNavigator() {
  const { verificationStatus, verificationLoaded } = useAuthStore();

  // Wait for the first backend status fetch before mounting the stack. React
  // Navigation reads initialRouteName only once at mount, so mounting before the
  // real status is known would strand a pending user on DocumentUpload after a
  // reload (the async status update can't re-navigate an already-mounted stack).
  if (!verificationLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#6200ea" />
      </View>
    );
  }

  // Only a brand-new user with no submission (status 'none') should land on the
  // upload screen. pending / rejected / approved all belong on PendingVerification
  // (approved is transient — the refresh there force-refreshes the token and the
  // RootNavigator isVerified gate then swaps to the app).
  const initialRoute =
    verificationStatus === 'none' ? 'DocumentUpload' : 'PendingVerification';

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={initialRoute}
    >
      <Stack.Screen name="DocumentUpload" component={DocumentUploadScreen} />
      <Stack.Screen name="PendingVerification" component={PendingVerificationScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
