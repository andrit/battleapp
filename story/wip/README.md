# WIP — the optional shared draft (orthogonal to the pipeline)

Status: optional · may be empty · not a pipeline stage

This lane holds a **WIP (Work in Progress)**: *your currently-shared draft of the actual piece* — the
one material in the rig that is a piece of the real writing rather than ideas about it. It exists so the
moves have something concrete to work *against* (Bridge a gap in it, Render a cluster toward it, Boost a
block that slots into it). It is the **formal model's** third material (`wip` in `../model.json`).

**What it is not.** It is **not the manuscript.** The manuscript is external and yours, and the rig never
touches it (see `../model.json` → `non_negotiable`). The WIP is a copy **you push in**, voluntarily; the
rig never reaches out and pulls your draft.

## The four things to know

1. **Optional.** The rig works fully with no WIP ever shared. This folder may stay empty forever. Nothing
   presumes it exists.
2. **Possibly stale.** It is **never presumed in sync** with your external / offline version. It is a
   snapshot as of when you last dropped it in — `shared_at` says when.
3. **Phase-agnostic.** It is **not** a stage in `compost → garden → canon`. It sits beside the pipeline,
   not inside it. There is no presumption about how developed the piece is.
4. **One-way, by hand, both ways.** You carry the draft *in* (drop a file here); you carry accepted edits
   *out* to the real manuscript yourself. The rig never syncs either direction automatically.

## How to share one

Drop a markdown file in here — `the-piece.md`, or several files if the piece has parts. Give it the WIP
header so its status is self-describing:

```markdown
---
kind: wip
shared_at: 2026-10-30        # when you dropped this snapshot in
authoritative: false         # the external manuscript is the source of truth
in_sync: unknown             # never presumed current with your offline copy
covers: "the slice you shared — a scene, a chapter, the whole piece"
pipeline_stage: n/a          # orthogonal to compost → garden → canon
---

<your draft text>
```

## How the rig proposes edits — the `-machinima` sidecar

The rig **never edits a WIP in place** (same discipline as a frozen compost dump: react beside it, never
over it). When you ask for edits, it writes a sibling **`<wip>-machinima.md`** — a readable copy of the
WIP with the proposed changes applied inline, plus front-matter that **maps each edit to its location in
the original WIP** so you can review precisely and apply by hand:

```markdown
---
kind: wip-machinima
of: the-piece.md             # the WIP this reacts to
cut_against: 2026-10-30      # the WIP snapshot's shared_at — staleness honesty
edits:
  - at: "quoted original span or a section heading"   # anchor; robust to later line-drift
    line_hint: 45-52                                   # advisory, relative to the WIP as cut
    kind: replace            # replace | insert | delete
    why: "one line on the reason"
  - at: "…"
    kind: insert
    why: "…"
---

<the WIP text, carried over with the proposed edits applied inline>
```

- The **body** reads as a clean edited version; the **`edits` map** is the index of what changed and where.
- Accepting an edit means *you* apply it — to the WIP and/or to your external manuscript. Nothing crosses
  out on its own.
- Superseded machinima versions are moved to `archive/` (never overwritten — version, don't destroy).

*This lane is a servant like the rest of the rig. Empty is a perfectly good state for it to be in.*
