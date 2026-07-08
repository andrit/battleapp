# BattleApp — Tech Stack & Foundational Decisions

**Phase 0 deliverable · written 2026-07-03**

The "chosen with rationale, not deferred" decisions the Phase 0 advance criteria require.
Each is expensive to reverse after Phase 1, so each has a rationale and an explicit V1/V2
boundary.

## Platform — React Native + Expo (managed workflow)

**Decision:** React Native with Expo, **managed workflow**.

**Rationale:** BattleApp's behavior is mobile-native — async turns, push notifications when
it's your move, bite-sized interactions (write one paragraph), a social feed of stories.
That's the Words with Friends pattern, and it seals the platform choice. Expo managed gives
us EAS Build/Update (OTA JS fixes without App Store review), `expo-notifications`, and a fast
dev loop. The **managed workflow is confirmed** because V1 needs no native module that forces
ejection — the only device capability is push notifications (see `device-apis.md`).

**Rejected:** SwiftUI (iOS-only) and Kotlin/Compose (Android-only) — the audience spans both
platforms and a single codebase is worth more than per-platform native polish at V1.

**Reversal cost:** high. The managed-vs-bare decision especially — revisit only if a future
feature demands a native module Expo can't provide.

## Backend — dedicated Fastify + PostgreSQL game server

**Decision:** A **separate** game server (Fastify + PostgreSQL), **not** the workbench
mcp-server.

**Rationale:** This app needs a game state machine, consumer auth for a public audience, and
throughput for many concurrent stories — plus (V2) real-time co-writing over WebSockets/SSE.
The workbench (its RAG, memory, and conversation tooling) is a **build-time development
environment** for designing and building this app — **not a runtime dependency**. The running
game never calls the workbench; at runtime the dedicated backend's AI Service Layer is the only
Anthropic client. A purpose-built Fastify + Postgres backend keeps game state, auth, and the AI
Service Layer under one roof we control.

**Shape (from the SDLC):** REST for story CRUD + turn submission, WebSocket `/ws/stories/:id`
for live spectator/co-player updates. Aggregates map to tables: Story, Turn, Reaction, Player
(see `domain-model.md`).

## AI — direct Anthropic API, `claude-haiku-4-5`

**Decision:** Direct Anthropic API (`api.anthropic.com`), model **`claude-haiku-4-5`**, one
API key held by the backend. Users never need an Anthropic account.

**Rationale:** Standard B2C SaaS — the backend calls one vendor on behalf of whoever is
playing, cost folded into unit economics (like calling Stripe or Google Maps). Haiku is fast
(< 2s hints), cheap, and materially better at narrative reasoning than a small open model —
which matters because hint quality determines whether the feature feels valuable. At V1 scale
(hundreds of DAU) the cost is pennies/day; the AI line item is invisible until tens of
thousands of DAU.

**V1 consumers (all via one AI Service Layer — see `ai-service-layer.md`):** Moderation,
AI Director hints, AI Fill-in.

**Scale path (not V1):** at ~$500+/month, evaluate Groq + Llama 3.1 8B as a drop-in for the
hint/fill-in endpoints; a custom fine-tuned model only makes sense at 50K+ DAU with collected
`(story, good hint)` training pairs. Bedrock/Vertex only if the infra goes AWS/GCP-native.

## AI token efficiency & restraint

A first-class concern, not an afterthought — it lowers cost, reduces environmental impact, and
is a **user-facing value** (see `product-story.md`). Detail lives in `ai-service-layer.md`; the
strategy:

- **Prompt caching** — cache the stable prefix (system prompt: narrative rules + moderation
  policy + voice framing + story premise); volatile new turn last. The moderation system prompt
  is identical across all users/turns, so cache-hit rates are high.
- **Merge moderation + director** into a single call when a turn view needs both.
- **Stall-gated director hints** — a hint is generated only if the turn timer reaches a
  configurable fraction of the Pace Preset span (default ½) with no Turn submitted; a player who
  submits in time triggers no call, and dismissing generates none. This caps director calls at
  one per stalled turn.
