-- BattleApp initial schema (Phase 2, Task 2)
-- Transcribes design/domain-model.md. Domain invariants are enforced as DB constraints where
-- SQL can hold them; invariants that need counting/contiguity/polymorphism are enforced in app
-- logic and noted inline. Postgres 16: gen_random_uuid() is built-in (no extension needed).

-- Identity & Access
CREATE TABLE players (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name             text NOT NULL UNIQUE,
  avatar                   text,
  stats_stories_played     integer NOT NULL DEFAULT 0 CHECK (stats_stories_played >= 0),
  stats_stories_completed  integer NOT NULL DEFAULT 0 CHECK (stats_stories_completed >= 0),
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- Game core: Story
-- turn_limit / pace_preset are NULL until the Settings Handshake sets them (a lobby story is
-- created settings-free; event-storm decision #7). settings_confirmed_at is the gate: non-null
-- means the settings were confirmed and are locked at the opening Turn.
CREATE TABLE stories (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                  text,
  mode                   text NOT NULL DEFAULT 'freeform'
                           CHECK (mode IN ('freeform', 'structured', 'roguelike')),
  elements               jsonb,                                  -- V2 (structured); null in V1
  turn_limit             integer CHECK (turn_limit IS NULL OR turn_limit > 0),
  pace_preset            text CHECK (pace_preset IN ('fast', 'easy')),
  state                  text NOT NULL DEFAULT 'lobby'
                           CHECK (state IN ('lobby', 'active', 'complete', 'abandoned')),
  stalled_at             timestamptz,
  pure_human             boolean NOT NULL DEFAULT false,
  voice                  jsonb NOT NULL DEFAULT '{}'::jsonb,     -- open dial-map
  summary                text,
  created_by             uuid NOT NULL REFERENCES players(id),
  current_author_id      uuid REFERENCES players(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  activated_at           timestamptz,
  settings_confirmed_at  timestamptz,
  completed_at           timestamptz
);

-- Participants of a Story (2 authors in V1; the max-2 capacity is app-enforced via Invite gating
-- — a count constraint would need a trigger). PK prevents a player joining a story twice.
CREATE TABLE participants (
  story_id   uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  player_id  uuid NOT NULL REFERENCES players(id),
  role       text NOT NULL DEFAULT 'author' CHECK (role = 'author'),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, player_id)
);

-- Turn: append-only, immutable once written.
-- UNIQUE(story_id, sequence_number) holds the append-only, one-turn-per-position invariant
-- (contiguity itself is app-enforced). content length 1..500; "1–5 sentences" is not SQL-checkable.
CREATE TABLE turns (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id           uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  author_id          uuid NOT NULL REFERENCES players(id),
  author_type        text NOT NULL CHECK (author_type IN ('human', 'ai')),
  content            text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  sequence_number    integer NOT NULL CHECK (sequence_number > 0),
  moderation_status  text NOT NULL DEFAULT 'passed' CHECK (moderation_status = 'passed'),
  supersedes         uuid REFERENCES turns(id),                 -- V2 regen lineage; null in V1
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, sequence_number)
);

-- Reaction: one like per (Section, user) — the toggle invariant.
CREATE TABLE reactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turn_id     uuid NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES players(id),
  type        text NOT NULL DEFAULT 'like' CHECK (type = 'like'),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (turn_id, user_id)
);

CREATE TABLE invites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id     uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  inviter_id   uuid NOT NULL REFERENCES players(id),
  invitee_ref  text NOT NULL,                                   -- username or share-link token
  role         text NOT NULL CHECK (role IN ('author', 'spectator')),
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Report: target_type is polymorphic ('turn' | 'player'), so target_id carries no FK (can't
-- reference two tables) — referential integrity of target_id is app-enforced.
CREATE TABLE reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type  text NOT NULL CHECK (target_type IN ('turn', 'player')),
  target_id    uuid NOT NULL,
  reporter_id  uuid NOT NULL REFERENCES players(id),
  reason       text NOT NULL,
  status       text NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'reviewed', 'upheld', 'dismissed')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  uuid NOT NULL REFERENCES players(id),
  blocked_id  uuid NOT NULL REFERENCES players(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

-- Query-path indexes (the UNIQUE constraints already index (story_id, sequence_number) and
-- (turn_id, user_id); these cover the remaining common lookups).
CREATE INDEX idx_stories_state ON stories (state);
CREATE INDEX idx_invites_story ON invites (story_id);
CREATE INDEX idx_participants_player ON participants (player_id);
