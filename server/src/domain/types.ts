// ponytail: this file is MIRRORED VERBATIM to app/src/domain/types.ts (server is canonical).
// No shared package yet — two package roots on a bind mount (Expo + Fastify). Edit both copies
// in the same change; the root `typecheck` proxy and CI diff them.
// ceiling: a third consumer of these types, or a second real drift incident.
// upgrade: extract to a shared package via npm workspaces.
//
// Canonical source of truth for these shapes: design/domain-model.md (Phase 0).
// Timestamps are ISO 8601 strings. V2-reserved fields are marked and are null/absent in V1.

// --- Story state machine (design/domain-model.md § Story state machine) ---

export type StoryState = 'lobby' | 'active' | 'complete' | 'abandoned';

// The only legal transitions. Note: "stalled" is NOT a state — it is `active` with
// `stalled_at` set (pure-human timeout). ExtendStory clears it (stays `active`); AbandonStory
// or the secondary timeout is `active → abandoned`. So the machine has exactly four states.
const LEGAL_TRANSITIONS: Record<StoryState, readonly StoryState[]> = {
  lobby: ['active', 'abandoned'],
  active: ['complete', 'abandoned'],
  complete: [],
  abandoned: [],
};

/** True iff `from → to` is a legal Story state transition. Pure; no I/O. */
export function canTransition(from: StoryState, to: StoryState): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

/** The legal next states from `from` (empty for terminal states). */
export function legalNextStates(from: StoryState): readonly StoryState[] {
  return LEGAL_TRANSITIONS[from];
}

// --- Game context: Story + Turn ---

export type StoryMode = 'freeform' | 'structured' | 'roguelike'; // V1: freeform only
export type PacePreset = 'fast' | 'easy'; // fast 24h / easy 72h per turn

/** V1 curated dials; the map is open so V2 adds dials with no schema change. */
export type VoiceDial = 'humor' | 'dread' | 'fear' | 'fantasy';
/** dial name → 0..100 (range enforced at runtime, not in the type). */
export type VoiceParameters = Record<string, number>;

/** V2 (Structured mode) — reserved shape; `elements` is null in V1. */
export interface StoryElement {
  axis: 'character' | 'setting' | 'plot' | 'conflict' | 'resolution';
  value: string;
}

export interface Participant {
  player_id: string;
  role: 'author';
  joined_at: string;
}

export interface Story {
  id: string;
  title: string | null; // nameable any time; V2 auto-title
  mode: StoryMode; // V1: 'freeform'
  elements: StoryElement[] | null; // V2 (structured); null in V1
  turn_limit: number; // set in the Settings Handshake; locked at the opening Turn
  pace_preset: PacePreset; // proposed by creator, confirmed by invitee; locked at opening Turn
  state: StoryState;
  stalled_at: string | null; // set on a pure-human timeout; cleared by ExtendStory
  pure_human: boolean; // when true, AI Fill-in disabled; locked at the opening Turn
  voice: VoiceParameters; // shapes AI-authored content only; adjustable mid-story
  summary: string | null; // rolling compact summary for bounded AI context
  created_by: string; // Player.id
  participants: Participant[]; // 2 authors in V1
  current_author_id: string | null; // whose turn; null unless `active`
  created_at: string;
  activated_at: string | null; // set on activation (Author Invite accepted)
  settings_confirmed_at: string | null; // set on SettingsConfirmed; gates the opening Turn
  completed_at: string | null;
}

export type AuthorType = 'human' | 'ai';

export interface Turn {
  id: string;
  story_id: string;
  author_id: string; // the human; for an AI fill-in, the player it stepped in for
  author_type: AuthorType; // AI turns are visibly attributed
  content: string; // ≤ 500 chars, 1–5 sentences (enforced at runtime)
  sequence_number: number; // contiguous, unique within the Story
  moderation_status: 'passed'; // only passed content becomes a Turn; rejected never persists
  supersedes: string | null; // regeneration lineage; ALWAYS null in V1, reserved for V2
  created_at: string;
}

// --- Social context ---

export interface Reaction {
  id: string;
  turn_id: string; // the Section reacted to
  user_id: string;
  type: 'like';
  created_at: string;
}

// --- Identity & Access context ---

export interface PlayerStats {
  stories_played: number;
  stories_completed: number;
}

export interface Player {
  id: string;
  display_name: string; // unique
  avatar: string | null;
  stats: PlayerStats;
  created_at: string;
}

// --- Invitation context ---

export type InviteRole = 'author' | 'spectator';
export type InviteStatus = 'pending' | 'accepted' | 'declined';

export interface Invite {
  id: string;
  story_id: string;
  inviter_id: string;
  invitee_ref: string; // username or share-link token
  role: InviteRole;
  status: InviteStatus;
  created_at: string;
}

// --- Safety & Moderation context ---

export type ReportTargetType = 'turn' | 'player';
export type ReportStatus = 'open' | 'reviewed' | 'upheld' | 'dismissed';

export interface Report {
  id: string;
  target_type: ReportTargetType;
  target_id: string;
  reporter_id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
}

export interface Block {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}
