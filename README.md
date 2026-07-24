# battleapp

**Build a story with a friend, one line at a time.** A collaborative storytelling mobile game: two
authors take turns writing a story a line at a time, and the fun is the surprise of what your partner
writes next. An AI *director* nudges quietly when someone stalls — but never writes the story for
you. Restraint is the point: **no AI slop.**

> Status: in active development (SDLC phase 5 of 19 — Auth). V1 ships as a beta; public launch
> follows V2. Not yet released.

## Layout

This is a monorepo with two apps plus its design canon:

| Path | What |
|---|---|
| **`app/`** | The mobile client — Expo managed workflow (SDK 57), React Native, TypeScript strict. See [`app/README.md`](app/README.md) to run it. |
| **`server/`** | The game server — Fastify 5 + PostgreSQL (stories, turns, auth, the AI service layer). |
| **`compose.yml`** | The portable game stack (game-server + game-db) for local dev / prod-like runs. |
| **`design/`, `docs/`** | Product + engineering canon (domain model, wireframes, design tokens, decisions). The SDLC record is [`docs/product-development/sdlc.md`](docs/product-development/sdlc.md). |

## Quick start

**1. Backend** (from the repo root):

```bash
docker compose up --build game-server      # → http://localhost:4000
curl -s localhost:4000/health              # {"status":"ok",...}
```

The server auto-runs migrations on startup and uses Postgres from the compose stack (in-memory
storage when `DATABASE_URL` is unset).

**2. App** — it's a mobile app (iOS/Android simulator or a phone via Expo Go), run from your host
machine. Full steps in **[`app/README.md`](app/README.md)**:

```bash
cd app && npx expo start                   # then press i / a, or scan the QR in Expo Go
```

## Quality gates

Both suites must pass before anything is staged; CI runs them on every push/PR and `main` is
protected.

```bash
cd server && npm run typecheck && npm test   # Fastify + Vitest
cd app    && npm run typecheck && npm test    # Expo + Jest (jest-expo)
```

## Tech stack

- **Client:** Expo/React Native, React Query (server state), Zustand (client state), Reanimated,
  FlashList, `expo-secure-store` for tokens.
- **Server:** Fastify 5, PostgreSQL, WebSockets for live turns, `jose` for OIDC auth, the Anthropic
  API for the AI service layer (moderation + stall-gated director hints).
- **Auth:** OAuth 2.0 / OIDC social logins (Apple + Google), with server-issued access + refresh
  tokens.

Built with the AI Dev Workbench.
