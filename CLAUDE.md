# battleapp

## What This Is
Mobile application — React Native (cross-platform), Swift/iOS, or Kotlin/Android with workbench-powered backend

## Development Roadmap
0. Planning & DDD: platform decision, screen inventory, offline strategy, navigation structure
1. Scaffold: project init, navigation wired, API client, runs on simulator
2. Core Schema & State: state management, TypeScript types, local persistence, auth token storage
D. Design: screen-by-screen spec, thumb-zone audit, gesture design, platform conventions
3. Core Screens: all primary screens with loading/empty/error states
4. Auth: secure token storage (not AsyncStorage), biometrics, deep link auth
5. Offline & Sync: network detection, cache, optimistic updates, sync queue
6. Push Notifications: token registration, deep link, permission timing
7. Testing: unit, component, E2E (Maestro or Detox)
8. Polish: performance, accessibility, app icon, privacy manifest
9. Extract: RAG ingest, skill files, platform gotchas
10. QA Gate: physical device test (required — not simulator)
11. Support Audit: crash scenarios, permission denial, OS compatibility
12. Support Automation: in-app help, error messages, playbook
[Milestone A — hand off for store submission]
13. App Store Submission: store listings, release build, review
14. Monitoring Setup: Sentry mobile SDK, crash-free baseline
15. Go Live: stores approved, first real user
[Milestone B — ongoing]
16. Ongoing: crash monitoring, OS updates, store reviews

## Development (Phase 1+)

**Layout:** `app/` (Expo managed workflow, SDK 57, TypeScript strict) · `server/` (Fastify 5 +
PostgreSQL game server, **separate from the workbench mcp-server**) · `compose.yml` (the
portable game stack: game-server + game-db) · canon in `design/` and `docs/`. The authoritative
SDLC record is `docs/product-development/sdlc.md` (AI Service Layer builds at Phase 3; V1 ends
in a **beta launch**, public launch after V2).

**Dev loop:**
- Server (host): `docker compose up --build game-server` at the workspace root →
  http://localhost:4000 (`GET /health` to verify). **Do not run `npm run dev` on the host** —
  `node_modules` is installed by the container (Linux binaries: esbuild etc.), so host-side
  tsx fails with a platform-binary error. The compose build installs its own deps inside the
  image; the container session uses `npm run dev` directly. **The server auto-runs pending
  migrations on startup when `DATABASE_URL` is set** (idempotent), so the compose stack is
  turnkey — no separate migrate step (the prod image has no tsx for the `npm run migrate` CLI,
  which is for host/dev use). In-memory storage when `DATABASE_URL` is unset; Postgres otherwise.
- App: `cd app && npx expo start` (host-side; the container has no simulator). Point a
  simulator or Expo Go at it. `EXPO_PUBLIC_API_URL` sets the server base URL — `localhost:4000`
  for simulators, the dev machine's LAN IP for physical devices (see `app/.env.example`).
- Prod-like stack: `docker compose up` at the workspace root.

**Quality gates (run before staging anything):**
- `cd server && npm run typecheck && npm test` (Vitest)
- `cd app && npm run typecheck && npm test` (Jest + jest-expo)
- CI runs both suites on every push/PR (`.github/workflows/ci.yml`); `main` is protected by
  the `protect-main` ruleset with both checks required.

**Git policy:** Claude stages (`git add`) only — the designer runs `git commit` and `git push`
from the host. Remote: github.com/andrit/battleapp.

**EAS:** profiles in `app/eas.json` (development/preview/production, channels set);
`expo-updates` installed with `runtimeVersion` policy `appVersion`. Builds require the
designer's Expo account (`eas login`, then `eas init` to set the projectId and
`eas update:configure` for the updates URL).

**Task tracking:** every phase has a living task plan at
`.workbench/designer/current/task-plan-phase-{N}.md` — statuses updated in place, dated
progress log at the bottom. Read it at session start; update it as tasks move.

**Engineering conventions:** `docs/engineering/` holds durable how-and-why notes. Read
`docs/engineering/domain-types-mirror.md` before editing `server/src/domain/types.ts` or its
verbatim mirror `app/src/domain/types.ts` — edit both copies in the same change (CI `diff`s them).

