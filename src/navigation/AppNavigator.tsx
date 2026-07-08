import { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import EditProfileScreen from '../screens/Profile/EditProfileScreen';
import ViewProfileScreen from '../screens/Profile/ViewProfileScreen';
import HousingPlaceholderScreen from '../screens/Housing/HousingPlaceholderScreen';
import MessagesPlaceholderScreen from '../screens/Messages/MessagesPlaceholderScreen';
import { connectSocket } from '../services/socketService';
import { useAuthStore } from '../store/authStore';

// ---------------------------------------------------------------------------
// Type declarations
// ---------------------------------------------------------------------------

/**
 * Param list for the Profile nested native-stack.
 * Preserves the existing EditProfile / ViewProfile routes so those screens
 * remain reachable from ProfileScreen.
 */
export type AppStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  ViewProfile: { uid: string };
};

/**
 * Param list for the root bottom-tab navigator.
 */
export type TabParamList = {
  Housing: undefined;
  Messages: undefined;
  ProfileTab: undefined;
};

// ---------------------------------------------------------------------------
// Nested Profile Stack — preserves EditProfile + ViewProfile routes
// ---------------------------------------------------------------------------

const ProfileStack = createNativeStackNavigator<AppStackParamList>();

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileStack.Screen name="ViewProfile" component={ViewProfileScreen} />
    </ProfileStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Bottom Tab Navigator
// ---------------------------------------------------------------------------

const Tab = createBottomTabNavigator<TabParamList>();

/**
 * AppNavigator renders the bottom-tab shell for verified users.
 *
 * Tabs:
 *  - Housing      → HousingPlaceholderScreen (replaced in plan 02-02)
 *  - Messages     → MessagesPlaceholderScreen (replaced in plan 02-04)
 *  - Profile      → ProfileStackNavigator (Profile + EditProfile + ViewProfile)
 *
 * Active-tab indicator colour: #6200ea (accent per UI-SPEC).
 *
 * Socket.io connection is initiated here — once the verified user lands in the
 * app shell, connectSocket() acquires the Firebase token and opens the
 * authenticated WebSocket handshake. Disconnect happens on sign-out via
 * authStore.clear() + disconnectSocket() (wired in RootNavigator / sign-out flow).
 */
export function AppNavigator() {
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      // Establish the authenticated Socket.io connection (T-02-01-01)
      connectSocket().catch((err) =>
        console.warn('[Socket] connectSocket failed:', err)
      );
    }
  }, [user]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6200ea',
        tabBarInactiveTintColor: '#888',
      }}
    >
      <Tab.Screen
        name="Housing"
        component={HousingPlaceholderScreen}
        options={{
          tabBarLabel: 'Housing',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesPlaceholderScreen}
        options={{
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>💬</Text>
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>👤</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
