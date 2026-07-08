# BattleApp — Glossary (Ubiquitous Language)

**Phase 0 deliverable · written 2026-07-03**

Every term below is used consistently across code, docs, UI copy, and conversation. Do not
introduce synonyms. Terms feed `bounded-contexts.md` and `domain-model.md`; the tasks and
branches under `design/tasks/` and `design/branches/` draw their vocabulary from here.

## Core objects

| Term | Meaning |
|------|---------|
| **Story** | A collaborative writing session with defined participants, a mode, and a turn limit. An ordered, **append-only** sequence of Turns. Has a lifecycle state (see Story State). Owns the `pure_human` opt-out. |
| **Turn** | One participant's contribution to a Story — a paragraph of 1–5 sentences, ≤ 500 characters. Immutable once submitted. Carries its author and author type (human or AI). |
| **Section** | A completed Turn as it appears in the Story scroll (the reader-facing unit). One Turn = one Section. |
| **Story State** | The full accumulated state of a Story: every Turn in order, whose turn it is, and the lifecycle status. It is built like **The Loop** — each Turn is informed by all Turns before it; the state accumulates rather than resets. The AI Director reads a **bounded view** of it (premise + rolling summary + the last 2 turns), never every Turn, to generate hints. |
| **Reaction** | A per-Section "like" from any **signed-in** user (author or spectator). Requires an account — a guest viewing via a share link must sign up before reacting. A value object: which Section, which user, when. |
| **Player** | A registered user account. One account type with capabilities — a Player can spectate any public Story and author when they start one or accept an Author Invite. Not two roles; capabilities are **per-Story** (see Participant / Spectator). |
| **Participant** | A Player who writes in a specific Story (an author *in that Story*). Distinct from a Spectator. A Story has two Participants in V1. |
| **Spectator** | A user viewing a Story without writing in it. Read-only, plus the ability to react per Section (reacting requires an account; guests must sign up first). |
| **Invite** | An offer to join a specific Story, carrying a **role**: **Spectator Invite** ("watch this battle") or **Author Invite** ("play with me"). |

## Modes & mechanics

| Term | Meaning |
|------|---------|
| **Freeform** | The V1 Story mode: start writing with no upfront setup. The AI Director guides quietly. |
| **Structured** | *(Designed in Phase 0, ships V2.)* A Story mode where players choose 0–5 **Story Elements** before writing. Zero elements = Freeform. |
| **Story Element** | One of the canonical scaffolding axes — **character, setting, plot, conflict, resolution**. In Structured mode a player selects values via **hybrid input**: a curated select list per element, plus an "other → custom" option. Custom values are public text and are moderated like Turns. |
| **Roguelike** | *(V2.)* A Story mode where a random Story Element seed is "dealt" to players to build from. |
| **Turn Limit** | The number of Turns after which a Story completes. Set in the Settings Handshake (e.g. 10 or 20); locked once the opening Turn is submitted. |
| **Pace Preset** | A **per-Story** setting governing the turn timer: **Fast** (24h) or **Easy** (72h). Proposed by the creator in the Settings Handshake (default preloaded) and confirmed by the invitee — **confirmation is the pace agreement**. Locked at the opening Turn. A property of the game (the Story), not the player. |
| **Settings Handshake** | The configuration step between **activation** and the **opening Turn** (designer decision 2026-07-07 — supersedes "set at story creation"). On ⚡ StoryActivated the creator's settings sheet opens with defaults preloaded (Turn Limit, Pace Preset, Pure-Human Mode, Voice Parameters); the creator **proposes** — keeping the defaults is one tap — and the invitee **confirms** or **requests changes** (the invitee never edits directly, so no lockouts). Re-proposal is allowed until the opening Turn; submitting the opening Turn **locks** Turn Limit, Pace, and Pure-Human. Voice Parameters stay adjustable mid-story via the hidden panel. A handshake never confirmed auto-abandons via the secondary timeout. |
| **Pure-Human Mode** | A per-Story boolean on the Story aggregate that disables the AI Fill-in entirely, for players who want a strictly human interchange. Default off (fill-in on). Set in the Settings Handshake; locked at the opening Turn. |

