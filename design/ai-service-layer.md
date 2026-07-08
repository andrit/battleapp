# BattleApp — AI Service Layer

**Phase 0 deliverable · written 2026-07-07**

The shared backend client to the Anthropic API and its three V1 consumers, with per-consumer
contracts. Vocabulary from `glossary.md`; boundary rules from `bounded-contexts.md` §5;
token-efficiency strategy from `tech-stack.md` + `discussions/token-efficiency.md`; Director
behavior from `ai-director-spec.md`. **Nesting: defined here in Phase 0, built in Phase 3,
consumed in Phases 6 & 7.** V1 scope; V2 items are marked.

## 1. Shape

One backend module (the only Anthropic client in the system), one API key held by the backend.
Model: **`claude-haiku-4-5`** ($1 / $5 per MTok input/output; 200K context; 64K max output —
far beyond anything here). Users never need an Anthropic account.

**Anti-corruption boundary:** Game code calls three stable contracts — `moderateTurn`,
`directorHint`, `fillIn` — and never sees Anthropic specifics (model IDs, prompt text, SDK
types). The provider is swappable behind the contracts (scale path per `tech-stack.md`:
evaluate Groq at ~$500+/month).

**Stateless by design:** no always-on conversation. The Story lives in Postgres (the state
store); every call builds a fresh, minimal prompt from it. The layer persists nothing itself —
durable outcomes (a moderation verdict, an AI-authored Turn) are recorded by the Game context.

## 2. Prompt assembly & caching

Prompt order is **stable-first, volatile-last** (caching is a byte-exact prefix match):

```
system  = [ stable block: rules + policy + output format  ← cache_control breakpoint ]
messages = [ volatile: bounded view, the turn under review, etc. ]
```

- **Prompt caching:** default 5-minute TTL; cache writes cost 1.25× input price, reads ~0.1×.
  Break-even is 2 requests within the TTL — the moderation system prompt is identical across
  every user and every turn, so concurrent traffic keeps it hot.
- **⚠ Haiku 4.5 minimum cacheable prefix is 4096 tokens.** A shorter stable prefix silently
  never caches (no error — `cache_creation_input_tokens` just stays 0). The moderation system
  prompt must therefore carry the **full Moderation Policy text** (its natural bulk), keeping
  the stable block above 4096 tokens. Director/fill-in prompts are smaller and rarer; if their
  stable blocks stay under the minimum they simply run uncached — acceptable at their volume.
- **Verification is part of the Phase 3 build:** an integration test asserts
  `usage.cache_read_input_tokens > 0` on a second back-to-back moderation call. Zero means a
  silent invalidator (timestamp in the system prompt, unsorted JSON, drifting policy text).
- **Bounded context per call:** premise + rolling summary + the last **2** Turns (K = 2,
  tunable constant) — never the whole story. Per-call cost stays flat as stories lengthen.

## 3. Rolling summary maintenance (internal helper, not a consumer)

`Story.summary` (see `domain-model.md`) is the compressed mid-story context inside the bounded
view. Maintained incrementally: after ⚡ TurnAdded, once a story is long enough that the last-2
window plus premise no longer covers it (from ~turn 4), an async call folds the new Turn into
the previous summary — `summarize(previous_summary, new_turn) → summary` (≤ 150 tokens out,
`max_tokens: 256`). Failure is harmless: the summary is simply one turn staler; retry on the
next TurnAdded. Never blocks play.

## 4. The three V1 consumer contracts

### 4.1 `moderateTurn(content) → { verdict: "pass" | "reject", reason? }`

| | |
|---|---|
| **Fires on** | every ▶ SubmitTurn (human **and** AI-authored — see 4.3), before storage; V2: custom Story Element values |
| **Input** | the candidate text (≤ 500 chars). No story context — V1 policy screening is context-free |
| **Prompt** | stable: full Moderation Policy + verdict rules (cached, > 4096 tokens); volatile: the text |
| **Output** | **structured output** (`output_config.format`, `json_schema` `{verdict, reason}`) — guaranteed parseable, no prose to scrape. `reason` is required on reject; it is the player-facing text of the B4 branch. `max_tokens: 128` |
| **Latency budget** | **p95 < 2s** — this call blocks the submit path |
| **Failure** | **fail-closed.** The invariant is "only passed content becomes a Turn" — an unscreened Turn is never stored. SDK auto-retries 429/5xx (2 retries, exponential); on final failure the submit fails into the **B5 branch** (optimistic Section rolls back, draft preserved, retry affordance). Never queue content for later screening |
| **Cost** | ~4–5K input (mostly cache-read) + ~50 out ≈ **$0.001/call** |

