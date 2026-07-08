/**
 * Phase 1 stub storage — in-memory only.
 * Phase 2 replaces this with the real Postgres schema per design/domain-model.md.
 * Shapes deliberately mirror the domain model so Phase 2 is a swap, not a rewrite.
 */
import { randomUUID } from 'node:crypto';

export interface StubTurn {
  id: string;
  story_id: string;
  content: string;
  sequence_number: number;
  author_type: 'human' | 'ai';
  created_at: string;
}

export interface StubStory {
  id: string;
  state: 'lobby' | 'active' | 'complete' | 'abandoned';
  // Settings are deliberately absent at creation — deferred to the Settings
  // Handshake (event-storm.md decision #7). Defaults land in Phase 2.
  turns: StubTurn[];
  created_at: string;
}

const stories = new Map<string, StubStory>();

export function createStory(): StubStory {
  const story: StubStory = {
    id: randomUUID(),
    state: 'lobby',
    turns: [],
    created_at: new Date().toISOString(),
  };
  stories.set(story.id, story);
  return story;
}

export function getStory(id: string): StubStory | undefined {
  return stories.get(id);
}

export function listStories(): StubStory[] {
  return [...stories.values()];
}

export function addTurn(storyId: string, content: string): StubTurn | undefined {
  const story = stories.get(storyId);
  if (!story) return undefined;
  const turn: StubTurn = {
    id: randomUUID(),
    story_id: storyId,
    content,
    sequence_number: story.turns.length + 1,
    author_type: 'human',
    created_at: new Date().toISOString(),
  };
  story.turns.push(turn);
  return turn;
}

export function resetStore(): void {
  stories.clear();
}
