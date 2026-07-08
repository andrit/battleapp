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
  image; the container session uses `npm run dev` directly. In-memory storage in Phase 1;
  Postgres arrives with the Phase 2 schema.
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
