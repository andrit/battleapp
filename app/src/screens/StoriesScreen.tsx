/**
 * StoriesScreen — the hero list (screen-states.md #5). Cards grouped your-turn-first, each with a
 * status pill and (for your-turn) an 8px primary dot; a Start Story FAB in the thumb zone; and all
 * states: skeleton (no cache) · first-run empty · offline banner over stale cache · hard error +
 * Retry. Filter chips + sort are Task 7 (over the RQ cache), so this builds the list and states.
 *
 * Two data gaps carried from Task 4 shape the cards: the list payload has no author display names
 * ("Partner" until server enrichment) and no per-story turn count (we show whose-turn + limit).
 */
import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useCreateStory, useStories } from '../lib/queries';
import { analytics } from '../lib/analytics';
import { useAuthStore } from '../state/authStore';
import {
  usePreferencesStore,
  type ListFilter,
  type ListSort,
} from '../state/preferencesStore';
import {
  color,
  fabSize,
  radius,
  space,
  statusPill,
  type,
  minTapTarget,
} from '../theme/tokens';
import type { Story } from '../domain/types';
import type { RootStackParamList } from '../navigation/types';

const FALLBACK_ME = 'me'; // until Phase 5 wires identity (same placeholder as StoryScreen)

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** A single ordered "bucket" a story falls into — drives your-turn-first grouping. */
type Bucket = 'yourTurn' | 'waiting' | 'lobby' | 'complete' | 'abandoned';
const BUCKET_ORDER: Bucket[] = ['yourTurn', 'waiting', 'lobby', 'complete', 'abandoned'];

function bucketFor(story: Story, meId: string): Bucket {
  switch (story.state) {
    case 'active':
      return story.current_author_id === meId ? 'yourTurn' : 'waiting';
    case 'lobby':
      return 'lobby';
    case 'complete':
      return 'complete';
    case 'abandoned':
      return 'abandoned';
  }
}

const PILL: Record<Bucket, { label: string; style: { bg: string; text: string } }> = {
  yourTurn: { label: 'your turn', style: statusPill.yourTurn },
  waiting: { label: 'waiting', style: statusPill.waiting },
  lobby: { label: 'lobby', style: statusPill.lobby },
  complete: { label: 'complete', style: statusPill.complete },
  abandoned: { label: 'abandoned', style: statusPill.abandoned },
};

/**
 * Your-turn-first ordering, then the reader's within-bucket sort (client-state-ux.md §A). Grouping
 * is intentionally kept even under sort — the your-turn-first structure is the product's core.
 */
function groupStories(stories: Story[], meId: string, sort: ListSort): Story[] {
  const activityAt = (s: Story) => Date.parse(s.activated_at ?? s.created_at) || 0;
  const within = (a: Story, b: Story) => {
    switch (sort) {
      case 'longest-waiting':
        return activityAt(a) - activityAt(b); // oldest activity first
      case 'az':
        return (a.title ?? 'Untitled').localeCompare(b.title ?? 'Untitled');
      case 'recent':
      default:
        return activityAt(b) - activityAt(a);
    }
  };
  return [...stories].sort((a, b) => {
    const rank = BUCKET_ORDER.indexOf(bucketFor(a, meId)) - BUCKET_ORDER.indexOf(bucketFor(b, meId));
    return rank !== 0 ? rank : within(a, b);
  });
}

function matchesFilter(s: Story, filter: ListFilter, meId: string): boolean {
  switch (filter) {
    case 'your-turn':
      return bucketFor(s, meId) === 'yourTurn';
    case 'active':
      return s.state === 'active';
    case 'completed':
      return s.state === 'complete';
    case 'all':
    default:
      return true;
  }
}

const FILTERS: { key: ListFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'your-turn', label: 'Your turn' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];
const SORTS: { key: ListSort; label: string }[] = [
  { key: 'recent', label: 'Recently active' },
  { key: 'longest-waiting', label: 'Longest waiting' },
  { key: 'az', label: 'A–Z' },
];

