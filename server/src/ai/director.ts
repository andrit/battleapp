// Pure director-hint gating (functional core; the Anthropic call is the impure shell in
// service.ts). Encodes ai-director-spec.md: a hint fires only when a turn STALLS — the timer
// reaches half the Pace-Preset span with no Turn submitted — at most once per stalled turn, and
// never while a Participant is actively writing (a submitted turn triggers no call at all).

import type { PacePreset, Story, Turn } from '../domain/types.js';

const HOUR_MS = 60 * 60 * 1000;

/** Pace-Preset per-turn spans (game-mechanics §4): fast 24h, easy 72h. */
const PACE_SPAN_MS: Record<PacePreset, number> = {
  fast: 24 * HOUR_MS,
  easy: 72 * HOUR_MS,
};

/**
 * Half of the Pace-Preset span — the stall threshold. `pace_preset` is null until the Settings
 * Handshake locks it (Phase 4); until then we assume the tighter `fast` cadence so the gate still
 * has a defined threshold.
 */
export function stallThresholdMs(pace: PacePreset | null): number {
  return PACE_SPAN_MS[pace ?? 'fast'] / 2;
}

/**
 * When the current turn's clock started: the last Turn's timestamp, or (no turns yet) the story's
 * activation. Returns null when there's no defined reference (e.g. an inactive/lobby story) — the
 * caller treats that as "no hint applies".
 */
export function turnClockStartedAt(story: Story, turns: readonly Turn[]): string | null {
  if (turns.length > 0) return turns[turns.length - 1]!.created_at;
  return story.activated_at ?? null;
}

/** True iff the current turn has stalled: active, someone's turn, and the half-span has elapsed. */
export function isTurnStalled(story: Story, turns: readonly Turn[], nowMs: number): boolean {
  if (story.state !== 'active' || story.current_author_id == null) return false;
  const startedAt = turnClockStartedAt(story, turns);
  if (startedAt == null) return false;
  return nowMs - Date.parse(startedAt) >= stallThresholdMs(story.pace_preset);
}

/**
 * The Director's bounded view (ai-director-spec §3): premise + rolling summary + the last K=2
 * Turns. Caps per-call cost regardless of story length; never the whole story, never Voice.
 */
export const DIRECTOR_CONTEXT_TURNS = 2;

export interface BoundedView {
  premise: string | null;
  summary: string | null;
  lastTurns: { author_type: Turn['author_type']; content: string }[];
}

export function boundedViewFor(story: Story, turns: readonly Turn[]): BoundedView {
  return {
    premise: story.title,
    summary: story.summary,
    lastTurns: turns
      .slice(-DIRECTOR_CONTEXT_TURNS)
      .map((t) => ({ author_type: t.author_type, content: t.content })),
  };
}

/**
 * Tracks which stalled turns have already been offered a hint, so the Director fires at most once
 * per stalled turn (ai-director-spec §2). Keyed by story + the turn index the hint is for. In
 * memory by design: a hint is a degraded nicety, so losing the ledger on restart (re-offering a
 * hint once) is harmless — never worth a table.
 */
export class HintLedger {
  private served = new Set<string>();

  private key(storyId: string, turnCount: number): string {
    return `${storyId}:${turnCount}`;
  }

  wasServed(storyId: string, turnCount: number): boolean {
    return this.served.has(this.key(storyId, turnCount));
  }

  markServed(storyId: string, turnCount: number): void {
    this.served.add(this.key(storyId, turnCount));
  }
}
