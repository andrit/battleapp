# Discussion — Phase 0 Cross-File Consistency Check

**Type:** QA / consistency audit informing Phase 0 close (Waves 1–2)
**Opened:** 2026-07-04
**Status:** OPEN — awaiting designer decision on how to reconcile
**Files audited:** `docs/product-development/product-story.md`, `design/glossary.md`,
`design/tech-stack.md`, `design/event-storm.md`, `design/bounded-contexts.md`,
`design/domain-model.md`

---
## Context

A deliberate cross-file consistency pass over every Phase 0 deliverable written so far, to
catch cross-concern drift before ingesting Wave 2 and starting Wave 3. Most drift comes from
docs written *early* (product-story, glossary, tech-stack) predating later decisions — the
timer-gated director hint, the token-efficiency bounded-context rule, the pace-preset move, and
the activation reorder. **Nothing structural is broken** (aggregates, contexts, and the state
machine agree); the drift is concentrated in prose descriptions of AI-director behavior.

---
## Real inconsistencies — should reconcile

### 1. Director-hint trigger: three conflicting models
- `product-story` L59 — hint "**when it's your turn**"; L81 — "**on-demand hints**"
- `glossary` (AI Director) L39 — hint "**when it's a Participant's turn**"
- `tech-stack` L70 — "**on-demand… only when the player opens the hint**"
- `event-storm` §3 (the decision) — **timer-gated: fires at ½ the span only if no turn submitted; "let them play" first**

**Issue:** three trigger models (auto-on-your-turn / on-demand-tap / timer-gated) for one
feature. Event-storm's timer-gated is current truth; the other three are stale.
**Fix:** reconcile product-story, glossary, tech-stack to the timer-gated stall-nudge model.

### 2. Director reads "whole Story State" vs the bounded-context rule
- `glossary` L16 + L39 — "The AI Director **reads the whole Story State**"
- `tech-stack` L71 + `bounded-contexts` (AI) + `domain-model` `summary` — "**never the whole growing story** — premise + rolling summary + last K turns"

**Issue:** direct contradiction — glossary tells the director to read every turn; token
efficiency forbids exactly that.
**Fix:** glossary should say the director reads a **bounded view** (rolling summary + recent turns).

### 3. Glossary "Story Lifecycle" is narrower than the actual state machine
- `glossary` L54 — "lobby → active → complete, plus abandoned = timed out with no viable continuation"
- `domain-model` — also **lobby → abandoned** (invite declined/expired), the **`stalled_at` pause + ExtendStory**, and secondary-timeout → abandoned

**Issue:** the glossary lifecycle omits the pure-human pause/extend path and lobby→abandoned.
**Fix:** update the glossary lifecycle to match `domain-model`.

---
## Minor / gaps

4. **"magic circle" undefined in the glossary** — load-bearing in `event-storm` §2 and
   `domain-model` (activation), but absent from the ubiquitous-language list. Add an entry.
5. **Reaction "any user" vs guest exclusion** — `glossary` Reaction L17 / Spectator L20 imply all
   spectators can react; `event-storm` §5 says **guests can't react until they sign up**. Tighten
   the glossary: reactions require an account.
6. **`product-story` opening-flow ordering** — L56–57 reads "Player A opens a story with a
   paragraph; Player B gets a push," but the model is **invite → accept (magic circle) → then A
   writes the opening turn**. Minor reword.
7. **`tech-stack` L33–34 vestigial line** — "the workbench's MCP tooling… can *inform* the AI
   Director/Partner logic." Leftover from early planning; conflicts with the clean "AI Service
   Layer = the dedicated backend's Anthropic client" architecture. Could mislead into treating
   the workbench as a runtime dependency. Cut/clarify.
8. **`glossary` Voice Parameters "set alongside story elements" (L44)** — elements are V2; in V1
   freeform there are none (hedged with "defaulted in Freeform"). Minor reword to avoid confusion.
9. **(cosmetic) `story_started` analytics** — in `event-storm`'s external-systems list and
   `tech-stack`, but not shown emitted in the §2 timeline. Add `☁ PostHog story_started` at
   `StoryCreated` for completeness.

---
## Decision needed
Fix **all** of these (batch the edits, then re-ingest the affected Wave 1 docs + ingest Wave 2
clean), or walk through any individually first? #1 and #2 are the ones that matter; #3–#9 are
quick. Nothing will be touched until confirmed.

_— awaiting designer response —_
---

1. Event-storm's timer-gated is the way to go
2 Im confused about this, I thought we were holding the full state in the db to save tokens?
3 update the glossary lifecycle to match `domain-model`
4 if we were going to formalize magic circle, we would have to provide a user experiennce wherein the writers really felt like they step into a new dimension, closed in by the circle. is there as way we can do that? if not, revist the notion of it being load bearing in event-storm and lets move that pillar elsewhere
5  Tighten the glossary: reactions require an account
6 fix the wording
7 clarify
8 reword it
9 complete it

---
## Claude reply — 2026-07-04

Confirmed on **1, 3, 5, 6, 7, 8, 9** — all queued as fixes. Two need a word back before I batch.

### #2 — you're right that we hold full state in the DB; these are two *different layers*
No contradiction with token-saving — separate mechanisms:
- **Where the story lives = the DB.** The complete story is stored durably in Postgres. This is
  the "state outside the context window": we never keep a long-running LLM conversation open, so
  we don't pay to re-send a growing chat history. ✓ That's the token win you're picturing.