export default function StoriesScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const stories = useStories();
  const create = useCreateStory();
  const meId = useAuthStore((s) => s.player?.id) ?? FALLBACK_ME;
  const { filter, sort } = usePreferencesStore((s) => s.list);
  const setFilter = usePreferencesStore((s) => s.setFilter);
  const setSort = usePreferencesStore((s) => s.setSort);
  const [sortOpen, setSortOpen] = useState(false);

  const onStart = useCallback(() => {
    create.mutate(undefined, {
      onSuccess: (story) => {
        analytics.storyStarted(story.id);
        navigation.navigate('Story', { id: story.id });
      },
    });
  }, [create, navigation]);

  const raw = stories.data?.stories;

  // Loading with no cache → skeleton (never a bare spinner for a list screen).
  if (!raw) {
    if (stories.isLoading) return <StoriesSkeleton />;
    return <StoriesError onRetry={() => void stories.refetch()} />;
  }

  const offline = stories.isError; // stale cache shown after a failed refetch
  const firstRun = raw.length === 0;
  const visible = groupStories(
    raw.filter((s) => matchesFilter(s, filter, meId)),
    meId,
    sort,
  );
  const fabBottom = Math.max(insets.bottom, space[4]) + space[2];

  return (
    <View style={styles.screen}>
      {offline && (
        <View testID="offline-banner" style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Offline — showing your saved stories.</Text>
        </View>
      )}

      {firstRun ? (
        <FirstRunEmpty onStart={onStart} pending={create.isPending} />
      ) : (
        <>
          <ControlRow
            filter={filter}
            onFilter={setFilter}
            sort={sort}
            onOpenSort={() => setSortOpen(true)}
          />
          {visible.length === 0 ? (
            <FilteredEmpty filter={filter} onShowAll={() => setFilter('all')} />
          ) : (
            <FlashList
              testID="stories-list"
              data={visible}
              keyExtractor={(s) => s.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <StoryCard
                  story={item}
                  meId={meId}
                  onPress={() => navigation.navigate('Story', { id: item.id })}
                />
              )}
            />
          )}
        </>
      )}

      <Pressable
        testID="start-story-fab"
        onPress={onStart}
        disabled={create.isPending}
        accessibilityRole="button"
        accessibilityLabel="Start a story"
        style={[styles.fab, { bottom: fabBottom }]}
      >
        <Text style={styles.fabPlus}>+</Text>
      </Pressable>

      <SortSheet
        visible={sortOpen}
        sort={sort}
        onPick={(s) => {
          setSort(s);
          setSortOpen(false);
        }}
        onClose={() => setSortOpen(false)}
      />
    </View>
  );
}

// --- Controls: filter chips + sort ----------------------------------------------

