import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import EditProfileScreen from '../screens/Profile/EditProfileScreen';
import ViewProfileScreen from '../screens/Profile/ViewProfileScreen';

/**
 * Param list for the authenticated (verified) app navigation stack.
 *
 * - Profile: own profile view (initial route)
 * - EditProfile: edit display name, bio, home city, photo
 * - ViewProfile: public profile for another verified user identified by uid
 */
export type AppStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  ViewProfile: { uid: string };
};

const Stack = createNativeStackNavigator<AppStackParamList>();

/**
 * AppNavigator renders the main app experience for verified users (PROF-01..04).
 *
 * Accessible only after RootNavigator confirms isVerified === true.
 * Replaces the Plan 02 placeholder Home screen.
 */
export function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Profile"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="ViewProfile" component={ViewProfileScreen} />
    </Stack.Navigator>
  );
}
