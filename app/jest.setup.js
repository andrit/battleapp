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
