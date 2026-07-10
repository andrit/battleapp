# BattleApp — SDLC Record (canonical)

**Phase 0 deliverable (task 13, re-sequence) · written 2026-07-07**

The authoritative phase sequence for battleapp, following the `mobile` project type. This
record **supersedes the phase plan in `newprojects/battleapp/reaction-and-plan.md`** (historical
scratch) wherever the two differ; that file's per-phase deliverable details remain valid except
as amended below. Nothing releases at a phase boundary.

**Release model (designer decision, 2026-07-08):** the release at the end of the V1 SDLC is a
**beta launch — beta testers only** (TestFlight / Play internal track). **Public launch gates on
V2**, because going public requires handling multiple accounts with paid user profiles — which
arrives with the V2 items: **Stripe** (paid accounts / Pro tier) and **Valkey** (pub/sub for
multi-instance WebSocket fan-out). React Query is **not** V2 — it stays in V1 Phase 2 as the
client data layer.

## The corrected MVP definition

The original MVP paragraph said "No genres, no AI, no roguelike seeds." **The "no AI" clause is
wrong and is corrected as follows** (per `game-mechanics.md` §0):

> V1 is an **AI app**: three AI mechanics ship in V1, all through one AI Service Layer —
> **Moderation** (every Turn), the **AI Director** (stall-gated hints), and **AI Fill-in**
> (attributed safety-net on a timeout). The AI is a restrained helper, never the author; the
> fill-in is the one named carve-out, and Pure-Human Mode disables it. What stays out of V1 is
> the **AI Partner play mode**. "No genres, no roguelike seeds" still stands.

## Phase sequence

| Phase | Name | AI-nesting note |
|-------|------|-----------------|
| 0 | Planning & DDD | AI Service Layer **defined** (`design/ai-service-layer.md`, `design/ai-director-spec.md`) |
| 1 | Scaffold | — |
| 2 | Core Schema & State | Schema per `design/domain-model.md` — includes `settings_confirmed_at`, `summary`, `voice`, `supersedes`, `stalled_at` |
| D | Design | AI-authored Sections need their distinct attributed visual treatment |
| 3 | Core Game Screen | **AI Service Layer built here** (see amendment below). Also: committed client-state UX — stories list filter/sort + reading controls (`design/client-state-features.md`) |
| 4 | Auth & Invitations | Gains the **Settings Handshake** surfaces (creator propose sheet, invitee confirm view) — `event-storm.md` decision #7 |
| 5 | Offline & Drafts | B1/B2/B5 branches from `design/task-flow.md` |
| 6 | Push Notifications & Turn Timer | **Consumes the layer**: fill-in warning push, **AI Fill-in**, stall path; rolling-summary maintenance wired here (first bounded-view consumer) |
| 7 | **AI Director — hints on the existing layer** | **Consumes the layer** (see amendment below) |
| 8 | Testing | Includes the cache-hit integration test (`ai-service-layer.md` §2) |
| 9 | Polish | Kano Performance tier is the priority list (`design/kano.md`). Client-state delighters: reading-position memory, pin/mute, theme/reduced-motion/haptics, focus mode (`design/client-state-features.md`) |
| 10 | Extract | — |
| 11 | QA Gate | — |
| 12–16 | Support Audit, Support Automation, App Store, Monitoring, Go Live | App Store: Moderation Policy doc doubles as the UGC policy (still unwritten — tracked). **Go Live = beta launch** (beta testers only); the public store launch happens after V2 |
| 17 | Ongoing | — |

## The re-sequence (why Phase 3, not Phase 7)

Moderation (Phase 3), AI Fill-in (Phase 6), and Director hints (Phase 7) all depend on one
thing: the AI Service Layer. In the original plan that layer first appeared at Phase 7 — so
Phase 3's turn-submission path would have been built without moderation and retrofitted later,
touching the single most important code path twice. **Several V1 features share one dependency,
so it is built once, at the earliest phase that needs it: Phase 3.**

### Phase 3 amendment — first build of the layer

- Minimal Anthropic client (`claude-haiku-4-5`) + the three contracts scaffolded
- `moderateTurn()` wired into the turn-submission path **from the start** — no retrofit
- `ai_usage` metering table (powers "AI compute used")
- Prompt-cache verification test specified (asserts `cache_read_input_tokens > 0`; Haiku's
  4096-token minimum cacheable prefix — `ai-service-layer.md` §2)

### Phase 6 amendment — timer consumers + the full push set

- Turn timer + escalation ladder; ⚡ FillInWarningIssued push; **AI Fill-in** (attributed,
  voice-aware, moderated like any Turn, stall-fallback on persistent failure); pure-human
  stall path (extend / abandon / secondary timeout)
- Notification set is now **seven entry points** (not the original four): your turn, reaction
  (batched), invite, **settings to confirm**, story complete, fill-in warning, **story stalled**
  — routing table in `design/user-flow.md` §5

### Phase 7 amendment — Director on an existing layer

Phase 7 stops being *the first appearance of AI* and becomes *the director-hint feature layered
on a service layer that already exists.* The original Phase 7 spec (hint on game-screen mount,
whole-story context, per-turn hint caching, < 2s on mount) is **superseded by
`design/ai-director-spec.md`**: hints are **stall-gated** (½ Pace-Preset span, one per stalled
turn, dismissible), read the **bounded view** (premise + rolling summary + last 2 turns), and
fail silently. Phase 7 delivers the hint card UI, the timer-job trigger, and the
`directorHint` consumer wiring — the client, prompt assembly, and metering already exist.

## Advance criteria

Per-phase advance criteria in `reaction-and-plan.md` remain in force **except Phase 7's**,
which are superseded by the behavior in `ai-director-spec.md` (stall-gated trigger replaces
"hint appears within 2 seconds of game screen mounting").
