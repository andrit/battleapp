import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

import RootNavigator from './src/navigation/RootNavigator';
import { OfflineBanner } from './src/components/OfflineBanner';
import { createQueryClient, createCachePersister, CACHE_MAX_AGE, CACHE_BUSTER } from './src/lib/queryClient';
import { registerMutationDefaults } from './src/lib/queries';
import { startNetworkMonitoring } from './src/lib/network';
import { useAppFonts } from './src/theme/fonts';
import { useAuthStore } from './src/state/authStore';

const queryClient = createQueryClient();
// Register offline-durable mutation defaults before the persister restores + resumes paused turns.
registerMutationDefaults(queryClient);
const persister = createCachePersister();

// Keep the splash visible until the story font (Lora) is ready, so the reading
// surface never flashes in an unstyled serif fallback. Failures are non-fatal.
void SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, fontError] = useAppFonts();

  useEffect(() => {
    // Bridge real connectivity → React Query (pause/resume) + the offline banner store.
    startNetworkMonitoring();
    // Restore any persisted session (refresh token → access + player). Drives the auth gate:
    // status starts 'loading', then resolves to 'authed' or 'anon'.
    void useAuthStore.getState().hydrate();
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
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister, maxAge: CACHE_MAX_AGE, buster: CACHE_BUSTER }}
          // After the cache restores, replay any writes that were queued while offline (Phase 6 task 4).
          onSuccess={() => {
            void queryClient.resumePausedMutations();
          }}
        >
          <OfflineBanner />
          <RootNavigator />
          <StatusBar style="auto" />
        </PersistQueryClientProvider>
      </View>
    </SafeAreaProvider>
  );
}
