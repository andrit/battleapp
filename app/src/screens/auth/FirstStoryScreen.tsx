/**
 * FirstStoryScreen — the one-time welcome after a brand-new account picks its handle
 * (screen-states.md #4). Static: no loading/empty/error. Two ways forward —
 *   • Start a story (primary) → dismiss into the app with the "start" intent; Stories launches the
 *     create flow (single creation path, reused from the list's own CTA).
 *   • Browse (secondary) → dismiss into the app to look around.
 * The gate (RootNavigator) shows this only while `justOnboarded` is true, so it appears exactly once.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '../../state/authStore';
import { color, radius, space, type, minTapTarget } from '../../theme/tokens';

export default function FirstStoryScreen() {
  const insets = useSafeAreaInsets();
  const dismissFirstStory = useAuthStore((s) => s.dismissFirstStory);

  return (
    <View
      style={[styles.screen, { paddingTop: insets.top + space[8], paddingBottom: insets.bottom + space[6] }]}
    >
      <View style={styles.hero}>
        <Text style={styles.title}>You&rsquo;re in!</Text>
        <Text style={styles.sub}>Start a story, or look around first.</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          testID="first-story-start"
          onPress={() => dismissFirstStory(true)}
          accessibilityRole="button"
          style={styles.cta}
        >
          <Text style={styles.ctaText}>Start a story</Text>
        </Pressable>
        <Pressable
          testID="first-story-browse"
          onPress={() => dismissFirstStory(false)}
          accessibilityRole="button"
          style={styles.secondaryCta}
        >
          <Text style={styles.secondaryCtaText}>Browse</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.appBg,
    paddingHorizontal: space[6],
    justifyContent: 'space-between',
  },
  hero: { flex: 1, justifyContent: 'center', gap: space[2] },
  title: { ...type.display, color: color.ink900 },
  sub: { ...type.body, color: color.ink500 },
  actions: { gap: space[3] },
  cta: {
    minHeight: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: color.primary,
  },
  ctaText: { ...type.label, color: color.primaryInk },
  secondaryCta: {
    minHeight: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
  },
  secondaryCtaText: { ...type.label, color: color.ink700 },
});