function ControlRow({
  filter,
  onFilter,
  sort,
  onOpenSort,
}: {
  filter: ListFilter;
  onFilter: (f: ListFilter) => void;
  sort: ListSort;
  onOpenSort: () => void;
}) {
  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? '';
  return (
    <View style={styles.controlRow}>
      <View style={styles.chips}>
        {FILTERS.map((f) => {
          const on = f.key === filter;
          return (
            <Pressable
              key={f.key}
              testID={`filter-${f.key}`}
              onPress={() => onFilter(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        testID="sort-button"
        onPress={onOpenSort}
        accessibilityRole="button"
        accessibilityLabel={`Sort: ${sortLabel}`}
        style={styles.sortButton}
      >
        <Text style={styles.sortText}>⇅</Text>
      </Pressable>
    </View>
  );
}

function SortSheet({
  visible,
  sort,
  onPick,
  onClose,
}: {
  visible: boolean;
  sort: ListSort;
  onPick: (s: ListSort) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable testID="sort-scrim" style={styles.scrim} onPress={onClose} />
      <View style={[styles.sortSheet, { paddingBottom: Math.max(insets.bottom, space[4]) }]}>
        <Text style={styles.sheetHeading}>Sort</Text>
        {SORTS.map((s) => (
          <Pressable
            key={s.key}
            testID={`sort-${s.key}`}
            onPress={() => onPick(s.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: s.key === sort }}
            style={styles.sortOption}
          >
            <Text style={[styles.sortOptionText, s.key === sort && styles.sortOptionOn]}>
              {s.label}
            </Text>
            {s.key === sort && <Text style={styles.sortCheck}>✓</Text>}
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

function FilteredEmpty({ filter, onShowAll }: { filter: ListFilter; onShowAll: () => void }) {
  const label = FILTERS.find((f) => f.key === filter)?.label ?? 'these';
  return (
    <View testID="stories-filtered-empty" style={[styles.screen, styles.centered]}>
      <Text style={styles.emptySub}>No {label.toLowerCase()} stories yet.</Text>
      <Pressable
        testID="show-all"
        onPress={onShowAll}
        accessibilityRole="button"
        style={styles.secondaryCta}
      >
        <Text style={styles.secondaryCtaText}>Show all</Text>
      </Pressable>
    </View>
  );
}

// --- Card -----------------------------------------------------------------------

function StoryCard({
  story,
  meId,
  onPress,
}: {
  story: Story;
  meId: string;
  onPress: () => void;
}) {
  const bucket = bucketFor(story, meId);
  const pill = PILL[bucket];
  const isYourTurn = bucket === 'yourTurn';
  return (
    <Pressable
      testID="story-card"
      onPress={onPress}
      accessibilityRole="button"
      style={styles.card}
    >
      <View style={styles.cardRow}>
        <View style={styles.titleWrap}>
          {isYourTurn && <View testID="your-turn-dot" style={styles.turnDot} />}
          <Text style={styles.cardTitle} numberOfLines={1}>
            {story.title ?? 'Untitled'}
          </Text>
        </View>
        <View style={[styles.pill, { backgroundColor: pill.style.bg }]}>
          <Text style={[styles.pillText, { color: pill.style.text }]}>{pill.label}</Text>
        </View>
      </View>
      <Text style={styles.cardMeta}>{metaFor(story, bucket)}</Text>
    </Pressable>
  );
}

/** Card sub-line. No author names / turn count in the list payload yet — keep it honest. */
function metaFor(story: Story, bucket: Bucket): string {
  if (bucket === 'lobby') return 'Waiting to start';
  const limit = story.turn_limit != null ? ` · up to ${story.turn_limit} turns` : '';
  const who =
    bucket === 'yourTurn' ? 'Your turn' : bucket === 'waiting' ? 'Partner’s turn' : 'With your partner';
  return `${who}${limit}`;
}

// --- States ---------------------------------------------------------------------

function StoriesSkeleton() {
  return (
    <View testID="stories-skeleton" style={[styles.screen, styles.listContent]}>
      <View style={[styles.skelBar, { width: '40%', height: 28 }]} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skelCard} />
      ))}
    </View>
  );
}

function StoriesError({ onRetry }: { onRetry: () => void }) {
  return (
    <View testID="stories-error" style={[styles.screen, styles.centered]}>
      <View style={styles.emptyIcon} />
      <Text style={styles.emptyHeadline}>Couldn&rsquo;t load your stories.</Text>
      <Pressable
        testID="stories-retry"
        onPress={onRetry}
        accessibilityRole="button"
        style={styles.cta}
      >
        <Text style={styles.ctaText}>Retry</Text>
      </Pressable>
    </View>
  );
}

function FirstRunEmpty({ onStart, pending }: { onStart: () => void; pending: boolean }) {
  return (
    <View testID="stories-empty" style={[styles.screen, styles.centered]}>
      <View style={styles.emptyIcon} />
      <Text style={styles.emptyHeadline}>No stories yet</Text>
      <Text style={styles.emptySub}>
        Start one and invite a friend — you write a line, they write the next.
      </Text>
      <Pressable
        testID="start-story-cta"
        onPress={onStart}
        disabled={pending}
        accessibilityRole="button"
        style={styles.cta}
      >
        <Text style={styles.ctaText}>Start a story</Text>
      </Pressable>
    </View>
  );
}

// --- Styles ---------------------------------------------------------------------

const CARD_SHADOW = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
} as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.appBg },
  centered: { alignItems: 'center', justifyContent: 'center', gap: space[2], padding: space[6] },
  listContent: { padding: space[4], gap: space[2] },

  offlineBanner: {
    backgroundColor: '#FBEFD9',
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  offlineText: { ...type.caption, color: color.ink700 },

  card: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: space[4],
    gap: space[1],
    ...CARD_SHADOW,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: space[2], flexShrink: 1 },
  turnDot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: color.primary },
  cardTitle: { ...type.heading, color: color.ink900, flexShrink: 1 },
  cardMeta: { ...type.caption, color: color.ink500 },
  pill: { borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: 2 },
  pillText: { ...type.micro },

  // FAB — 56 circle, bottom-right thumb zone.
  fab: {
    position: 'absolute',
    right: space[4],
    width: fabSize,
    height: fabSize,
    borderRadius: radius.pill,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...CARD_SHADOW,
  },
  fabPlus: { color: color.primaryInk, fontSize: 30, lineHeight: 34, fontWeight: '400' },

  // Empty + error
  emptyIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: color.primaryTint },
  emptyHeadline: { ...type.title, color: color.ink900, textAlign: 'center' },
  emptySub: { ...type.body, color: color.ink500, textAlign: 'center' },
  cta: {
    marginTop: space[3],
    minHeight: minTapTarget,
    justifyContent: 'center',
    paddingHorizontal: space[6],
    borderRadius: radius.md,
    backgroundColor: color.primary,
  },
  ctaText: { ...type.label, color: color.primaryInk },
  secondaryCta: {
    marginTop: space[3],
    minHeight: minTapTarget,
    justifyContent: 'center',
    paddingHorizontal: space[5],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
  },
  secondaryCtaText: { ...type.label, color: color.ink700 },

  // Filter chips + sort control row
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingTop: space[3],
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], flexShrink: 1 },
  chip: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
  },
  chipOn: { backgroundColor: color.primaryTint, borderColor: color.primaryTint },
  chipText: { ...type.label, color: color.ink500 },
  chipTextOn: { color: color.primary },
  sortButton: {
    minWidth: minTapTarget,
    minHeight: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  sortText: { fontSize: 20, color: color.ink700 },

  // Sort sheet
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.16)' },
  sortSheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space[5],
    gap: space[1],
  },
  sheetHeading: { ...type.title, color: color.ink900, marginBottom: space[2] },
  sortOption: {
    minHeight: minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sortOptionText: { ...type.body, color: color.ink700 },
  sortOptionOn: { color: color.primary, fontWeight: '600' },
  sortCheck: { ...type.label, color: color.primary },

  // Skeleton
  skelBar: { borderRadius: radius.sm, backgroundColor: color.line },
  skelCard: { height: 72, borderRadius: radius.md, backgroundColor: color.line },
});