## AI

| Term | Meaning |
|------|---------|
| **AI Director** | The invisible narrative-guidance system. Reads a **bounded view** of the Story State (premise + rolling summary + the last 2 turns — never every Turn) and offers a single, optional, dismissible hint **only when a turn stalls**: it stays silent while a Participant is writing and fires only if the turn timer reaches a configurable fraction of the Pace Preset span (default ½) with no Turn submitted. **Never writes Story content**; never blocks a Turn. |
| **AI Fill-in** | A safety-net mechanic: on a turn timeout, the AI writes an **attributed** Turn ("AI stepped in for [player]") to keep a stalled Story alive. Reactive only — never proactive. Disabled by Pure-Human Mode. The one carve-out to "AI never writes content in V1." |
| **AI Partner** | *(V2.)* A mode where a Player deliberately plays a Story against the AI instead of a friend. |
| **AI Service Layer** | The shared backend client to the Anthropic API (claude-haiku-4-5) with three V1 consumers: Moderation, AI Director hints, AI Fill-in. Defined in Phase 0, built in Phase 3, consumed in Phases 6 & 7. |
| **Reject-and-Retry** | The posture that a human may reject an AI contribution (Fill-in Turn or hint) and request a regeneration. Designed for in the data model; **no UI control ships in V1**. |
| **Voice Parameters** | A **per-Story** open dial-map of tonal settings — Humor, Dread, Fear/Tension, Fantasy/Whimsy… — each 0–100, that shape **AI-authored content only**: AI Fill-in (V1) and AI Partner (V2). Set in the Settings Handshake (defaults preloaded; in V2 Structured they're set alongside Story Elements), adjustable mid-story via a hidden panel behind a small icon. Stored as an extensible map so V2 adds dials with no schema change. Does **not** affect the AI Director (structural, not voice) or Moderation (policy). Inspired by TARS's adjustable settings in *Interstellar*. Initial dials are set in the Settings Handshake (defaults preloaded). |

## Safety & lifecycle

| Term | Meaning |
|------|---------|
| **Moderation** | An automated screening pass run on every submitted Turn (and every custom Story Element value) before it is stored, via the AI Service Layer. Enforces the Moderation Policy. |
| **Moderation Policy** | The canonical rules of acceptable content: what is removed, what causes a ban. Part of the game's rules (`docs/compliance/moderation-policy.md`) and doubles as the App Store UGC content policy. |
| **Report** | A user-initiated flag on a Section or Player, routed for review. Required for App Store UGC compliance. |
| **Block** | A user action that hides another Player's content from them and prevents interaction. Required for App Store UGC compliance. |
| **Story Lifecycle** | The Story State machine. Legal transitions: **`lobby → active`** (Author Invite accepted — activation); **`lobby → abandoned`** (invite declined or expired); **`active → complete`** (turn limit reached or mutual early exit); **`active → abandoned`** (AbandonStory, or a timeout with no viable continuation). **Stalled is not a separate state** — it is `active` with `stalled_at` set, which happens on a **pure-human** turn timeout; from there **ExtendStory** clears it (back to `active`), while **AbandonStory** or a longer **secondary timeout** → `abandoned`. |
| **End Conditions** | How a Story reaches `complete`: turn limit reached, or **mutual early exit** (either Participant proposes ending, the other agrees). No AI dependency to end a Story. |

## System concepts (borrowed, used precisely)

| Term | Meaning |
|------|---------|
| **The Loop** | The accumulating cycle model borrowed from the workbench: each output becomes the next input; the record accumulates rather than repeats. Story State is built this way — see Story State above. |
| **Spectate ↔ Create spectrum** | The framing that engagement is per-Story, not per-account: the same Player spectates some Stories and authors others simultaneously. There is no "spectator account" vs "author account." |
