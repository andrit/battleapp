import { describe, expect, it } from 'vitest';

import type { Story, Turn } from '../../domain/types.js';
import {
  boundedViewFor,
  HintLedger,
  isTurnStalled,
  stallThresholdMs,
  turnClockStartedAt,
} from '../director.js';

const HOUR = 60 * 60 * 1000;

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: 's1',
    title: 'The Glass Ferry',
    mode: 'freeform',
    elements: null,
    turn_limit: null,
    pace_preset: 'fast',
    state: 'active',
    stalled_at: null,
    pure_human: false,
    voice: {},
    summary: null,
    created_by: 'p1',
    participants: [
      { player_id: 'p1', role: 'author', joined_at: 'now' },
      { player_id: 'p2', role: 'author', joined_at: 'now' },
    ],
    current_author_id: 'p2',
    created_at: 'now',
    activated_at: '2026-07-01T00:00:00.000Z',
    settings_confirmed_at: null,
    completed_at: null,
    ...overrides,
  };
}

function makeTurn(seq: number, createdAt: string, content = `turn ${seq}`): Turn {
  return {
    id: `t${seq}`,
    story_id: 's1',
    author_id: 'p1',
    author_type: 'human',
    content,
    sequence_number: seq,
    moderation_status: 'passed',
    supersedes: null,
    created_at: createdAt,
  };
}

describe('stallThresholdMs', () => {
  it('is half the pace span; null defaults to fast', () => {
    expect(stallThresholdMs('fast')).toBe(12 * HOUR);
    expect(stallThresholdMs('easy')).toBe(36 * HOUR);
    expect(stallThresholdMs(null)).toBe(12 * HOUR);
  });
});

describe('turnClockStartedAt', () => {
  it('uses the last turn, or activation when there are no turns', () => {
    const story = makeStory();
    expect(turnClockStartedAt(story, [makeTurn(1, '2026-07-05T00:00:00.000Z')])).toBe(
      '2026-07-05T00:00:00.000Z',
    );
    expect(turnClockStartedAt(story, [])).toBe('2026-07-01T00:00:00.000Z');
  });
});

describe('isTurnStalled', () => {
  const started = Date.parse('2026-07-05T00:00:00.000Z');

  it('is true once half the fast span (12h) has elapsed with no new turn', () => {
    const story = makeStory();
    const turns = [makeTurn(1, '2026-07-05T00:00:00.000Z')];
    expect(isTurnStalled(story, turns, started + 13 * HOUR)).toBe(true);
    expect(isTurnStalled(story, turns, started + 1 * HOUR)).toBe(false);
  });

  it('is false when the story is not active or nobody is on the clock', () => {
    const turns = [makeTurn(1, '2026-07-05T00:00:00.000Z')];
    expect(isTurnStalled(makeStory({ state: 'lobby' }), turns, started + 99 * HOUR)).toBe(false);
    expect(isTurnStalled(makeStory({ current_author_id: null }), turns, started + 99 * HOUR)).toBe(
      false,
    );
  });
});

describe('boundedViewFor', () => {
  it('carries premise + summary + only the last 2 turns', () => {
    const story = makeStory({ summary: 'They boarded a ferry.' });
    const turns = [
      makeTurn(1, 'a', 'one'),
      makeTurn(2, 'b', 'two'),
      makeTurn(3, 'c', 'three'),
    ];
    const view = boundedViewFor(story, turns);
    expect(view.premise).toBe('The Glass Ferry');
    expect(view.summary).toBe('They boarded a ferry.');
    expect(view.lastTurns.map((t) => t.content)).toEqual(['two', 'three']);
  });
});

describe('HintLedger', () => {
  it('serves at most once per (story, turn index)', () => {
    const ledger = new HintLedger();
    expect(ledger.wasServed('s1', 2)).toBe(false);
    ledger.markServed('s1', 2);
    expect(ledger.wasServed('s1', 2)).toBe(true);
    expect(ledger.wasServed('s1', 3)).toBe(false); // next turn is eligible again
  });
});
