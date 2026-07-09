# Domain Types: the Mirror and the Drift Check

**Written:** 2026-07-09 (Phase 2, Task 1) · **Applies to:** `server/src/domain/types.ts` ↔
`app/src/domain/types.ts`

A plain-words reference for a convention that's easy to forget and easy to get wrong. Read this
before editing either domain-types file.

## The setup

BattleApp is two separate codebases in one repo: the phone **app** (`app/`) and the game
**server** (`server/`). They build and ship independently, each with its own dependencies. But
they must **agree on the shape of the data** that flows between them — what a `Story` is, what
fields a `Turn` has, which states a story can be in. That agreement is written down as the
domain-types file.

## The mirror — what it is

Normally shared definitions live in **one** package both sides import from (a single source of
truth). We deliberately did **not** do that yet. Instead there are **two byte-for-byte identical
copies** of the same file:

- `server/src/domain/types.ts` — **canonical** (the "real" one)
- `app/src/domain/types.ts` — a **verbatim mirror** (an exact duplicate)

Like a contract where each party keeps an identical signed copy in their own cabinet.

**Why a mirror instead of a shared package:** setting up a shared package across these two roots
tangles with Expo/Metro module resolution and the bind-mount platform issues we've already been
bitten by. The mirror is the simplest thing that works across two package roots. The types file
is deliberately **import-free**, which is what lets a single file be copied verbatim and compile
cleanly under both tsconfigs.

## Drift — the risk

Two copies means someone can edit one and forget the other. Add a field to the server's `Story`
but miss the app's copy, and the two now disagree — the server sends a field the app doesn't
know about, or the app expects something the server never provides. Nothing complains at the
time (each side is internally consistent and typechecks fine); it surfaces later as a confusing
runtime bug. That silent divergence is **drift**.

## The drift check — the guard

A CI job (`.github/workflows/ci.yml` → `domain-types-drift`) runs on every push and PR. It does
one thing: `diff` the two files. Identical → passes silently. Different by even one character →
**fails the build** and prints the fix (`cp server/src/domain/types.ts app/src/domain/types.ts
&& recommit`). A smoke alarm for the copies falling out of sync — caught at push, not weeks
later at runtime.

## The discipline — because the alarm has a blind spot

The CI check only fires **at push**. Mid-session you can edit one copy, typecheck locally, and
everything looks green against the stale twin — the alarm doesn't ring until you push. So the
real rule, which the check backstops rather than replaces:

> **Edit both copies in the same change. Never "later."** Server is canonical: change it, then
> immediately `cp server/src/domain/types.ts app/src/domain/types.ts`.

(Once the root `typecheck` proxy lands — deferred half of Phase 2 Task 8 — the diff can also run
locally, moving the check to before-push. Until then it's discipline + CI.)

## When this arrangement ends

The mirror is temporary by design. Switch to a proper shared package (npm workspaces) and delete
both the duplication and this check when **either** happens:

1. A **third consumer** of these types appears (e.g. a web client or admin tool), or
2. A **second real drift incident** occurs.

Whichever comes first. One copy going stale once is a mistake; twice is a pattern that has
outgrown the mirror.

## Deploy note

The mirror has **zero** effect on how we ship. TypeScript types erase at compile; each artifact
(server image, app bundle) builds self-contained from its own copy. The mirror is a
development-time concern only.
