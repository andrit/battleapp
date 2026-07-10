import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';

import RootNavigator from './src/navigation/RootNavigator';
import { createQueryClient } from './src/lib/queryClient';
import { primeStoriesCache, subscribeStoriesWriteThrough } from './src/lib/storiesCache';

const queryClient = createQueryClient();

export default function App() {
  useEffect(() => {
    // Offline B2: seed the stories list from AsyncStorage, then keep the mirror current.
    void primeStoriesCache(queryClient);
    return subscribeStoriesWriteThrough(queryClient);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RootNavigator />
      <StatusBar style="auto" />
    </QueryClientProvider>
  );
}
