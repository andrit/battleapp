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
  /** Set a player's unique display name (the first-run handle pick). 'taken' if it collides. */
  updateDisplayName(id: string, displayName: string): Promise<Player | 'taken'>;
}

export interface StoryRepo {
  /** Persist a settings-free lobby story; the creator is its first participant. */
  create(createdBy: string): Promise<Story>;
  findById(id: string): Promise<Story | null>;
  list(): Promise<Story[]>;
  /**
   * Dev single-player loop until real turn-flow (Phase 5+): activate a lobby story on its first
   * turn and mark `authorId` as the current author. With one dev player this keeps it "your turn"
   * so the loop continues without a second player. No-op if the story is missing.
   */
  setActiveAuthor(storyId: string, authorId: string): Promise<void>;
  /**
   * Add a player as a story participant (dev join, until real invites). Idempotent: returns the
   * story if already a participant; 'full' at the 2-author cap; 'not_found' if the story is missing.
   */
  addParticipant(storyId: string, playerId: string): Promise<Story | 'full' | 'not_found'>;
}

export interface TurnRepo {
  /**
   * Append a human turn (assigns sequence_number). Returns `null` if the story does not exist, or
   * `'stale'` when `expectedSequence` is given and no longer matches the next sequence — the
   * optimistic-concurrency guard that rejects a stale offline turn on replay ("the turn moved on").
   */
  append(
    storyId: string,
    authorId: string,
    content: string,
    expectedSequence?: number,
  ): Promise<Turn | null | 'stale'>;
  listByStory(storyId: string): Promise<Turn[]>;
}

export interface AuthRepo {
  /**
   * Resolve the Player for an OIDC identity `(provider, subject)` — returning the linked player if
   * the identity is known, else creating a new Player (with a generated unique display_name that
   * the user renames at first sign-in) and linking it. Idempotent per identity.
   */
  findOrCreatePlayer(provider: string, subject: string): Promise<Player>;
  /** Persist a refresh token by its hash, with an expiry. */
  storeRefreshToken(hash: string, playerId: string, expiresAt: string): Promise<void>;
  /** Look up a stored refresh token by hash (does not check expiry — caller does). */
  findRefreshToken(hash: string): Promise<{ playerId: string; expiresAt: string } | null>;
  /** Delete a refresh token (rotation on refresh, or revoke on sign-out). */
  deleteRefreshToken(hash: string): Promise<void>;
}

export interface Repos {
  players: PlayerRepo;
  stories: StoryRepo;
  turns: TurnRepo;
  auth: AuthRepo;
  close(): Promise<void>;
}
