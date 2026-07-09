import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Shared navigation ref — allows imperative navigation from outside React
 * component trees (e.g. push notification response handlers in useFirebaseAuth).
 *
 * Usage:
 *   import { navigationRef } from '../navigation/navigationRef';
 *   navigationRef.current?.navigate('Housing', {
 *     screen: 'HostInbox',
 *   });
 *
 * Attach to <NavigationContainer ref={navigationRef}> in RootNavigator.
 */
export const navigationRef = createNavigationContainerRef();
