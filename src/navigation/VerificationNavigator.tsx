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
  const { verificationStatus } = useAuthStore();

  // Derive initial route from store state. The screen-order trick in React
  // Navigation means the first <Stack.Screen> rendered becomes the initial route.
  const initialRoute =
    verificationStatus === 'pending' || verificationStatus === 'rejected'
      ? 'PendingVerification'
      : 'DocumentUpload';

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
