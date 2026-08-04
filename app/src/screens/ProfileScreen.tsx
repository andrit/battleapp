/**
 * ProfileScreen (screen-states.md #7). Minimal for now — the signed-in @handle + Sign out; avatar,
 * notifications nudge, AI-usage summary, blocked players and Settings are later phases. Sign out
 * clears the session (SecureStore refresh token revoked + wiped) and the auth gate routes to Welcome.
 */
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '../state/authStore';
import { color, radius, space, type, minTapTarget } from '../theme/tokens';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const displayName = useAuthStore((s) => s.player?.display_name ?? null);
  const signOut = useAuthStore((s) => s.signOut);
  const [busy, setBusy] = useState(false);

  const onSignOut = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Revokes + wipes the refresh token and flips status → anon; the gate (RootNavigator) then
      // routes back to Welcome on its own — no manual navigation needed.
      await signOut();
    } finally {
      setBusy(false);
    }
  }, [busy, signOut]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space[6] }]}>
      <Text style={styles.title}>Profile</Text>
      {displayName && <Text style={styles.handle}>@{displayName}</Text>}

      <View style={styles.spacer} />

      <Pressable
        testID="sign-out"
        onPress={onSignOut}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        accessibilityState={{ disabled: busy }}
        style={[
          styles.signOut,
          busy && styles.signOutDim,
          { marginBottom: Math.max(insets.bottom, space[4]) },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={color.error} />
        ) : (
          <Text style={styles.signOutText}>Sign out</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.appBg, paddingHorizontal: space[6] },
  title: { ...type.title, color: color.ink900 },
  handle: { ...type.body, color: color.ink500, marginTop: space[1] },
  spacer: { flex: 1 },
  signOut: {
    minHeight: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
  },
  signOutDim: { opacity: 0.6 },
  signOutText: { ...type.label, color: color.error },
});
