/**
 * SplashScreen — the auth-hydration wait (screen-states.md #1: the sub-second wordmark shown while
 * `authStore.hydrate()` restores a session before routing to Welcome or the app). Kept minimal.
 */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { color, space, type } from '../theme/tokens';

export default function SplashScreen() {
  return (
    <View testID="splash" style={styles.screen}>
      <Text style={styles.wordmark}>battleapp</Text>
      <ActivityIndicator color={color.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.appBg, alignItems: 'center', justifyContent: 'center', gap: space[5] },
  wordmark: { ...type.display, fontSize: 34, color: color.primary },
});
