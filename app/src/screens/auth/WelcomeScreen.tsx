/**
 * WelcomeScreen (screen-states.md #1) — the app's first impression. A brief, restrained brand
 * entrance resolves into the wordmark + north-star tagline, then the sign-in options fade in. The
 * motion is the "brand entrance" beat from design/discussions/motion-signatures.md: staged, calm,
 * and reduced-motion-safe (collapses to a plain fade).
 *
 * Auth is OAuth/OIDC social sign-in. The provider flow is stubbed (lib/oauth.ts) until credentials +
 * a dev build exist, so tapping a button today shows a friendly "not available yet" — the UI, the
 * animation, and the sign-in orchestration are all real and tested.
 *
 * NOTE: the wordmark is typographic and intentionally a placeholder — a final brandmark/logo (and a
 * richer first-beat logo animation, e.g. Lottie/Rive) is a designer deliverable that slots in here.
 */
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { needsHandle, useAuthStore } from '../../state/authStore';
import { OAuthNotConfiguredError, type Provider } from '../../lib/oauth';
import { color, fontFamily, radius, space, type, minTapTarget } from '../../theme/tokens';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const signInWithProvider = useAuthStore((s) => s.signInWithProvider);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Staged entrance: wordmark → tagline → sign-in options. Reduced motion collapses to a soft fade.
  const enter = (delay: number) =>
    reduced ? FadeIn.duration(150) : FadeInDown.springify().damping(20).delay(delay);

  const onContinue = useCallback(
    async (provider: Provider) => {
      setMessage(null);
      setBusy(provider);
      try {
        await signInWithProvider(provider);
        const player = useAuthStore.getState().player;
        // New account → pick a handle first; returning users are handed to the app by the gate.
        if (player && needsHandle(player)) navigation.navigate('HandlePick');
      } catch (err) {
        setMessage(
          err instanceof OAuthNotConfiguredError
            ? 'Social sign-in is coming soon.'
            : 'Couldn’t sign in — please try again.',
        );
      } finally {
        setBusy(null);
      }
    },
    [signInWithProvider, navigation],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.hero}>
        <Animated.Text entering={enter(0)} style={styles.wordmark}>
          battleapp
        </Animated.Text>
        <Animated.Text entering={enter(reduced ? 0 : 260)} style={styles.tagline}>
          Build a story with a friend, one line at a time.
        </Animated.Text>
      </View>

      <Animated.View entering={enter(reduced ? 0 : 620)} style={styles.actions}>
        <ProviderButton
          testID="continue-apple"
          label="Continue with Apple"
          variant="apple"
          busy={busy === 'apple'}
          disabled={busy !== null}
          onPress={() => onContinue('apple')}
        />
        <ProviderButton
          testID="continue-google"
          label="Continue with Google"
          variant="google"
          busy={busy === 'google'}
          disabled={busy !== null}
          onPress={() => onContinue('google')}
        />
        {message && (
          <Text testID="welcome-message" style={styles.message}>
            {message}
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

function ProviderButton({
  testID,
  label,
  variant,
  busy,
  disabled,
  onPress,
}: {
  testID: string;
  label: string;
  variant: 'apple' | 'google';
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const isApple = variant === 'apple';
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      style={[styles.button, isApple ? styles.apple : styles.google, disabled && styles.buttonDim]}
    >
      {busy ? (
        <ActivityIndicator color={isApple ? '#FFFFFF' : color.ink700} />
      ) : (
        <Text style={[styles.buttonText, isApple ? styles.appleText : styles.googleText]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.appBg, paddingHorizontal: space[6] },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3] },
  wordmark: { ...type.display, fontSize: 40, lineHeight: 46, color: color.primary },
  tagline: {
    fontFamily: fontFamily.serif,
    fontSize: 18,
    lineHeight: 28,
    color: color.ink500,
    textAlign: 'center',
    maxWidth: 320,
  },
  actions: { gap: space[3], paddingBottom: space[6] },
  button: {
    minHeight: minTapTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[4],
  },
  buttonDim: { opacity: 0.6 },
  apple: { backgroundColor: '#000000' },
  google: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.line },
  buttonText: { ...type.label, fontSize: 15 },
  appleText: { color: '#FFFFFF' },
  googleText: { color: color.ink900 },
  message: { ...type.caption, color: color.ink500, textAlign: 'center' },
});