### 4.2 `directorHint(bounded_view) → { hint } | null`

| | |
|---|---|
| **Fires on** | timer at ½ Pace-Preset span with no Turn submitted (▶ RequestDirectorHint) — ≤ 1 per stalled turn, never proactive |
| **Input** | the bounded view (premise + rolling summary + last 2 Turns). **Never Voice Parameters** |
| **Output** | one structural hint, 1–2 sentences ≤ 200 chars. `max_tokens: 128` |
| **Latency budget** | soft, 10s — server-side timer job, nothing user-blocking |
| **Failure** | **silent skip, no retry** (`ai-director-spec.md` §6). The escalation ladder continues unaffected |
| **Cost** | ~2K input + ~60 out ≈ **$0.0025/call**, and most turns trigger none |

### 4.3 `fillIn(bounded_view, voice_params, stepped_in_for) → { content }`

| | |
|---|---|
| **Fires on** | ⚡ TurnTimedOut with `pure_human` off (▶ RequestAIFillIn) |
| **Input** | bounded view + the Story's **Voice Parameters** (the open dial-map renders into the voice section of the system prompt — new dials need no re-plumbing) + the player being stepped in for (attribution) |
| **Output** | one Turn: 1–5 sentences, ≤ 500 chars, in the story's voice. `max_tokens: 256` |
| **Moderation** | the generated content **passes through `moderateTurn` like any other Turn** — the "every Turn is screened before storage" invariant stays uniform. (The single merged generate+moderate call from `token-efficiency.md` remains the documented optimization once volume justifies it; V1 ships the uniform two-call path. Note the originally-envisioned moderation+director merge has **no V1 trigger** under the stall-gated model — the two calls never co-occur.) |
| **Latency budget** | soft, 30s — deadline-triggered job |
| **Failure** | must not kill the story: after SDK retries, one app-level regenerate; if still failing (or the output can't pass moderation), **fall back to the stall path** — set `stalled_at` and notify the waiting player (extend / abandon), exactly as pure-human. The Story pauses instead of silently dying |
| **Cost** | ~2.5K input + ~200 out ≈ **$0.0035/call** |

## 5. Cost model (estimates, V1 scale)

A 20-turn story: 20 moderations (~$0.02) + ~16 summary folds (~$0.02) + 0–2 hints + 0–1
fill-in ≈ **$0.05 per story, upper bound** — pennies/day at hundreds of DAU, matching
`tech-stack.md`'s unit-economics claim. Re-baseline with real usage in Phase 3.

## 6. Usage metering — transparency as a feature

Every call records `{story_id, consumer, input_tokens, output_tokens, cache_read_input_tokens,
cache_creation_input_tokens, created_at}` (from the response `usage` block) to an `ai_usage`
table. This powers the user-facing **"AI compute used"** surface — efficiency as a stated
value (`product-story.md`), not an internal metric. Total prompt size per call =
`input_tokens + cache_creation + cache_read`; don't read `input_tokens` alone.

## 7. Operational rules

- **Errors:** use the SDK's typed exceptions, most-specific first (`RateLimitError` → back off;
  `APIStatusError` ≥ 500 / 529 overloaded → SDK retry then consumer failure policy;
  `BadRequestError` → bug, alert, fail per consumer policy). Never string-match error messages.
- **No streaming:** all outputs are ≤ 256 tokens; plain `messages.create` everywhere.
- **No Batch API:** every call is latency-relevant (even "soft" budgets are minutes, not hours).
- **Model pinning:** the alias `claude-haiku-4-5` in config, one constant, one place to change.
- **Never log prompt content with credentials context; never put the API key in prompts.**

## 8. Phase nesting & V2

- **Phase 0 (this doc):** contracts defined. **Phase 3:** layer built + cache-hit integration
  test + `ai_usage` table. **Phases 6 & 7:** consumers wired (moderation at 6; director +
  fill-in at 7, per the SDLC re-sequence — `task-plan-phase-0.md` task 13).
- **V2:** AI Partner (fourth consumer; reads Voice Parameters), reject-and-retry (regenerate a
  fill-in; `Turn.supersedes` lineage already reserved), merged generate+moderate fill-in call,
  custom Story Element value screening.
