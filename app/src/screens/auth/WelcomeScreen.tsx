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

import { useAuthStore } from '../../state/authStore';
import { OAuthNotConfiguredError, type Provider } from '../../lib/oauth';
import { color, fontFamily, radius, space, type, minTapTarget } from '../../theme/tokens';

// Brand-entrance timing — the staged reveal (wordmark → tagline → sign-in options). Delays are ms
// after the screen mounts. To swap elements (e.g. a real logo) or retune, edit these and see
// docs/engineering/welcome-animation.md.
const ENTRANCE = { wordmark: 0, tagline: 260, actions: 620 } as const;
const REDUCED_FADE_MS = 150; // reduced-motion fallback: a plain fade, no movement/stagger

// Routing is handled by the auth gate (RootNavigator) reacting to authStore state — this screen just
// kicks off sign-in.
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const signInWithProvider = useAuthStore((s) => s.signInWithProvider);
  const signInAsDev = useAuthStore((s) => s.signInAsDev);
  const [busy, setBusy] = useState<Provider | 'dev' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Staged entrance: wordmark → tagline → sign-in options. Reduced motion collapses to a soft fade.
  const enter = (delay: number) =>
    reduced ? FadeIn.duration(REDUCED_FADE_MS) : FadeInDown.springify().damping(20).delay(delay);

  const onContinue = useCallback(
    async (provider: Provider) => {
      setMessage(null);
      setBusy(provider);
      try {
        await signInWithProvider(provider); // gate routes on the resulting authStore change
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
    [signInWithProvider],
  );

  const onDev = useCallback(async () => {
    setMessage(null);
    setBusy('dev');
    try {
      await signInAsDev();
    } catch {
      setMessage('Couldn’t reach the dev server.');
    } finally {
      setBusy(null);
    }
  }, [signInAsDev]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.hero}>
        <Animated.Text entering={enter(ENTRANCE.wordmark)} style={styles.wordmark}>
          battleapp
        </Animated.Text>
        <Animated.Text entering={enter(reduced ? 0 : ENTRANCE.tagline)} style={styles.tagline}>
          Build a story with a friend, one line at a time.
        </Animated.Text>
      </View>

      <Animated.View entering={enter(reduced ? 0 : ENTRANCE.actions)} style={styles.actions}>
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
        {__DEV__ && (
          <Pressable
            testID="continue-dev"
            onPress={onDev}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityLabel="Continue as dev"
            style={styles.devButton}
          >
            <Text style={styles.devText}>Continue as dev</Text>
          </Pressable>
        )}
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
  devButton: { minHeight: minTapTarget, alignItems: 'center', justifyContent: 'center' },
  devText: { ...type.caption, color: color.ink300 },
});
