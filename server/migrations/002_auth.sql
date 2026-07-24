-- Phase 5: OIDC social-login identities + our own refresh tokens.
-- A Player is one person; auth_identities links external provider identities (Apple/Google) to a
-- Player, so a player can add providers later without a schema change. We issue our OWN tokens
-- after verifying a provider id_token — the provider's tokens never touch our API.

CREATE TABLE auth_identities (
  provider    text NOT NULL CHECK (provider IN ('apple', 'google')),
  subject     text NOT NULL,                               -- the provider's stable user id (sub)
  player_id   uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, subject)
);
CREATE INDEX auth_identities_player_idx ON auth_identities (player_id);

-- Refresh tokens are opaque; we store only their SHA-256 hash (never the token), with an expiry,
-- so a leaked DB can't be replayed. Rotated on use (single-use) and deletable on sign-out.
CREATE TABLE refresh_tokens (
  token_hash  text PRIMARY KEY,
  player_id   uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_player_idx ON refresh_tokens (player_id);
