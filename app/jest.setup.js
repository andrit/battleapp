// Reanimated v4 testing setup (official guide). react-native-worklets is a native
// library, so its module is replaced with the package's own JS mock; then Reanimated's
// setUpTests() installs the JS animation test harness. Without the worklets mock,
// importing react-native-reanimated crashes at load (no native TurboModule under jest).
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
require('react-native-reanimated').setUpTests();
