/**
 * OfflineBanner (Phase 6) — the single, app-wide offline indicator, driven by real connectivity
 * (`network.ts`) rather than a per-screen fetch-error proxy. Rendered once at the top of the app
 * (App.tsx); takes no layout space while online.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsOnline } from '../lib/network';
import { color, space, type } from '../theme/tokens';

export function OfflineBanner() {
  const online = useIsOnline();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <View testID="offline-banner" style={[styles.banner, { paddingTop: insets.top + space[1] }]}>
      <Text style={styles.text}>You&rsquo;re offline — showing your saved content.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FBEFD9',
    paddingHorizontal: space[4],
    paddingBottom: space[2],
    alignItems: 'center',
  },
  text: { ...type.caption, color: color.ink700 },
});
