import { describe, expect, it } from 'vitest';

import {
  canTransition,
  legalNextStates,
  type StoryState,
} from '../types.js';

const ALL: StoryState[] = ['lobby', 'active', 'complete', 'abandoned'];

// The four legal edges, verbatim from design/domain-model.md § Story state machine.
const LEGAL: Array<[StoryState, StoryState]> = [
  ['lobby', 'active'], // Author Invite accepted (activation)
  ['lobby', 'abandoned'], // invite declined or never accepted
  ['active', 'complete'], // turn_limit reached, or mutual early exit
  ['active', 'abandoned'], // AbandonStory, or timeout with no viable continuation
];

describe('canTransition — legal edges', () => {
  it.each(LEGAL)('allows %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });
});

describe('canTransition — illegal edges', () => {
  const legalSet = new Set(LEGAL.map(([f, t]) => `${f}->${t}`));

  // Every from/to pair not in the legal set must be rejected — including same-state
  // "transitions" (lobby→lobby, active→active) and anything out of a terminal state.
  const illegal = ALL.flatMap((from) =>
    ALL.map((to) => [from, to] as [StoryState, StoryState]),
  ).filter(([from, to]) => !legalSet.has(`${from}->${to}`));

  it.each(illegal)('rejects %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});

describe('terminal states have no legal next states', () => {
  it('complete is terminal', () => {
    expect(legalNextStates('complete')).toEqual([]);
  });
  it('abandoned is terminal', () => {
    expect(legalNextStates('abandoned')).toEqual([]);
  });
});

describe('stalled is not a state', () => {
  // "Stalled" is `active` + `stalled_at` set, not a distinct state. ExtendStory keeps the
  // story `active` (an in-state mutation, not a transition), and AbandonStory from a stalled
  // story is the ordinary active → abandoned edge. So the machine never targets a "stalled".
  it('active can only advance to complete or abandoned', () => {
    expect([...legalNextStates('active')].sort()).toEqual(['abandoned', 'complete']);
  });
});
