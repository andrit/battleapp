import { createNativeStackNavigator } from '@react-navigation/native-stack';

import WelcomeScreen from '../screens/auth/WelcomeScreen';
import HandlePickScreen from '../screens/auth/HandlePickScreen';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * The auth flow, shown outside the tab shell. Wired into RootNavigator by the status-driven gate in
 * Task 4 (unauthenticated / needs-handle → here; authed with a handle → the app).
 */
export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="HandlePick" component={HandlePickScreen} />
    </Stack.Navigator>
  );
}
