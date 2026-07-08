# BattleApp — AI Director Specification

**Phase 0 deliverable · written 2026-07-07**

What the AI Director does and does not do in V1. Vocabulary from `glossary.md`; the trigger
mechanics are canon from `game-mechanics.md` §4 and `event-storm.md` §3 (resolved decision #6);
the call contract lives in `ai-service-layer.md`. V1 scope; V2 items are marked.

## 1. What the Director is

The invisible narrative-guidance system. When a Participant's turn **stalls**, the Director
offers **one** optional, dismissible hint to get them writing again. It is a nudge, not an
author — structural guidance ("raise the stakes", "answer the question your partner left
hanging"), not prose.

## 2. Trigger — timer-gated, never proactive

- The hint fires **only** when the turn timer reaches a **configurable fraction of the Pace
  Preset span (default ½)** with **no Turn submitted** (▶ RequestDirectorHint →
  ⚡ DirectorHintGenerated).
- A player who submits in time triggers **no Director call at all** — silence while a
  Participant is writing is a design rule *and* the token-efficiency win (≤ 1 Director call per
  stalled turn; see `discussions/token-efficiency.md` reconciliation).
- The hint never repeats: one per stalled turn. Dismissing it (⚡ HintDismissed) generates
  nothing further.
- Escalation context: the hint is step 2 of the ladder (play → **hint** at ½ span → fill-in
  warning at deadline − 1h → deadline). The Director's job ends when the hint is shown.

## 3. Input — the bounded view

The Director never reads the whole Story. Its input is the **bounded view** of Story State
(defined in `glossary.md`):

| Component | Source | Why |
|-----------|--------|-----|
| Premise | Story (title/opening framing) | anchors the hint to the story's world |
| Rolling summary | `Story.summary` | compressed mid-story context (token cap) |
| Last **2** Turns | `Turn` table (K = 2, tunable constant) | the immediate exchange the stalled player must answer |

This caps per-call cost regardless of story length and is assembled by the AI Service Layer,
not the Director prompt itself.

**Mood inference:** from the bounded view the Director may infer the story's current *mood*
(tension rising, comedic beat, cliffhanger) and shape the hint's framing to fit — a
high-tension story gets "twist the knife", not "introduce a joke". This is inference from the
text it already receives, **not** a read of Voice Parameters (see §5).

## 4. Output contract

- **One hint**: 1–2 sentences, ≤ 200 characters, structural in nature ("consider…", "what if…").
- Rendered as a dismissible **hint card** on the compose surface (`task-flow.md` task 2, step 3).
- Never inserted into the Story scroll; never stored as a Turn; leaves no trace in Story State
  beyond the ⚡ DirectorHintGenerated / ⚡ HintDismissed events and PostHog
  `director_hint_viewed` / `director_hint_dismissed`.

## 5. What the Director is NOT

These are invariants, not preferences (see `bounded-contexts.md` §5):

1. **Never writes Story content.** No Turn, no Section, no text that could be mistaken for
   story prose. The one carve-out to "AI never writes content in V1" is **AI Fill-in — a
   separate, attributed mechanic** that fires at the deadline (step 4 of the ladder), reads
   Voice Parameters, and produces a visibly attributed Turn. The Director and the Fill-in
   share the AI Service Layer and nothing else. Do not conflate them in code, UI copy, or docs.
2. **Never blocks a Turn.** The hint has no gate function; submitting while a hint is showing
   simply discards it. Blocking is Moderation's job (policy, also not the Director).
3. **Does not read Voice Parameters.** Voice shapes **AI-authored content only** (Fill-in V1,
   Partner V2). The Director is structural guidance, not voice (designer decision,
   `discussions/ai-voice-tuning.md`).
4. **Not proactive.** No hints at turn start, no "welcome" guidance, no unsolicited
   suggestions. Freeform's "the AI Director guides quietly" means exactly the stall hint.

## 6. Failure behavior

A Director failure must be invisible: if the AI Service Layer call errors or exceeds its
latency budget, **no hint is shown and nothing is retried** — the escalation ladder continues
unaffected (fill-in warning still fires at deadline − 1h). A missing hint is a degraded
nicety, never an error surfaced to the player. Contract detail in `ai-service-layer.md` §4.

## 7. V2 (designed-for, not built)

- Hint quality feedback (was this hint used?) feeding tuning data.
- Structured/Roguelike modes: the bounded view gains Story Elements as context.
- Reject-and-retry applies to Fill-in Turns, not hints — a dismissed hint is simply gone.
