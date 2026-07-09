import type { Player, Story, Turn } from '../domain/types.js';

// Repository contracts. Two implementations satisfy these: in-memory (fast unit tests, and the
// running server's fallback when DATABASE_URL is unset) and Postgres (production). Only the
// aggregates the current endpoints need are here; Reaction/Invite/Report/Block repos land with
// the phases that use them (Social, Invitation=Phase 4, Safety).

export interface PlayerRepo {
  /**
   * ponytail: dev-only bootstrap player used as created_by/author_id until auth (Phase 4).
   * ceiling: real multi-user auth. upgrade: authenticated Player from the Identity context.
   */
  ensureDevPlayer(): Promise<Player>;
  findById(id: string): Promise<Player | null>;
}

export interface StoryRepo {
  /** Persist a settings-free lobby story; the creator is its first participant. */
  create(createdBy: string): Promise<Story>;
  findById(id: string): Promise<Story | null>;
  list(): Promise<Story[]>;
}

export interface TurnRepo {
  /** Append a human turn; returns null if the story does not exist. Assigns sequence_number. */
  append(storyId: string, authorId: string, content: string): Promise<Turn | null>;
  listByStory(storyId: string): Promise<Turn[]>;
}

export interface Repos {
  players: PlayerRepo;
  stories: StoryRepo;
  turns: TurnRepo;
  close(): Promise<void>;
}
