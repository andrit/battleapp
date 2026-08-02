import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import StoriesScreen from '../screens/StoriesScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import ProfileScreen from '../screens/ProfileScreen';
import StoryScreen from '../screens/StoryScreen';
import ComposeScreen from '../screens/ComposeScreen';
import SplashScreen from '../screens/SplashScreen';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import HandlePickScreen from '../screens/auth/HandlePickScreen';
import FirstStoryScreen from '../screens/auth/FirstStoryScreen';
import { needsHandle, useAuthStore } from '../state/authStore';
import type { RootStackParamList, TabsParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabsParamList>();

function TabsNavigator() {
  return (
    <Tabs.Navigator>
      <Tabs.Screen name="Stories" component={StoriesScreen} />
      <Tabs.Screen name="Discover" component={DiscoverScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

/**
 * The auth gate. `authStore.status` (+ whether the player still needs a handle) decides which set of
 * screens exists — React Navigation resets automatically as that state changes:
 *   loading → Splash · not authed → Welcome · authed & needs handle → HandlePick ·
 *   just onboarded → First-story prompt (one-time) · else → the app.
 */
export default function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const player = useAuthStore((s) => s.player);
  const justOnboarded = useAuthStore((s) => s.justOnboarded);

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {status === 'loading' ? (
          <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
        ) : status !== 'authed' ? (
          <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
        ) : player && needsHandle(player) ? (
          <Stack.Screen
            name="HandlePick"
            component={HandlePickScreen}
            options={{ headerShown: false }}
          />
        ) : justOnboarded ? (
          <Stack.Screen
            name="FirstStory"
            component={FirstStoryScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <Stack.Group>
            <Stack.Screen name="Tabs" component={TabsNavigator} options={{ headerShown: false }} />
            <Stack.Screen name="Story" component={StoryScreen} options={{ title: 'Story' }} />
            <Stack.Screen
              name="Compose"
              component={ComposeScreen}
              options={{ presentation: 'modal', title: 'Your turn' }}
            />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