- **How much of that stored state goes into each AI prompt = bounded.** When the director (or
  fill-in) makes a call, we do **not** paste all 20 turns from the DB into the prompt — we send a
  curated slice: premise + rolling summary + the last K turns. A prompt that grew with every turn
  would blow tokens on long stories.

So: **DB = everything (durable); each prompt = a small fixed-size window onto it.** Both save
tokens, at different layers. The glossary bug: it says the director reads the **whole** Story
State — which taken literally means dumping every turn into the prompt (the expensive thing).
**Fix:** glossary → the director reads a **bounded view** (rolling summary + recent turns); the
full state stays in the DB, the *prompt* is bounded. Does that clear it up? If so I'll apply it.

### #4 — magic circle: is there a UX for it? Yes. Do we commit? Your call.
You've named the real test: a term is only "load-bearing" if something backs it. Two paths:

**(A) Deliver the felt experience** — a lightweight but real "stepping in" moment: when the
invitee accepts, both writers get a short **threshold transition** (premise/title revealed, both
authors named, a visual "entering" beat), and the game screen is a **distinct bordered canvas**
signalling "you're inside the story space now." Cheap-ish (a transition + a framed game view) and
it genuinely delivers the closed-circle feeling. If we commit, "magic circle" earns formalization
— a glossary term + a Phase-D wireframe.

**(B) Demote the metaphor** — if we're not building that UX in V1, don't let the docs lean on an
unbacked image. The **mechanically load-bearing pillar is the activation transition**
(`lobby → active` on invite acceptance) — that's real and stays. I'd rename the references in
`event-storm` §2 and `domain-model` from "magic circle" to plain **"activation,"** and park
"magic circle UX" as a Phase-D idea.

**My lean: (B) now, (A) as a Phase-D aspiration** — keep the mechanic solid and un-metaphored in
the domain docs, and design the felt "stepping-in" experience when we do screens (Phase D), where
it belongs. But if that feeling is core to you, we commit to (A) now and I formalize it.

**Which way — (A) commit + formalize, or (B) demote to "activation" + park the UX for Phase D?**

Once you confirm #2's wording and pick #4's path, I batch all edits, then re-ingest.

_— awaiting designer response —_
---

2: ok premise + rolling summary + the last K turns. how many were you thinking? I was thinking the most recent and the on it replied to.
4: B. and lets leave some options for Phase D:
   - activation: best bet so far
   - Beginning: has a story feel to it, "In the beginning..."
   - game on: fun 
   - Lets get it on: maybe more of a header possibility in the UI than a term. take on the battleapp with a ufc fight commencement twist
   - Lose Yourself: same as preceding, except its from the Eminem rap battle movie

---
## Claude reply — 2026-07-04

Both locked. Everything's confirmed — batching now.

### #2 — window size: **K = 2**, exactly your instinct
"The most recent Turn and the one it replied to" = the last two turns, i.e. one full exchange.
That's the right floor for a two-writer alternating game: the rolling **summary** carries the
whole arc, and the last 2 turns carry the immediate beat the director/fill-in has to continue
from. Locked as **premise + rolling summary + last 2 turns**. I'm writing `K` as a **tunable
constant, default 2** (not a magic number buried in a prompt) so if playtesting shows the
fill-in feels disconnected on long stories we bump it in one place. Applied to `tech-stack`
("last 2 turns…"), `glossary`, and the AI context in `bounded-contexts`.

### #4 — going with **(B)**: "activation" is the domain term; "magic circle" leaves the docs
Renamed every load-bearing reference — `event-storm` §2 + resolved-decision #1, and
`domain-model` (state machine, invariant, `activated_at` note) — from "magic circle" to plain
**activation** (`lobby → active` on Author Invite acceptance). The mechanic is unchanged and
solid; only the unbacked metaphor is gone from the domain docs.

**Parked for Phase D** — the "felt stepping-in" UX (path A), when we design screens. Your
naming candidates for the threshold moment, kept on the shelf:
- **activation** — the domain term; safe default, also fine as the UI label
- **"In the beginning…"** — story-feel opener; strong for the transition *screen* copy
- **"Game on"** — playful, on-brand with the battle energy
- **"Let's get it on"** — UFC-commencement twist; reads as a header/animation beat, not a term
- **"Lose Yourself"** — 8 Mile rap-battle nod; same shape as above, a moment not a term

My read: keep **activation** as the noun in code/docs, and treat the rest as candidate *UI
copy* for the Phase-D threshold transition — they're screen moments, not domain vocabulary.
That distinction is exactly why (B) is right now: the mechanic stays un-metaphored, the
theatre gets designed where theatre belongs.

### The full batch I'm applying (all 9)
1 director-hint → timer-gated stall-nudge (product-story, glossary, tech-stack) · 2 bounded
view + K=2 · 3 glossary lifecycle → full state machine · 4 magic circle → activation +
Phase-D park · 5 reactions require an account (glossary Reaction + Spectator) · 6 product-story
opening flow → invite→accept→activate→opening turn · 7 tech-stack: workbench = build-time tool,
not a runtime dependency · 8 Voice Parameters reworded (no elements in V1 Freeform) · 9 add
`☁ PostHog story_started` at StoryCreated.

Then re-ingesting the edited Wave 1 docs and ingesting Wave 2 clean. Nothing structural moved —
this was all prose reconciliation, as the audit predicted.

_— end Claude reply —_
---