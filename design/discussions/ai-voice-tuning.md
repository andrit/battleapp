# Discussion — AI Writer's Voice Tuning ("TARS dials")

**Type:** feature side-discussion informing Phase 0 (Wave 2 domain, Wave 3 mechanics, Wave 4 AI)
**Opened:** 2026-07-03
**Status:** OPEN — awaiting designer's three calls (scope location, which outputs, V1 vs V2)
**Relates to:** AI Fill-in (V1), AI Partner (V2), AI Director; `glossary.md`, `event-storm.md`, `domain-model.md`, `ai-service-layer.md`, `ai-director-spec.md`

---
## Designer — 2026-07-03 (the idea)

New idea for the AI Fill-in and the V2 "play with AI" feature. (Question: do we have to
scan over the already-created steps?)

Tune the AI's writer's-voice options — similar to the controls on the robot **TARS** from
Christopher Nolan's *Interstellar*:
- sense of humor
- sense of dread
- sense of fear
- sense of fantasy
- etc.

So when the AI chimes in, the collaborators can make the voice **predictable** and **shape
the input to their approach / style**.

---
## Claude reply — 2026-07-03

Strongly on-theme: it hands collaborators a dial to shape the AI's contribution to their
style — the same "AI helps, humans keep creative control" posture behind pure-human mode and
reject-and-retry. TARS's adjustable settings map cleanly.

**Do we have to re-scan already-created docs? Barely — the point of catching it in Phase 0.**

| Doc | Status | Impact |
|-----|--------|--------|
| `glossary.md` | written + ingested | Small touch-up — add "Voice Parameters" term (re-ingest) |
| `event-storm.md` | written | Small touch-up — `SetVoiceParameters → VoiceParametersUpdated`; fill-in/director read them |
| `domain-model.md` | not yet written | Absorbs it — decide where params live |
| `game-mechanics.md`, `ai-service-layer.md`, `ai-director-spec.md` | not yet written | Fold in when written |
| `design/tasks/tune-ai-voice.md` | not yet written | New task file |
| `product-story.md`, `tech-stack.md` | written | Untouched (maybe one optional differentiator line) |

Two surgical edits, nothing rewritten. Everything else is written correctly the first time.

**Three decisions shape how I model it:**

1. **Where do the dials live?** Rec: **per-Story**, defaulted from the creator's profile,
   adjustable by either participant. (Alt: per-Participant — each shapes their own AI moments;
   or a Player-profile default only.)
2. **Which AI outputs do they shape?** Rec: **AI Fill-in (V1)** + optionally **Director
   hints** (high-"dread" director nudges toward tension); **AI Partner (V2)** inherits it.
   **Moderation is exempt** (policy, not voice).
3. **V1 or V2?**
   - (A) Design now; V1 ships a sensible **default voice**, tuning UI lands V2 (like reject-retry).
   - (B) Ship a **minimal set of dials in V1** — cheap (params → a few lines of AI system
     prompt) and it makes the one AI-writes-content moment in V1 feel intentional.
   Lean: **(B)-minimal**.

**Parameter set:** tonal dials, TARS-style 0–100 — **Humor, Dread, Fear/Tension,
Fantasy/Whimsy**, extensible (romance, mystery…). Small curated set in V1.

**Caveat:** LLM output is stochastic, so the dials make the voice **consistent in tone**, not
deterministic. That's why **reject-and-retry** is the natural partner — tune the dial, and if
a fill-in still misses, regenerate.

**Awaiting:** your three calls (1 location, 2 outputs, 3 V1-minimal vs V2). Then I fold Voice
Parameters into the domain model + downstream and make the two touch-ups.

_— end Claude reply —_
---


**Three decisions shape how I model it:**

1. **Where do the dials live?** per story. they are decided when defining the story elements and remain available through a hidden panel accessible via a small icon. 
2. **Which AI outputs do they shape?** Only in voice elements, so AI Fill-in (V1) & AI Partner (V2). Director hints are chiefly structural, they can have some style aspect to them, but their not "voice". Correct, Moderation is exempt (policy, not voice).
3. **V1 or V2?**
   B- minimal. Thats inline with the lean MVP approach. but make it easy to extend in V2. Be mindful not to work us into a corner.

   please reply witha confirmation and then I'll give the go ahead.

---
## Claude reply — 2026-07-03 (confirmation)

Confirmed — exactly what I'll build, mirroring your three calls:

1. **Location — per-Story.** Voice Parameters are a Story attribute, set at story creation
   (the same setup step where story elements are defined; in V1 Freeform, elements aren't
   chosen but the voice dials are still set/defaulted there). Adjustable mid-story via a
   **hidden panel behind a small icon** — off the main writing surface, non-intrusive.
2. **Scope of effect — AI-authored content only.** The dials shape **AI Fill-in (V1)** and
   **AI Partner (V2)**. **Not the Director** (structural guidance, not voice). **Not
   Moderation** (policy, not voice). The dials only ever touch the moments the AI actually
   *writes*.
3. **Delivery — V1-minimal, V2-extensible.** A small curated dial set in V1 (Humor, Dread,
   Fear/Tension, Fantasy/Whimsy), each 0–100.

**Anti-corner design (the "don't paint us in" part):** store voice as an **open dial map**
(`{ dial_name: 0–100 }`) on the Story — not fixed columns — so V2 adds dials with zero schema
migration. The AI Service Layer builds the voice section of the AI system prompt from whatever
dials are present, so new dials need no prompt re-plumbing. Reject-and-retry remains the
tonal-miss escape hatch.

**Where it lands on your green-light:** `glossary.md` (+term, re-ingest), `event-storm.md`
(`SetVoiceParameters`), `domain-model.md` (voice dial-map on Story), `game-mechanics.md` +
`user-flow.md` (the hidden-panel UX), `ai-service-layer.md` (prompt assembly),
`design/tasks/tune-ai-voice.md` (new task). `ai-director-spec.md` explicitly notes it does
**not** read voice.

Awaiting your go-ahead.

_— end Claude reply —_
---

---
## Reconciliation — 2026-07-07 (Settings Handshake)

Designer decision 2026-07-07 (see `event-storm.md` resolved decision #7 and `glossary.md` —
**Settings Handshake**): story configuration is **no longer set at story creation**. All
settings — including the Voice Parameters dials — are proposed by the creator in a handshake
**between activation and the opening Turn** (defaults preloaded, one tap to keep) and confirmed
by the invitee. Read "set at story creation" above as "set in the Settings Handshake".

Everything else in this discussion stands unchanged: per-Story dials, AI-authored content only
(never Director, never Moderation), V1-minimal dial set, open dial-map (no schema change for
V2), and mid-story adjustment via the hidden panel.

_— end reconciliation —_
---