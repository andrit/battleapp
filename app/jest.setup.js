// Reanimated v4 testing setup (official guide). react-native-worklets is a native
// library, so its module is replaced with the package's own JS mock; then Reanimated's
// setUpTests() installs the JS animation test harness. Without the worklets mock,
// importing react-native-reanimated crashes at load (no native TurboModule under jest).
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
require('react-native-reanimated').setUpTests();

// Safe-area insets resolve to zeros under jest so screens can be rendered directly (without a
// SafeAreaProvider / navigation wrapper) in component tests.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

// usePreferencesStore persists via AsyncStorage; the official mock makes the persist middleware
// (and any component that reads it) work in every test without per-file wiring.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// @react-native-community/netinfo wraps native connectivity (unavailable in jest). Mock it so
// startNetworkMonitoring() wires up without a native module; tests drive the offline state via
// useNetworkStore directly.
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()), // returns an unsubscribe fn
    fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
  },
}));

// expo-secure-store wraps native Keychain/Keystore (unavailable in jest). An in-memory mock lets the
// auth store hydrate/persist in any test. (authStore.test overrides this with its own for assertions.)
jest.mock('expo-secure-store', () => {
  const mem = {};
  return {
    getItemAsync: jest.fn((k) => Promise.resolve(k in mem ? mem[k] : null)),
    setItemAsync: jest.fn((k, v) => {
      mem[k] = v;
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((k) => {
      delete mem[k];
      return Promise.resolve();
    }),
  };
});
