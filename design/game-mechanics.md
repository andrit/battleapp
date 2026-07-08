# BattleApp — Game Mechanics

**Phase 0 deliverable · written 2026-07-04**

The canonical rules of play. Vocabulary is from `glossary.md`; the events these rules produce
are in `event-storm.md`; the aggregates and invariants that enforce them are in
`domain-model.md`. This doc is the single source of truth for *how the game plays* and feeds
`task-flow.md`, `user-flow.md`, and `kano.md`. V1 scope; V2 items are marked.

## 0. V1 framing — BattleApp is an AI app in V1

V1 is not "the game now, AI later." Three AI mechanics ship in V1, all via the one **AI Service
Layer** (`claude-haiku-4-5`): **Moderation** (screens every Turn), the **AI Director** (optional
stall-nudge hints), and **AI Fill-in** (attributed safety-net on a timeout). What is deferred to
V2 is the **AI Partner** *play mode* — deliberately playing a Story against the AI instead of a
friend. The AI is a restrained helper, never the author; the creative act stays human.

## 1. The Turn — granularity

- A **Turn** is one paragraph: **1–5 sentences, ≤ 500 characters.** The cap keeps the game
  bite-sized (the Words with Friends shape) and keeps each AI call cheap.
- A Turn is **immutable once submitted** — never edited or deleted. Turns are **append-only and
  sequential** (`sequence_number` contiguous and unique within the Story).
- Each Turn carries its **author** and **author type** (`human` or `ai`). AI Turns are visibly
  **attributed** ("AI stepped in for [player]").
- A submitted Turn becomes a **Section** — the reader-facing unit in the Story scroll. One Turn =
  one Section.

## 2. Turn order & the opening

- A Story has **two Participants** in V1, who **alternate** Turns.
- **Order of play at the start:** invite → the invitee **accepts** → the Story **activates**
  (`lobby → active`) → the **Settings Handshake** (the creator proposes Turn Limit, Pace Preset,
  Pure-Human Mode, and Voice Parameters — defaults preloaded, keeping them is one tap; the
  invitee **confirms** or requests changes) → the **creator writes the opening Turn** → the
  timer passes to the invitee. The creator does **not** write anything until the settings are
  confirmed. (See `event-storm.md` §2 and `glossary.md` — Settings Handshake.)
- After the opening Turn, play alternates: on each `TurnAdded`, the turn passes to the other
  Participant, who is notified by push.

## 3. Pace & the turn timer

- **Pace Preset** is a **per-Story** setting, not a per-player trait: **Fast (24h)** or
  **Easy (72h)** per Turn. Proposed by the creator in the **Settings Handshake** (default
  preloaded) and **confirmed by the invitee — confirmation is the pace agreement.** Locked once
  the opening Turn is submitted.
- The timer starts when the turn passes to a Participant (`TurnPassed`) and governs the
  escalation ladder below.

## 4. The escalation ladder (one stalled turn)

The single sequence that governs a Participant who hasn't submitted. Each rung is measured
against that Participant's Pace Preset span (24h or 72h):

1. **Play** — turn opens: **no hint, no nudge.** Let them write.
2. **Director hint** — at a **configurable fraction of the span (default ½)**, *only if no Turn
   has been submitted*, the AI Director offers **one** optional, dismissible hint. Submit in time
   → no hint fires (and no director call is made — token efficiency). The Director reads a
   **bounded view** (premise + rolling summary + the last 2 turns), **never** writes Story
   content, and **never** blocks a Turn.
3. **Fill-in warning** — at **deadline − 1h**, a push (`FillInWarningIssued`) warns the waiting
   Participant's opponent that fill-in is near.
4. **Deadline** — `TurnTimedOut`. Then, branching on `pure_human`:
   - **`pure_human` off (default):** **AI Fill-in** writes an **attributed** Turn (reading the
     Story's Voice Parameters) to keep the Story alive. Reactive only — never proactive.
   - **`pure_human` on:** **no AI writes.** The Story **stalls** (`stalled_at` set; it stays
     `active`, not a new state). See §5.

## 5. Pure-Human Mode

- A **per-Story boolean** on the Story aggregate, **default off** (fill-in on). When on, **AI
  Fill-in is disabled entirely** — for players who want a strictly human interchange. Set in the
  Settings Handshake; locked at the opening Turn.
- On a timeout in a pure-human Story: `StoryStalled` → **pause**. The waiting Participant may:
  - **ExtendStory** → clears `stalled_at`, back to normal `active`; or
  - **AbandonStory** → `abandoned`.
  - If neither, a **longer secondary timeout** auto-abandons the Story.

## 6. Turn limits & end conditions

- **Turn Limit** is set in the **Settings Handshake** (e.g. 10 or 20) and locked at the opening
  Turn. When the Section at
  `sequence_number == turn_limit` is added, the Story **completes** (`active → complete`).
- **Mutual early exit:** either Participant may **ProposeEnd**; if the other **AgreeEnd**s, the
  Story completes early. A declined proposal (`EndDeclined`) leaves play unchanged.
- **No AI dependency to end a Story** — ending is purely human/turn-count driven.
- **Abandonment:** `AbandonStory`, or a timeout with no viable continuation (the pure-human
  secondary timeout, or a declined/expired invite from `lobby`), moves the Story to `abandoned`.

## 7. Moderation — every Turn, before it exists

- **Every submitted Turn is screened by Moderation** (via the AI Service Layer) **before it is
  stored.** Only moderation-passed content becomes a Turn; **rejected content never persists.**
- On **reject**: the author sees the reason and may **edit & resubmit freely, no penalty**. This
  is the moderation-rejection branch (`design/branches/moderation-rejection.md`).
- Moderation also screens **custom Story Element values** (V2 Structured mode).
- The rules themselves live in the **Moderation Policy** (`docs/compliance/moderation-policy.md`),
  which doubles as the App Store UGC content policy. The AI context *executes* screening; the
  Safety context *governs* it via the Policy.

## 8. Spectating & reactions

- Anyone can **view** a Story — a Participant, a signed-in **Spectator**, or a **guest** via a
  share link (read-only).
- **Reactions require an account.** A signed-in user (author or spectator) may add a per-Section
  **like** (one per user per Section, a toggle). **Guests cannot react until they sign up.**
- Reactions notify the Section's author (batched ≤ 5 min).

## 9. Voice Parameters (pointer)

- A **per-Story** open dial-map (Humor, Dread, Fear/Tension, Fantasy/Whimsy…, each 0–100) that
  shapes **AI-authored content only** — AI Fill-in (V1) and AI Partner (V2). It does **not**
  affect the Director (structural, not voice) or Moderation (policy). Full definition in
  `glossary.md`; the consuming contracts land in `ai-service-layer.md`.

## 10. Fixed for V1 vs deferred

| Mechanic | V1 | V2 |
|----------|----|----|
| Mode | **Freeform** only | Structured, Roguelike |
| Players | two humans, async | AI Partner play mode; real-time co-writing |
| Turn | 1–5 sentences, ≤ 500 chars, append-only | — |
| Pace | Fast 24h / Easy 72h | — |
| Director | timer-gated stall hint (default ½) | — |
| Fill-in | attributed, `pure_human` opt-out | reject-and-retry control (lineage reserved now) |
| End | fixed turn limit + mutual early exit | — |
| Reactions | per-Section like, account required | — |
| Moderation | every Turn + custom values | — |