## Workbench Integration

This project is registered with the AI Dev Workbench.

### Available Tools
- `/ingest <file>` — add a document to the project knowledgebase
- `/query <question>` — search the knowledgebase and get an answer
- `/status` — knowledgebase stats (documents, chunks, model)
- `/test` — run the project's test suite
- `/remember <key> <value>` — store persistent state
- `/recall <key>` — retrieve persistent state
- `/eval` — evaluate search quality

### Knowledgebase
- Hybrid search: 70% vector similarity + 30% keyword matching
- SHA256 dedup: unchanged files are skipped on re-ingest
- Documents directory: `/workspace/documents/`

### Observability
- Grafana dashboards: http://localhost:3200
- Traces flow through OpenTelemetry → Tempo → Grafana

---
<!-- The Oracle StoryGen — story side-saddle. Added by install.sh. Remove this section and the story/ folder to unmount. -->

# Story Side-Saddle — The Oracle StoryGen

This project carries a **story-exploration rig** alongside its main work. It lives entirely under
**`story/`** and is **self-contained**: it never touches the rest of the repo, and the rest of the repo
never depends on it. Mount it to grow a story, a world, a set of ideas beside the code; unmount by
deleting `story/` and this section.

> **The rig's own docs are the authority.** This section is only the map.
> **Read first when doing story work:** `story/documents/README.md` (the front door). Ways of speech:
> `story/documents/craft/user-manual.md`. Move prompts: `story/documents/craft/interface.md`. Operating
> reference: `story/documents/craft/craft-reference.md`. Formal model (pipeline · materials · tokens ·
> canon, machine-readable): `story/model.json`.
>
> **All rig paths are relative to `story/`.** Where the docs say `documents/craft/…`, `garden/…`,
> `compost-heap/…`, read `story/documents/craft/…`, `story/garden/…`, `story/compost-heap/…`.

## Posture — the rig is companion-first (it overrides this project's default *for story work only*)

Whatever this project's default posture is for its main work, **story work runs companion-first**: the
writer holds the pen. You are a thinking partner — you think together, surface connections, react — and
you do **not** write the story. One exception: a **Boost** is the single scoped moment you take the pen to
turn ideas into one voiced **story block**, then hand it straight back. An **Edit** pass is form-only and
applies nothing without the writer's yes. (This changes nothing about how you work on the project's code.)

## The moves (full detail in the rig docs)

- **Three vectors — name which you're in:** **Ponder** (generate; incl. **Collide** two tokens →
  metaphor), **Bridge** (connect, find gaps), **Render** (structure faithfully, no invention; a mature
  garden cluster → a thread).
- **The lens:** the **story** is what the viewer's lens witnesses; **Act Zero** is the seed outside it.
- **The pipeline (directory = how PROCESSED, not what about):** `story/compost-heap/` (raw, frozen) →
  `story/garden/` (the living graph of linked notes) → `story/documents/story/` (canon) → a **story block**
  carried out to the manuscript (external, yours).
- **WIP — optional, orthogonal to the pipeline:** `story/wip/` may hold a draft of the *actual* piece the
  writer shares in to be worked against — not the manuscript, not a pipeline stage, never presumed in sync.
  Never edit a WIP in place: propose edits in a `story/wip/<wip>-machinima.md` sidecar (locations mapped in
  its front-matter). Fully optional — the folder may stay empty.
- **Boost:** on request, one voiced story block, then the pen's back. Say **"menu"** to open the console.

## Non-negotiables

- **Never touch the manuscript** — it's external and the writer's; the rig persists only ideas, blocks, an
  optional shared WIP, and derived data.
- **A WIP is not the manuscript** — it's a copy the writer pushes in (optional, possibly stale, never synced
  either way). Never edit it in place; propose edits in a `story/wip/<wip>-machinima.md` sidecar.
- **`story/compost-heap/` is frozen** — never edit a dump; react in a `<source>-machinima.md` sidecar.
- **Never silently plant or overwrite** — plant garden notes only as a move's output or on request, tag
  `author:`, never overwrite a writer-authored note (propose side-by-side; they accept).
- **Keep the rig in its lane** — `story/` is sealed off from the project's build, tests, and code.