- **Bounded context per call** — send premise + a rolling summary + the last **2 turns** (the
  most recent Turn and the one it replied to; `K` is a tunable constant, default 2), never the
  whole growing story, so per-call cost stays flat as a story lengthens.
- **No always-on conversation** — the story lives in the DB (the state store); each call builds a
  fresh minimal prompt from it. `claude-haiku-4-5` keeps each call cheap.
- **Transparency** — surface "AI compute used" so restraint is visible, not hidden.

## Analytics — PostHog

**Decision:** **PostHog** for product analytics.

**Rationale:** Generous free tier, self-host option if data residency ever matters, event +
funnel analysis, and optional session replay — a good fit for understanding the core loop
(do people start stories, take turns, come back?). Instrumented from Phase 3.

**V1 events:** `story_started`, `turn_submitted`, `story_completed`, `director_hint_viewed`,
`director_hint_dismissed` (plus invite/report/block events as those flows land).

**Rejected for V1:** Mixpanel / Amplitude (fine, but no self-host); Firebase Analytics (ties
us to the Google stack we're otherwise not using).

## Offline strategy — explicit

**Decision:** Graceful degradation, not offline-first. Concretely (built across Phases 2 & 5):

- **Story list** cached in `AsyncStorage` — visible read-only when offline (never a blank
  screen).
- **Draft autosave** — the in-progress Turn is written to `AsyncStorage` on keystroke and
  restored if the app is closed mid-turn.
- **Queued submit** — a Turn submitted while offline is queued and sent on reconnect, with a
  "Draft saved" indicator and no duplicate turns.
- **Completed stories** cached in full once viewed — readable offline.
- **Auth token** in `expo-secure-store` (never `AsyncStorage`).

**Rationale:** The game is inherently online (turns must reach the other player and the
moderation/AI services), so full offline authoring isn't meaningful. What matters is that the
app never feels broken on a flaky connection and never loses a draft.

## Client state (foreshadowing Phase 2)

Zustand for app state (`useStoryStore`, `useAuthStore`, `useStoriesStore`); React Query for
server state (story fetch, turn list, reactions) with optimistic turn submission. Listed here
for stack completeness; detailed in `domain-model.md` and Phase 2. **Confirmed V1** (designer,
2026-07-08) — not deferred to V2.

## Caching & horizontal scale — explicit

**Decision (2026-07-08):** **No cache, no Valkey in V1.** The game is async and turn-based —
Postgres has no read path it can't serve at V1 scale, and V1 runs a **single game-server
instance**. The WebSocket notify layer is built behind a small interface; **V2 adds Valkey** as
the pub/sub bus when the server goes multi-instance — the seam exists now, the dependency
doesn't. **GraphQL considered and declined:** one first-party client, a fixed screen set, fully
enumerated access patterns; REST + WebSocket stays, with React Query providing client-side
server-state control.

## Production hosting & portability — explicit

**Requirement (designer, 2026-07-08): the entire game and all dependencies must lift onto any
production host.** The deployment artifact is the project's own compose stack (game server +
Postgres; + Valkey in V2) behind a reverse proxy with TLS, on a single container host / VPS —
provider chosen at the Go Live phase, nothing earlier depends on it. Postgres stays **inside
the compose stack** (with pg_dump backup discipline) to preserve pick-up-and-move; managed
Postgres is re-evaluated at public launch (post-V2). Development runs the same stack in the
workbench container. Release model: V1 SDLC ends in a **beta launch**; public launch follows V2
(`docs/product-development/sdlc.md`).

## Summary table

| Concern | V1 choice | Reversal cost |
|---------|-----------|---------------|
| Platform | React Native + Expo (managed) | High |
| Backend | Dedicated Fastify + PostgreSQL | High |
| AI | Anthropic direct, `claude-haiku-4-5` | Low (swap behind AI Service Layer) |
| Analytics | PostHog | Low |
| Offline | Degrade gracefully + draft autosave + queued submit | Medium |
| Auth storage | `expo-secure-store` | Low |
| Cache / scale | None in V1 (single instance); Valkey pub/sub in V2 | Low (seam built in V1) |
| Hosting | Portable compose stack → single container host at Go Live | Low (that's the point) |
