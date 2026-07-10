# Client-State UX Features & History Search

**Written:** 2026-07-10 · **Status:** captured (Phase 3 committed + Phase 9 + V2) · **Origin:**
designer ⇄ Claude, Phase 2 task 5 — the realization that the product's intentional simplicity
leaves room for cheap **client-side** depth (pure UI state, no backend) that adds perceived
depth without violating the lean-backend MVP.

## The principle

Because V1 is deliberately simple (two players, text in/out), a large amount of "feel" can be
added as **client-only state** — filters, sort, reading prefs — at near-zero cost: no schema, no
API, no moderation surface. These are cheap *because* the design is simple. The discipline
(kano.md, "ruthlessly small MVP") still applies — so most are captured for later, but a couple
are committed to Phase 3 as necessary usability ("meat on the bones").

## The persistence mechanism (shared)

Client UI preferences should survive app restarts → a **persisted preferences store**: Zustand
backed by **AsyncStorage** (the non-secret client cache `tech-stack.md` blesses; the token stays
in SecureStore, never here). This is the *same* persistence layer task 6 builds for the offline
story cache — one pattern, two kinds of content (offline data + UI prefs). Home: a
`usePreferencesStore` (this is the legitimate **client** job the pre-React-Query `useStoriesStore`
sketch was reaching for — filters/sort/prefs, NOT server data).

## Phase 3 — committed deliverables (built when the list & story screens are)

- **Stories list filter** — your-turn / active / completed. Makes a growing list usable.
- **Stories list sort** — recently active / longest-waiting / alphabetical.
- **Reading controls** on the story scroll — font size and serif reading comfort. Punches above
  its weight: serif reading *is* the product's texture, so letting a reader bump the size is a
  real quality-of-life win (and an accessibility win).

These operate over the React Query cache (client-side); sort/filter/reading prefs persist via
`usePreferencesStore`.

## Phase 9 — polish delighters

- **Reading-position memory** — reopen a story, land where you left off (a scroll offset per
  story in the store). Feels premium, costs almost nothing.
- **Per-story pin / mute** on the list.
- **Theme** (light/dark), **reduced-motion**, **haptics** toggles.
- **Compose focus mode** — hide the chrome while writing a turn.

## V2 — History search (server-side; a retention delighter)

**The scenario:** two players who've played a lot — *"remember that story with the Dragon named
Bob? What was it called? Where was it set? …let's search the history."* Finding an old story by
the **content people wrote** in it.

**Which side:** **server**, decisively. Two different searches hide in "search stories":
1. *Client* list-filter by title/participant over the already-loaded list — this is the Phase 3
   filter above (shallow; React Query cache).
2. *Server* full-text search over **turn content** across many stories — the data isn't on the
   device (hundreds of stories, thousands of turns), so it can't be client-side.

**Mechanism:** **Postgres full-text search** — a `tsvector` over `turns.content` (+ story title),
a **GIN index**, `tsquery` ranking. Native to pg16; no new service. A `GET /search?q=` server
endpoint over the searcher's own stories (participant-scoped); a thin search-box + results UI.

**Schema-extension candidate (designed-for, not built):** add a generated `tsvector` column +
GIN index on `turns` when the feature is built — or pre-add it now for a migration-free V2 drop
(cf. the `supersedes`/`summary` designed-for extensions in `domain-model.md`). Not added in
Phase 2; flagged here.

**V2 flourish:** semantic search (pgvector, "the betrayal story" with no literal word match) —
the workbench's own hybrid RAG (pgvector + keyword) is the exact pattern, but overkill for V1;
keyword FTS first, semantic later if it earns its place.

## Cross-references

`kano.md` (delighter tier + V2) · `docs/product-development/sdlc.md` (Phase 3 / Phase 9 scope) ·
`domain-model.md` (extensibility — the FTS index candidate) · `tech-stack.md` (Zustand client
state / AsyncStorage cache split) · task 6 (shared AsyncStorage persistence pattern).
