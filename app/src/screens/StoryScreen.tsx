/**
 * StoryScreen — the Story View (screen-states.md #10, the hero). A serif scroll of Sections on
 * the reader's chosen paper, with a persistent bottom bar that carries the turn state. Reading
 * is the hero; the AI is the quieter voice (see StorySection). Compose (the input) is a separate
 * modal route reached from the "Your turn" bar.
 *
 * States: loading skeleton (no cache) · hard error + Retry (no cache) · offline banner (stale
 * cache shown) · lobby-empty (opener CTA vs waiting) · active (turns + your-turn / waiting bar) ·
 * complete / abandoned footer. Live turns arrive via useStoryWebSocket; optimistic reconcile
 * lives in useSubmitTurn.
 */
import { useLayoutEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useStory } from '../lib/queries';
import { useStoryWebSocket } from '../lib/storyWebSocket';
import { useAuthStore } from '../state/authStore';
import { usePreferencesStore } from '../state/preferencesStore';
import { StorySection } from '../components/StorySection';
import { ReadingControlsSheet } from '../components/ReadingControlsSheet';
import { paperColor } from '../theme/reading';
import { color, radius, space, type, minTapTarget } from '../theme/tokens';
import type { Story, Turn } from '../domain/types';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Story'>;

// Until Phase 5 wires real identity, "you" is authStore.player.id, falling back to the same
// 'me' placeholder the optimistic-turn path (lib/queries.ts) already uses.
const FALLBACK_ME = 'me';

export default function StoryScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const story = useStory(id);
  useStoryWebSocket(id); // live TurnAdded → patches the story cache
  const meId = useAuthStore((s) => s.player?.id) ?? FALLBACK_ME;
  const paper = usePreferencesStore((s) => s.reading.paper);
  const [readingOpen, setReadingOpen] = useState(false);

  // The "Aa" header button opens the reading-controls sheet (client-state-ux.md §B).
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          testID="reading-controls-button"
          onPress={() => setReadingOpen(true)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Reading controls"
        >
          <Text style={styles.aaButton}>Aa</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  const data = story.data;

  // Loading with no cache to show → skeleton scroll (never a bare spinner).
  if (!data) {
    if (story.isLoading) return <StorySkeleton />;
    // Hard error, no cache.
    return <StoryError onRetry={() => void story.refetch()} />;
  }

  // We have data (fresh or stale cache). A failed refetch over existing cache → offline banner.
  const offline = story.isError;
  const openToCompose = () => navigation.navigate('Compose', { id });

  return (
    <View style={styles.screen}>
      {offline && (
        <View testID="offline-banner" style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Offline — showing your saved story.</Text>
        </View>
      )}
      <StoryBody data={data} meId={meId} paper={paper} onOpenCompose={openToCompose} />
      <BottomBar data={data} meId={meId} onOpenCompose={openToCompose} />
      <ReadingControlsSheet visible={readingOpen} onClose={() => setReadingOpen(false)} />
    </View>
  );
}

// --- Body: lobby-empty vs the turns scroll -------------------------------------

function StoryBody({
  data,
  meId,
  paper,
  onOpenCompose,
}: {
  data: Story & { turns: Turn[] };
  meId: string;
  paper: ReturnType<typeof usePreferencesStore.getState>['reading']['paper'];
  onOpenCompose: () => void;
}) {
  const paperBg = { backgroundColor: paperColor(paper) };

  if (data.state === 'lobby' && data.turns.length === 0) {
    // Opener writes the opening line; the creator opens (created_by). Otherwise: waiting.
    // The story is built together — in the lobby either author can write the opening line,
    // so any participant sees the CTA. Only a non-author (spectator/guest) sees the waiting copy.
    const iAmAuthor = data.participants.some((p) => p.player_id === meId);
    return (
      <View testID="lobby-empty" style={[styles.emptyWrap, paperBg]}>
        <View style={styles.emptyIcon} />
        {iAmAuthor ? (
          <>
            <Text style={styles.emptyHeadline}>Your story&rsquo;s ready</Text>
            <Text style={styles.emptySub}>Write the opening line.</Text>
            <Pressable
              testID="write-opening"
              onPress={onOpenCompose}
              accessibilityRole="button"
              style={styles.emptyCta}
            >
              <Text style={styles.emptyCtaText}>Write the opening line</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.emptyHeadline}>Waiting for {partnerLabel(data, meId)}</Text>
            <Text style={styles.emptySub}>to write the opening line.</Text>
          </>
        )}
      </View>
    );
  }

  return (
    <FlashList
      testID="story-scroll"
      data={data.turns}
      keyExtractor={(t) => t.id}
      contentContainerStyle={styles.scrollContent}
      style={paperBg}
      renderItem={({ item }) => (
        <StorySection
          turn={item}
          authorName={authorLabel(item.author_id, meId)}
          authorSlot={authorSlot(data, item.author_id)}
          // Entrance is applied to live/optimistic appends in Task 5, not on the whole list —
          // animating recycled rows would flicker on scroll.
          animateEntrance={false}
        />
      )}
    />
  );
}

