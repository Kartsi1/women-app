import { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import EditProfileScreen from '../screens/Profile/EditProfileScreen';
import ViewProfileScreen from '../screens/Profile/ViewProfileScreen';
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
 * Param list for the Housing nested native-stack.
 * MapDiscovery is the initial screen (replaces HousingPlaceholderScreen from 02-01).
 * CreateListing is pushed from a FAB on MapDiscovery.
 * ListingDetail is pushed when a map pin is tapped.
 * StayRequestCompose — guest composes a stay request (02-03 REQT-01).
 * RequestStatus — read-only request status; address revealed when accepted (02-03 REQT-03).
 * HostInbox — host sees incoming stay requests (02-03 REQT-02).
 */
export type HousingStackParamList = {
  MapDiscovery: undefined;
  CreateListing: undefined;
  ListingDetail: { listingId: string };
  StayRequestCompose: { listingId: string };
  RequestStatus: { requestId: string; listingId?: string };
  HostInbox: undefined;
};

/**
 * Param list for the Messages native-stack (plan 02-04 + 02-05).
 *
 *   ConversationList        — root; lists accepted conversations + city chat entry (02-05)
 *   DirectMessage           — real-time 1:1 chat screen (02-04)
 *   MessageRequestCompose   — send a message request from a profile (02-04)
 *   MessageRequestInbox     — recipient's inbox of pending requests (02-04)
 *   CityGroupChat           — real-time city group chat screen (02-05, MSG-04)
 */
export type MessagesStackParamList = {
  ConversationList: undefined;
  DirectMessage: { conversationId: string; otherUid: string };
  MessageRequestCompose: { recipientUid: string };
  MessageRequestInbox: undefined;
  CityGroupChat: undefined;
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
// Housing Stack — MapDiscovery → CreateListing / ListingDetail
// ---------------------------------------------------------------------------

const HousingStack = createNativeStackNavigator<HousingStackParamList>();

import MapDiscoveryScreen from '../screens/Housing/MapDiscoveryScreen';
import CreateListingScreen from '../screens/Housing/CreateListingScreen';
import ListingDetailScreen from '../screens/Housing/ListingDetailScreen';
import StayRequestComposeScreen from '../screens/Requests/StayRequestComposeScreen';
import RequestStatusScreen from '../screens/Requests/RequestStatusScreen';
import HostInboxScreen from '../screens/Requests/HostInboxScreen';

function HousingStackNavigator() {
  return (
    <HousingStack.Navigator screenOptions={{ headerShown: false }}>
      <HousingStack.Screen name="MapDiscovery" component={MapDiscoveryScreen} />
      <HousingStack.Screen name="CreateListing" component={CreateListingScreen} />
      <HousingStack.Screen name="ListingDetail" component={ListingDetailScreen} />
      <HousingStack.Screen name="StayRequestCompose" component={StayRequestComposeScreen} />
      <HousingStack.Screen name="RequestStatus" component={RequestStatusScreen} />
      <HousingStack.Screen name="HostInbox" component={HostInboxScreen} />
    </HousingStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Messages Stack — ConversationList → DirectMessage / MessageRequestCompose / MessageRequestInbox
// ---------------------------------------------------------------------------

const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();

import ConversationListScreen from '../screens/Messages/ConversationListScreen';
import DirectMessageScreen from '../screens/Messages/DirectMessageScreen';
import MessageRequestComposeScreen from '../screens/Messages/MessageRequestComposeScreen';
import MessageRequestInboxScreen from '../screens/Messages/MessageRequestInboxScreen';
import CityGroupChatScreen from '../screens/Messages/CityGroupChatScreen';

function MessagesStackNavigator() {
  return (
    <MessagesStack.Navigator screenOptions={{ headerShown: false }}>
      <MessagesStack.Screen name="ConversationList" component={ConversationListScreen} />
      <MessagesStack.Screen name="DirectMessage" component={DirectMessageScreen} />
      <MessagesStack.Screen name="MessageRequestCompose" component={MessageRequestComposeScreen} />
      <MessagesStack.Screen name="MessageRequestInbox" component={MessageRequestInboxScreen} />
      <MessagesStack.Screen name="CityGroupChat" component={CityGroupChatScreen} />
    </MessagesStack.Navigator>
  );
}

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
 *  - Housing      → HousingStackNavigator (MapDiscovery + CreateListing + ListingDetail)
 *  - Messages     → MessagesStackNavigator (ConversationList + DirectMessage + Compose + Inbox)
 *  - Profile      → ProfileStackNavigator (Profile + EditProfile + ViewProfile)
 *
 * Active-tab indicator colour: #6200ea (accent per UI-SPEC).
 *
 * Socket.io connection is initiated here — once the verified user lands in the
 * app shell, connectSocket() acquires the Firebase token and opens the
 * authenticated WebSocket handshake. Disconnect happens on sign-out via
 * authStore.clear() + disconnectSocket() (wired in RootNavigator / sign-out flow).
 *
 * Plan 02-04: Messages tab now renders MessagesStackNavigator (ConversationListScreen
 * as root) instead of MessagesPlaceholderScreen.
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
        component={HousingStackNavigator}
        options={{
          tabBarLabel: 'Housing',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesStackNavigator}
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
