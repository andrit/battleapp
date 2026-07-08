# Discussion — Token Efficiency & AI Restraint (environmental / trust angle)

**Type:** feature/architecture side-discussion informing Phase 0 (tech-stack, AI service layer, product story)
**Opened:** 2026-07-03
**Status:** OPEN — awaiting designer decisions
**Relates to:** `tech-stack.md`, `ai-service-layer.md`, `product-story.md`, `domain-model.md`

---
## Designer — 2026-07-03

In accordance with developing strategies to minimize token use (to mitigate environmental
impact) — what are some suggestions? This could be an important selling point for users wary
of too much AI being deployed.

Ideas / questions:
- A **prompt cache**.
- Saving an **md file of the story**, where each section is annotated with the user name and
  time.
- **Is an md file secure, or hackable?** If that's a concern, is there a **better way to save
  the state outside the context window?**

---
## Claude reply — 2026-07-03

Strong instinct — and it aligns with the product's whole ethos (AI as a restrained helper,
not a firehose). Concrete strategies, then your specific questions.

### Where the tokens actually go
Every AI moment in battleapp — moderation (each turn), director hint, fill-in, V2 partner —
sends the **story-so-far** as context. Naively, that grows with every turn, so a 20-turn
story costs ~20× a 1-turn story per call. Two levers: **cache the stable parts** and **cap
the growing parts.**

### Suggested strategies (roughly by impact)
1. **Prompt caching — yes, biggest lever.** Cache the stable prefix (system prompt: narrative
   rules + moderation policy + voice framing + story premise); put only the volatile new turn
   last. The **moderation system prompt is identical across every user and every turn**, so
   cache-hit rates are very high → large savings on the most frequent call. (Anthropic prompt
   caching, ~5-min TTL; async turns hours apart won't share a per-story cache, but the shared
   system-prompt cache still pays off across concurrent stories.)
2. **Combine moderation + director in one call.** When a turn view needs both, run them as one
   prompt / two tasks instead of two calls (flagged back in the initial planning). Halves the
   call count at that moment.
3. **On-demand director hints, not automatic.** Generate a hint only when the player *opens*
   it — dismiss/ignore = zero tokens. Most turns won't spend a director call.
4. **Bounded context per call.** Don't resend the whole story to the director/fill-in. Send
   the premise + a short rolling summary + the last K turns. Caps per-call cost regardless of
   story length. (The rolling summary is the "state outside the context window" — see below.)
5. **Right-sized model.** `claude-haiku-4-5` (already chosen) is the efficient choice.
6. **No always-on conversation.** The story lives in durable storage; each call builds a fresh,
   minimal prompt from it — we never hold a long-lived context window open. Inherently frugal.
7. **Transparency as a feature.** Optionally surface "AI compute used" per story and market
   "efficient, restrained AI." (Mirrors the workbench's own token-governance ethos — make AI
   cost legible rather than hidden.)

### Your specific questions
- **Prompt cache?** Yes — recommend it (strategy 1). Order prompts stable-first, volatile-last
  to maximize prefix cache hits.
- **An md file of the story, section = user + time?** Your underlying instinct — *persist the
  state outside the context window* — is exactly the architecture. But the **durable store
  should be the database, not an md file.** The **`Turn` table already stores content + author
  + timestamp** — that *is* the annotated, section-by-section record you're describing. An md
  file is a great **export/share artifact** (already the V2 "story export"), not the primary
  state.
- **Is an md file secure / hackable?** The **file format is not the security boundary** —
  storage location + access control is. A plain md file has no encryption and, if it lives on
  the user's device, is tamperable. The **server-side database with backend auth is the right
  store**: access-controlled, authoritative, backed up, not directly reachable by users. Note
  the story content is **public to spectators by design**, so it isn't secret — what matters is
  **integrity** (no tampering) and **write-authorization** (only participants write), both
  enforced by the backend. At-rest encryption, if ever wanted, is a DB/storage setting, not a
  file-format choice.
- **Better way to save state outside the context window?** The **game database (Postgres)** —
  already the plan. Context window = ephemeral per call, reconstructed from the DB each time.

### Re-scan impact (minimal, per Phase-0 timing)
- `tech-stack.md` (written) → small **AI token-efficiency** subsection.
- `ai-service-layer.md` (unwritten) → the real home: caching, moderation+director call-merging,
  bounded-context assembly, rolling summary.
- `product-story.md` (written) → optional one-line "efficient/restrained AI" differentiator.
- `domain-model.md` (unwritten) → note the optional per-Story rolling **summary** field.

### Decisions for you
1. Adopt the strategy set (caching, merged moderation+director, on-demand hints, bounded
   context + rolling summary)? Any you'd drop?
2. Make efficiency a **user-facing selling point** (a transparency UI + marketing line), or keep
   it an internal engineering practice for now?
3. Confirm **DB is the state store, md is export-only** (I believe already implied — confirming).

_— awaiting designer response —_
---

## Decisions for you
1. Yes, Adopt the strategy set 
2. Make efficiency a user-facing selling point. My company's philosophy is to promote AI safety, accountability and responsible use
3. Confirm, DB is the state store, md is export-only.

please update all files mentioned. and update this file with confirmation completed

---
## Claude reply — 2026-07-03 (confirmation — completed)

Decisions locked: (1) **strategy set adopted in full**; (2) efficiency is a **user-facing
selling point**, framed under the company's AI safety / accountability / responsible-use
philosophy; (3) confirmed **DB = state store, md = export-only**.

Updates applied:
- `tech-stack.md` — added an **AI token efficiency & restraint** subsection.
- `product-story.md` — added **Responsible, efficient AI — a stated value** (differentiator).
- Absorbed when written: `ai-service-layer.md` (caching, moderation+director merge,
  bounded-context assembly, rolling summary), `domain-model.md` (optional per-Story rolling
  **summary** field), and a transparency touch ("AI compute used") in `user-flow.md` /
  `game-mechanics.md`.

Ingestion of the changed files is batched into the post-rebuild clean re-ingest (the
replace-by-path ingest fix must be live first, so no duplicates are created).

_— completed —_
---

## Reconciliation — 2026-07-04

Post-audit alignment (see `discussions/phase-0-consistency-check.md`, items #1 and #2). Two
strategy descriptions **above predate later decisions and are superseded** — read them with these
corrections. The token-saving intent is unchanged; only the mechanism is corrected.

- **Strategy 3 "On-demand director hints" → "stall-gated director hints."** The final model
  (`event-storm.md` §3, resolved decision #6) is **timer-gated**, not a manual "open the hint"
  tap: the hint fires only if the turn timer reaches a **configurable fraction of the Pace Preset
  span (default ½)** with **no Turn submitted**. Same token win (≤ 1 director call per stalled
  turn; a player who submits in time triggers none), corrected trigger. Any "on-demand" /
  "opens the hint" phrasing above is stale.
- **Strategy 4 "last K turns" → "last 2 turns."** `K` is locked as a **tunable constant,
  default 2** — the most recent Turn and the one it replied to.

Everything else in this discussion still stands: prompt caching, moderation+director call-merge,
bounded context + rolling summary, DB = state store / md = export-only, and efficiency as a
user-facing selling point.

_— end reconciliation —_
---
