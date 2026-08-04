import { describe, expect, it } from 'vitest';

import { advanceTurn } from '../turn-policy.js';
import type { Participant, Story } from '../types.js';

const participant = (id: string, joinedAt: string): Participant => ({
  player_id: id,
  role: 'author',
  joined_at: joinedAt,
});

// Only `participants` matters to the policy; the rest is filler to satisfy the Story shape.
const storyWith = (participants: Participant[]): Story =>
  ({ id: 's1', participants }) as unknown as Story;

describe('advanceTurn (round_robin)', () => {
  it('solo → stays the author’s turn', () => {
    const story = storyWith([participant('a', '2026-01-01T00:00:00Z')]);
    expect(advanceTurn(story, 'a')).toBe('a');
  });

  it('two authors → alternates (join order), wrapping', () => {
    const story = storyWith([
      participant('a', '2026-01-01T00:00:00Z'),
      participant('b', '2026-01-01T00:01:00Z'),
    ]);
    expect(advanceTurn(story, 'a')).toBe('b');
    expect(advanceTurn(story, 'b')).toBe('a'); // wraps
  });

  it('N authors → round-robins by join order and wraps at the end', () => {
    const story = storyWith([
      participant('a', '2026-01-01T00:00:00Z'),
      participant('b', '2026-01-01T00:01:00Z'),
      participant('c', '2026-01-01T00:02:00Z'),
    ]);
    expect(advanceTurn(story, 'a')).toBe('b');
    expect(advanceTurn(story, 'b')).toBe('c');
    expect(advanceTurn(story, 'c')).toBe('a'); // wrap
  });

  it('is deterministic regardless of the array order (sorts by joined_at)', () => {
    const story = storyWith([
      participant('b', '2026-01-01T00:01:00Z'),
      participant('a', '2026-01-01T00:00:00Z'), // out of join order in the array
    ]);
    expect(advanceTurn(story, 'a')).toBe('b');
  });

  it('unknown author → wraps to the first participant', () => {
    const story = storyWith([
      participant('a', '2026-01-01T00:00:00Z'),
      participant('b', '2026-01-01T00:01:00Z'),
    ]);
    expect(advanceTurn(story, 'ghost')).toBe('a');
  });
});
