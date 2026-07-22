/**
 * StorySection — one Turn rendered as a story Section. The hero reading surface:
 * serif (Lora) content on the reader's chosen paper. Reusable across the Story
 * screen, Guest read-only, and spectator.
 *
 * Two treatments, per design-tokens.md ("AI is the quieter voice"):
 *  - Human turn: author chip (A/B color + 6px dot), serif content in ink-900 on
 *    `paper`, optional reaction affordance.
 *  - AI turn (author_type === 'ai'): a fixed cool-slate card (`ai-tint` bg, 2px
 *    `ai-line` left border) with an "◆ AI stepped in for @x" chip and slightly
 *    muted ink-700 content. The cool tint is FIXED — it never follows the paper
 *    choice, so the human/AI contrast (restraint made visible) holds either way.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { Turn } from '../domain/types';
import {
  color,
  paper as paperTokens,
  defaultPaper,
  radius,
  space,
  type,
  minTapTarget,
  type PaperChoice,
} from '../theme/tokens';

export interface StorySectionProps {
  turn: Turn;
  /** @handle to display in the author chip (human) or after "stepped in for" (AI). */
  authorName: string;
  /** Which of the two author colors this human turn uses. Ignored for AI turns. */
  authorSlot: 'a' | 'b';
  /** Reader's chosen paper — sets the human-section background only. */
  paper?: PaperChoice;
  /** Reading-control size bump: 'story' (default) or 'storyLg'. */
  size?: 'story' | 'storyLg';
  reactionCount?: number;
  reacted?: boolean;
  /** When provided, the reaction affordance renders (parent owns the state). */
  onToggleReaction?: () => void;
  /** FadeInDown entrance (default true). Disable to render a list without a mount cascade. */
  animateEntrance?: boolean;
}

function StorySectionComponent({
  turn,
  authorName,
  authorSlot,
  paper = defaultPaper,
  size = 'story',
  reactionCount = 0,
  reacted = false,
  onToggleReaction,
  animateEntrance = true,
}: StorySectionProps) {
  const isAI = turn.author_type === 'ai';
  const storyType = size === 'storyLg' ? type.storyLg : type.story;
  const entering = animateEntrance ? FadeInDown.springify().damping(18) : undefined;

  const reaction =
    onToggleReaction != null ? (
      <Pressable
        testID="react-toggle"
        onPress={onToggleReaction}
        hitSlop={hitSlopFor(space[1])}
        accessibilityRole="button"
        accessibilityLabel={reacted ? 'Remove reaction' : 'React with a heart'}
        style={styles.reactionRow}
      >
        <Text style={[styles.heart, { color: reacted ? color.heart : color.ink300 }]}>
          {reacted ? '♥' : '♡'}
        </Text>
        {reactionCount > 0 && <Text style={styles.reactionCount}>{reactionCount}</Text>}
      </Pressable>
    ) : null;

  if (isAI) {
    return (
      <Animated.View testID="story-section-ai" entering={entering} style={styles.aiSection}>
        <View style={styles.aiChip}>
          <Text style={styles.aiChipText}>{`◆ AI stepped in for ${authorName}`}</Text>
        </View>
        <Text style={[storyType, styles.aiContent]}>{turn.content}</Text>
        {reaction}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      testID="story-section"
      entering={entering}
      style={[styles.humanSection, { backgroundColor: paperTokens[paper] }]}
    >
      <View style={styles.authorChip}>
        <View style={[styles.authorDot, { backgroundColor: authorColor(authorSlot) }]} />
        <Text style={[styles.authorName, { color: authorColor(authorSlot) }]}>{authorName}</Text>
      </View>
      <Text style={[storyType, styles.humanContent]}>{turn.content}</Text>
      {reaction}
    </Animated.View>
  );
}

function authorColor(slot: 'a' | 'b'): string {
  return slot === 'a' ? color.authorA : color.authorB;
}

/** Grow a small target to the 48×48 thumb-zone minimum via hitSlop (Task-6 fix). */
function hitSlopFor(contentSize: number) {
  const pad = Math.max(0, Math.round((minTapTarget - contentSize) / 2));
  return { top: pad, bottom: pad, left: pad, right: pad };
}

const styles = StyleSheet.create({
  humanSection: {
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.line,
  },
  humanContent: {
    color: color.ink900,
  },
  aiSection: {
    backgroundColor: color.aiTint,
    borderLeftWidth: 2,
    borderLeftColor: color.aiLine,
    borderTopRightRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    marginVertical: space[1],
  },
  aiContent: {
    color: color.ink700,
  },
  authorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1] + 1, // 5px per wireframe
    marginBottom: 2,
  },
  authorDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
  },
  authorName: {
    ...type.caption,
    fontWeight: '600',
  },
  aiChip: {
    alignSelf: 'flex-start',
    backgroundColor: color.surface,
    borderRadius: radius.sm,
    paddingHorizontal: space[1] + 2,
    paddingVertical: 1,
    marginBottom: space[1] - 1,
  },
  aiChipText: {
    ...type.micro,
    color: color.aiInk,
    fontWeight: '600',
  },
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    marginTop: space[1],
  },
  heart: {
    fontSize: 15,
    lineHeight: 18,
  },
  reactionCount: {
    ...type.caption,
    color: color.ink500,
  },
});

export const StorySection = memo(StorySectionComponent);
export default StorySection;
