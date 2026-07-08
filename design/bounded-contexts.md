# BattleApp — Bounded Contexts

**Phase 0 deliverable · written 2026-07-03**

Derived from `event-storm.md`; vocabulary from `glossary.md`. Partitions the domain into
bounded contexts, each with a clear responsibility, its own aggregate roots, and explicit
relationships. Feeds `domain-model.md`. The point: keep the **Game** core clean and isolate
the **AI** behind a service boundary so it stays swappable.

## The contexts

### 1. Identity & Access — *supporting, upstream*
- **Responsibility:** player accounts, authentication, profile (display name, avatar, Pace
  (display name, avatar). Gates every other command.
- **Aggregate root:** Player.
- **Invariants:** unique username; auth token in `expo-secure-store` (never AsyncStorage);
  **one account with capabilities, not two roles** — capability is per-Story.
- **V1:** email/password. **V2:** magic link.

### 2. Game — *the CORE domain*
- **Responsibility:** the heart of the product — Story lifecycle, Turns, turn order, end
  conditions, **Pace Preset**, Voice Parameters, the pure-human flag, and the rolling summary.
  Everything the product is *for* lives here.
- **Aggregate roots:** **Story** (owns its Turns, Voice Parameters, and rolling summary),
  **Turn**.
- **Invariants:** Turns are **append-only and sequential**; exactly one current author while
  `active`; `turn_limit` enforced; the state machine (`lobby → active → complete | abandoned`)
  only advances legally; `pure_human` gates the AI Fill-in; Turn content ≤ 500 chars.
- **V1:** freeform, two participants, async. **V2:** structured/roguelike modes, real-time.

### 3. Invitation — *supporting*
- **Responsibility:** invites carrying a role; the join flow.
- **Aggregate root:** **Invite** (role = author | spectator; status = pending | accepted |
  declined).
- **Invariants:** an Author Invite is gated by Story capacity (2 in V1); accepting an Author
  Invite adds a Participant to the Story; share-link invites supported.

### 4. Social — *supporting*
- **Responsibility:** spectating and per-Section reactions; the social read-side.
- **Aggregate root:** **Reaction** (value object: section, user, `like`). Read models:
  spectator feed, story list.
- **Invariants:** one Reaction per user per Section (toggle); spectators are read-only.

### 5. AI — *supporting / generic subdomain (swappable)*
- **Responsibility:** the **AI Service Layer** wrapping Anthropic (`claude-haiku-4-5`) and its
  three V1 consumers — **Moderation**, **Director hints**, **Fill-in** (+ **Partner** in V2).
  Owns the token-efficiency mechanics (prompt caching, moderation+director call-merge,
  bounded-context assembly — premise + rolling summary + the last 2 turns, never the whole story). Reads per-Story **Voice Parameters** for
  the **content-generating** consumers only (Fill-in, Partner) — never Director or Moderation.
- **Aggregate roots:** none persistent — a **stateless service**. It consumes Game state and
  returns results; the durable outcomes (a moderation verdict, an AI-authored Turn) are recorded
  in the Game context.
- **Invariants:** Moderation gates Turn storage; the Director never writes content; the Fill-in
  is attributed and gated by `pure_human`; Voice shapes only AI-authored content. **Anti-corruption
  boundary:** Game depends on the layer's contracts (`moderateTurn`, `directorHint`, `fillIn`),
  not on Anthropic specifics — so the provider can change (Groq, etc.) without touching Game.
- **V1:** the three consumers, minimal voice dials. **V2:** AI Partner, the voice-tuning UI,
  the reject-and-retry control.

### 6. Safety & Moderation — *supporting*
- **Responsibility:** the **Moderation Policy** (the game's rules + enforcement), reports,
  blocks, and bans. Satisfies Apple UGC Guideline 1.2.
- **Aggregate roots:** **Report**, **Block**. The Policy itself is a document
  (`docs/compliance/moderation-policy.md`).
- **Invariants:** a Report routes to review (24h SLA); a Block hides content **bidirectionally**;
  repeated upheld violations → ban. Note the split: the AI context *executes* screening; this
  context *governs* it via the Policy.
- **V1:** automated screening + report + block + published policy.

### 7. Notification — *supporting, downstream*
- **Responsibility:** push + in-app notifications, badge counts, deep-link routing.
- **Aggregate roots:** none — **event-driven**, reacts to events from other contexts.
- **Invariants:** every notification deep-links to the correct screen; push permission requested
  after the first Turn (not on launch); reactions batched.

## Context map (relationships & integration patterns)

- **Identity → everything** — upstream; authentication gates all commands.
- **Invitation → Game** — *customer/supplier*: an accepted Author Invite adds a Participant.
- **Game ↔ AI** — Game is the **customer**, AI the **supplier**, integrated through an
  **anti-corruption layer**: Game calls stable contracts and never sees Anthropic details; AI
  reads Game state (story-so-far / rolling summary) to produce results.
- **Game → Social** — Social projects Game's Turns into read models and attaches Reactions.
- **Safety ↔ Game / AI** — Safety owns the Policy; the AI context executes screening against it;
  Reports/Blocks reference Game Sections and Players.
- **Everything → Notification** — downstream, event-driven from Game / Social / Invitation.

## Ownership summary

| Context | Aggregate roots | Core invariant |
|---------|-----------------|----------------|
| Identity & Access | Player | one account, capabilities per-Story |
| **Game (core)** | **Story, Turn** | append-only sequential Turns; legal state machine |
| Invitation | Invite | role-typed; capacity-gated |
| Social | Reaction | one like per user per Section |
| AI | *(stateless service)* | moderation gates storage; director never writes; voice → AI content only |
| Safety & Moderation | Report, Block | 24h review; bidirectional block |
| Notification | *(event-driven)* | correct deep-link every time |