// --- Bottom bar: the turn state -------------------------------------------------

function BottomBar({
  data,
  meId,
  onOpenCompose,
}: {
  data: Story & { turns: Turn[] };
  meId: string;
  onOpenCompose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const pad = { paddingBottom: Math.max(insets.bottom, space[3]) };

  if (data.state === 'complete') {
    return (
      <View testID="story-complete" style={[styles.footerBar, pad]}>
        <Text style={styles.footerText}>This story is complete.</Text>
      </View>
    );
  }
  if (data.state === 'abandoned') {
    return (
      <View testID="story-abandoned" style={[styles.footerBar, pad]}>
        <Text style={styles.footerText}>This story was abandoned.</Text>
      </View>
    );
  }
  if (data.state === 'lobby') {
    return null; // lobby CTA lives in the empty state
  }

  // active
  const isMyTurn = data.current_author_id === meId;
  if (isMyTurn) {
    return (
      <Pressable
        testID="your-turn-bar"
        onPress={onOpenCompose}
        accessibilityRole="button"
        accessibilityLabel="Your turn — write"
        style={[styles.primaryBar, pad]}
      >
        <Text style={styles.primaryBarText}>Your turn — write &rsaquo;</Text>
      </Pressable>
    );
  }
  return (
    <View testID="waiting-bar" style={[styles.waitingBar, pad]}>
      <Text style={styles.waitingText}>Waiting for {partnerLabel(data, meId)}…</Text>
    </View>
  );
}

// --- Loading & error -----------------------------------------------------------

function StorySkeleton() {
  return (
    <View testID="story-skeleton" style={styles.screen}>
      <View style={[styles.scrollContent, { gap: space[4] }]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.skelBlock}>
            <View style={styles.skelChip} />
            <View style={styles.skelLine} />
            <View style={[styles.skelLine, { width: '70%' }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

function StoryError({ onRetry }: { onRetry: () => void }) {
  return (
    <View testID="story-error" style={[styles.screen, styles.centered]}>
      <View style={styles.emptyIcon} />
      <Text style={styles.emptyHeadline}>Couldn&rsquo;t load this story.</Text>
      <Pressable testID="story-retry" onPress={onRetry} accessibilityRole="button" style={styles.emptyCta}>
        <Text style={styles.emptyCtaText}>Retry</Text>
      </Pressable>
    </View>
  );
}

// --- Author resolution (no display names in the payload yet — Phase 5 enrichment) ---

/** Slot A = first participant (teal); B = the other (terracotta). Stable across the story. */
function authorSlot(data: Story, authorId: string): 'a' | 'b' {
  return data.participants[1]?.player_id === authorId ? 'b' : 'a';
}

/** Chip label: "You" for me, "Partner" otherwise (V1 is two authors, so a single partner). */
function authorLabel(authorId: string, meId: string): string {
  return authorId === meId ? 'You' : 'Partner';
}

/** Prose label for the other participant used in waiting/lobby copy. */
function partnerLabel(data: Story, meId: string): string {
  const partner = data.participants.find((p) => p.player_id !== meId);
  return partner ? authorLabel(partner.player_id, meId) : 'your partner';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.appBg },
  centered: { alignItems: 'center', justifyContent: 'center', gap: space[3], padding: space[6] },
  scrollContent: { padding: space[4] },

  offlineBanner: {
    backgroundColor: '#FBEFD9',
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  offlineText: { ...type.caption, color: color.ink700 },
  aaButton: { ...type.heading, color: color.primary, paddingHorizontal: space[2] },

  // Empty (lobby) + error
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[2], padding: space[6] },
  emptyIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: color.primaryTint },
  emptyHeadline: { ...type.title, color: color.ink900, fontFamily: 'Lora_500Medium', textAlign: 'center' },
  emptySub: { ...type.body, color: color.ink500, textAlign: 'center' },
  emptyCta: {
    marginTop: space[3],
    minHeight: minTapTarget,
    justifyContent: 'center',
    paddingHorizontal: space[5],
    borderRadius: radius.md,
    backgroundColor: color.primary,
  },
  emptyCtaText: { ...type.label, color: color.primaryInk },

  // Bottom bars
  primaryBar: {
    minHeight: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[4],
    paddingTop: space[3],
    backgroundColor: color.primary,
  },
  primaryBarText: { ...type.label, color: color.primaryInk },
  waitingBar: {
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingTop: space[3],
    backgroundColor: color.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.line,
  },
  waitingText: { ...type.caption, color: color.ink500 },
  footerBar: {
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingTop: space[3],
    backgroundColor: color.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.line,
  },
  footerText: { ...type.caption, color: color.ink500 },

  // Skeleton
  skelBlock: { gap: space[2] },
  skelChip: { width: 64, height: 12, borderRadius: radius.sm, backgroundColor: color.line },
  skelLine: { height: 16, borderRadius: radius.sm, backgroundColor: color.line },
});
