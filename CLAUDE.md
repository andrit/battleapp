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
