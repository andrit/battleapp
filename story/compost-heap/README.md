# Compost Heap — ① raw intake (frozen)

This is zone ① of the pipeline: **raw dumps, exactly as written.** The directory maps to how
*processed* an idea is, not what it's about.

## Rules

- **Frozen / append-only — never edited.** A dump is a historical artifact. Everything downstream
  traces its lineage back here (`grew-from` in garden notes), so it must not change under them.
- **Dump freely.** Fragments, images, premises, "what ifs", whole brain-spills. One file per dump:
  `<N>-<slug>.md`, numbered in order (e.g. `1-first-ideas.md`).
- **React in a sidecar, never in the dump.** A rig-run reaction to a frozen source lives beside it
  as `<source>-machinima.md` (e.g. `1-first-ideas-machinima.md`). The machinima file is a single
  *living* doc with a `## Changelog`; before any major restructure it's snapshotted into `archive/`
  first, so no prior version — and no authorNote — is ever lost.
- **The writer's inline notes inside a machinima file are authorNotes** — written in *italics* with
  a `*n` marker. They are the writer's, folded into the next revision, never overwritten.

## Flow

`compost-heap/` (raw) → `garden/` (cultivated into linked notes) → `documents/story/` (canon) →
a **story block** carried out to the manuscript (external). See `documents/README.md`.

_(empty until the first dump.)_
