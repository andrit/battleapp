import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

import RootNavigator from './src/navigation/RootNavigator';
import { createQueryClient } from './src/lib/queryClient';
import { primeStoriesCache, subscribeStoriesWriteThrough } from './src/lib/storiesCache';
import { useAppFonts } from './src/theme/fonts';
import { api } from './src/lib/api';
import { useAuthStore } from './src/state/authStore';

const queryClient = createQueryClient();

// Keep the splash visible until the story font (Lora) is ready, so the reading
// surface never flashes in an unstyled serif fallback. Failures are non-fatal.
void SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, fontError] = useAppFonts();

  useEffect(() => {
    // Offline B2: seed the stories list from AsyncStorage, then keep the mirror current.
    void primeStoriesCache(queryClient);
    // Dev identity bootstrap until Phase 5 auth: learn who "me" is so whose-turn and author
    // attribution match the server's dev player. Best-effort — screens fall back to the 'me'
    // placeholder if it fails.
    void api
      .me()
      .then((player) => useAuthStore.setState({ player }))
      .catch(() => {});
    return subscribeStoriesWriteThrough(queryClient);
  }, []);

  // Hide the splash once fonts resolve (loaded or errored — we render either way).
  const onLayoutRootView = useCallback(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null; // splash stays up
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <QueryClientProvider client={queryClient}>
        <RootNavigator />
        <StatusBar style="auto" />
      </QueryClientProvider>
    </View>
  );
}
