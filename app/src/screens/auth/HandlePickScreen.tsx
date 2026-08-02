/**
 * HandlePickScreen — the first-run "pick your @handle" step. A new OIDC account gets a generated
 * `player_xxxxxxxx` handle; here the user chooses a real, unique one before entering the app.
 * The provider gave us name/email, but our display_name is unique — so this is a deliberate step.
 */
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError } from '../../lib/api';
import { useAuthStore } from '../../state/authStore';
import { color, radius, space, type, minTapTarget } from '../../theme/tokens';

const HANDLE_RE = /^[a-z0-9_]{3,20}$/i;

export default function HandlePickScreen() {
  const insets = useSafeAreaInsets();
  const completeHandlePick = useAuthStore((s) => s.completeHandlePick);
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = HANDLE_RE.test(handle.trim());

  const onSubmit = useCallback(async () => {
    const name = handle.trim();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const player = await api.setDisplayName(name);
      // Real handle now → the gate advances to the one-time First-story prompt, then the app.
      completeHandlePick(player);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? 'That handle’s taken — try another.'
          : 'Couldn’t save that — please try again.',
      );
    } finally {
      setBusy(false);
    }
  }, [handle, valid, busy, completeHandlePick]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space[8], paddingBottom: insets.bottom }]}>
      <Text style={styles.title}>Pick your handle</Text>
      <Text style={styles.sub}>This is how your co-author sees you.</Text>

      <View style={styles.field}>
        <Text style={styles.at}>@</Text>
        <TextInput
          testID="handle-input"
          style={styles.input}
          value={handle}
          onChangeText={setHandle}
          placeholder="yourname"
          placeholderTextColor={color.ink300}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          maxLength={20}
        />
      </View>
      <Text style={styles.hint}>3–20 letters, numbers, or underscores.</Text>
      {error && (
        <Text testID="handle-error" style={styles.error}>
          {error}
        </Text>
      )}

      <Pressable
        testID="handle-submit"
        onPress={onSubmit}
        disabled={!valid || busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: !valid || busy }}
        style={[styles.cta, (!valid || busy) && styles.ctaDim]}
      >
        {busy ? <ActivityIndicator color={color.primaryInk} /> : <Text style={styles.ctaText}>Continue</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.appBg, paddingHorizontal: space[6], gap: space[2] },
  title: { ...type.title, color: color.ink900 },
  sub: { ...type.body, color: color.ink500, marginBottom: space[4] },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    minHeight: minTapTarget,
  },
  at: { ...type.body, color: color.ink500 },
  input: { flex: 1, ...type.body, color: color.ink900, paddingVertical: space[3] },
  hint: { ...type.caption, color: color.ink500 },
  error: { ...type.caption, color: color.error },
  cta: {
    marginTop: space[4],
    minHeight: minTapTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.primary,
  },
  ctaDim: { backgroundColor: color.ink300 },
  ctaText: { ...type.label, color: color.primaryInk },
});
