# BattleApp — Domain Model

**Phase 0 deliverable · written 2026-07-03**

Compiles from `event-storm.md` + `bounded-contexts.md`; terms from `glossary.md`. Defines the
aggregates, their fields and invariants, and the Story state machine. Feeds Phase 2 (schema &
client state) and the `design/tasks/` + `design/branches/` files. V1 scope; V2 fields are
marked and deliberately reserved so V2 is additive (no rework).

## Aggregates & value objects

### Story — *aggregate root (Game context)*
The central aggregate: an append-only sequence of Turns plus the settings that govern play.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid | |
| `title` | string \| null | nameable any time; **V2** auto-title |
| `mode` | `'freeform'` \| `'structured'`(V2) \| `'roguelike'`(V2) | **V1: freeform only** |
| `elements` | StoryElement[] \| null | **V2** (structured mode); null in V1 |
| `turn_limit` | int | set in the **Settings Handshake**; locked at the opening Turn |
| `pace_preset` | `'fast'` \| `'easy'` | governs the turn timer (fast 24h / easy 72h); proposed by the creator in the Settings Handshake (default preloaded), confirmed by the invitee; locked at the opening Turn |
| `state` | `'lobby'` \| `'active'` \| `'complete'` \| `'abandoned'` | see state machine |
| `stalled_at` | timestamp \| null | set on a pure-human timeout (paused); cleared by extend |
| `pure_human` | boolean | when true, AI Fill-in is disabled; set in the Settings Handshake, locked at the opening Turn |
| `voice` | `{ [dial]: 0..100 }` | per-Story **Voice Parameters** — open dial-map (V1: humor, dread, fear, fantasy) |
| `summary` | text \| null | rolling compact summary for **bounded AI context** (token efficiency) |
| `created_by` | Player.id | |
| `participants` | Participant[] | `{ player_id, role:'author', joined_at }` — 2 authors in V1 |
| `current_author_id` | Player.id \| null | whose turn; null unless `active` |
| `created_at` / `activated_at` / `settings_confirmed_at` / `completed_at` | timestamp | `activated_at` set on activation (Author Invite accepted); `settings_confirmed_at` set on ⚡ SettingsConfirmed — the opening Turn requires it (null until the handshake completes) |

**Invariants:**
- Turns are **append-only and sequential** — never edited or deleted once submitted.
- Exactly one `current_author_id` while `state = active`.
- **Activation**: `lobby → active` only when the Author Invite is accepted (2
  participants). The creator's opening Turn is written **after** activation — and only after
  ⚡ SettingsConfirmed (the **Settings Handshake** sits between the two; `settings_confirmed_at`
  is the gate).
- `turn_limit` reached → `complete`.
- `pure_human = true` disables AI Fill-in (the StoryStalled path runs instead).
- `voice` shapes **only AI-authored Turns** (fill-in, V2 partner) — never Director or Moderation.
- `pace_preset` is a property of the game (the Story) — never a per-player trait. It, `turn_limit`, and `pure_human` are proposed by the creator in the **Settings Handshake** (defaults preloaded), confirmed by the invitee (`settings_confirmed_at`), and **immutable once the opening Turn is submitted**; `voice` stays adjustable mid-story.

### Turn — *entity within the Story aggregate boundary (Game context)*
One contribution. **Immutable** once submitted.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid | |
| `story_id` | Story.id | |
| `author_id` | Player.id | the human; for an AI fill-in, the player it stepped in for |
| `author_type` | `'human'` \| `'ai'` | AI turns are visibly attributed |
| `content` | string | ≤ 500 chars, 1–5 sentences |
| `sequence_number` | int | contiguous, unique within the Story |
| `moderation_status` | `'passed'` | only passed content becomes a Turn; rejected never persists |
| `supersedes` | Turn.id \| null | **regeneration lineage** — a regenerated AI turn links to the one it replaces. **Always null in V1**; reserved for V2 reject-and-retry |
| `created_at` | timestamp | |

**Invariants:** immutable after creation; `sequence_number` contiguous & unique per Story; only
moderation-passed content becomes a Turn; `author_type='ai'` turns carry attribution.

### Reaction — *value object (Social context)*
`{ id, turn_id (the Section), user_id, type:'like', created_at }`
**Invariant:** at most one Reaction per `(turn_id, user_id)` — a toggle.

### Player — *aggregate root (Identity & Access context)*
`{ id, display_name (unique), avatar|null, stats:{stories_played, stories_completed}, created_at }`
Auth credentials (email/password, tokens) are owned by the Identity context, not modeled as story data.
**Invariant:** one account; spectate/author are **per-Story capabilities**, not account roles. Pace is a Story setting, not a Player trait.

### Invite — *aggregate root (Invitation context)*
`{ id, story_id, inviter_id, invitee_ref (username or share-link token), role:'author'|'spectator', status:'pending'|'accepted'|'declined', created_at }`
**Invariants:** an accepted **Author** Invite adds a Participant and (at 2 participants) triggers
activation; author invites are gated by Story capacity (2 in V1).

### Report — *aggregate root (Safety & Moderation context)*
`{ id, target_type:'turn'|'player', target_id, reporter_id, reason, status:'open'|'reviewed'|'upheld'|'dismissed', created_at }`
**Invariant:** routes to review (24h SLA); an upheld report contributes toward a ban.

### Block — *aggregate root (Safety & Moderation context)*
`{ id, blocker_id, blocked_id, created_at }`
**Invariant:** hides content **bidirectionally** between the two players.

## Story state machine

Transitions (only these are legal):
- **`lobby → active`** — Author Invite accepted (2 participants). Activation; the
  creator then writes the opening Turn.
- **`lobby → abandoned`** — invite declined or never accepted (expiry).
- **`active → complete`** — `turn_limit` reached, **or** mutual early exit (ProposeEnd + AgreeEnd).
- **`active → abandoned`** — AbandonStory, or a timeout with no viable continuation.

**Stalled is not a separate state** — it is `active` with `stalled_at` set, which happens on a
**pure-human** turn timeout (AI Fill-in disabled). From there:
- **ExtendStory** → clears `stalled_at` (back to normal `active`).
- **AbandonStory** or the **secondary timeout** → `abandoned`.

## Aggregate → context map

| Aggregate / VO | Context | Note |
|----------------|---------|------|
| **Story** (root) + **Turn** | Game (core) | append-only turns; voice; summary; state machine |
| Reaction | Social | per-Section like (value object) |
| Player | Identity & Access | one account, per-Story capabilities |
| Invite | Invitation | role-typed; activation trigger |
| Report, Block | Safety & Moderation | UGC safety |

## Extensibility — designed-for, not-built (so V2 is additive)
- **`voice`** is an open dial-map → V2 adds dials with **no schema change**.
- **`mode` / `elements`** → Structured & Roguelike modes drop in without reworking Story.
- **`supersedes`** on Turn → reject-and-retry (V2) needs **no migration**.
- **`summary`** → bounded AI context (token efficiency) works from day one.
- **`stalled_at` + ExtendStory** → the pure-human pause/extend path, without a new state.
