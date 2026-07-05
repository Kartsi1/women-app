import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SignUpScreen from '../screens/Auth/SignUpScreen';
import SignInScreen from '../screens/Auth/SignInScreen';

export type AuthStackParamList = {
  SignUp: undefined;
  SignIn: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
    </Stack.Navigator>
  );
}
