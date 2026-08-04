# Decision — Multi-author forward-compatibility (turn-gated, N-ready; free-for-all deferred)

**Status:** decided (forward-compat guardrail) · **Date:** 2026-08-04 · **Raised during:** Phase 6
(Offline & Sync) scoping, exploring whether stories could have **more than two** authors.

## Decision

V1+ stays **turn-gated** — exactly one participant (`current_author_id`) holds the write at any moment.
The model is designed to generalise **2 → N authors** via **round-robin** (turn order = join order),
**not** toward a free-for-all. Turn-gating is the invariant that keeps offline/sync simple, so we
preserve it and treat "many authors" as a round-robin extension, and "free-for-all" as a separate
major initiative that is explicitly **out of scope** for the foreseeable roadmap.

## Why this is cheap: the data model is already N-ary-ready

Nothing structural assumes two. Only a few *logic* spots do:

| Concern | State today | Change for N (round-robin) |
|---|---|---|
| Participants | `participants` is an **array** (`domain/types.ts`) | none |
| Whose turn | `current_author_id: string \| null` (single id) | none — round-robin just picks the next id |
| Turn attribution | each turn carries `author_id` | none |
| Set active author | `setActiveAuthor(storyId, authorId)` takes any id | none |
| **Turn advance** | `server.ts:223` hands to **"the OTHER participant"** (binary) | round-robin to the **next** participant in order |
| **Join cap** | `participants.length >= 2 → 'full'` (`repos/memory.ts`, `repos/pg.ts`) | cap of N (or configurable / unbounded) |
| **Author UI** | binary A/B colour (`authorSlot`), "You/Partner" labels, singular `partnerLabel` (`StoryScreen.tsx`) | N-colour palette by participant + real **@handles** |

The UI change **aligns with an already-deferred direction** (display-name enrichment replacing
"Partner" with real @handles) — multi-author extends that work rather than fighting it. A turn *order*
policy is the one genuinely new product decision (default: **join order**; alternatives: creator-set
order, or "pass to @x").

## Why NOT free-for-all (drop the turn-lock)

Free-for-all (any participant appends anytime) is a **product model change** — from turn-based game to
live collaborative document — and its entire cost is the ordering/conflict problem that turn-gating
gives us for free:

- **Ordering:** concurrent appends need a total order everyone agrees on — server-assigned-on-arrival
  (min), logical clocks for meaningful offline placement, or a sequence-CRDT/OT if existing lines can
  be edited.
- **Conflicts (the deferred C1, now mandatory):** offline-authored lines racing online writes must be
  *placed*, not just accepted — the merge machinery turn-gating let us skip.
- **Offline queue flips:** from **one rejectable** pending write ("not your turn") to **many
  always-accepted** writes needing placement — the harder problem.
- **Realtime heavier:** presence / "@x is writing" / live inserts vs discrete `TurnAdded` events.
- **AI director loses its trigger:** "AI steps in when the current author stalls" has no meaning
  without a current author — needs a new contribution model.
- **Model/UI fallout:** `current_author_id` becomes meaningless; the "Your turn"/waiting affordances
  disappear; sequence numbers may need fractional indexing.

**Middle paths** (if more freedom is wanted without the full bill, each keeps single-writer-at-a-time
so sync stays simple): **branches / parallel threads** (each thread turn-gated), or the **designated-
leader / claim mode** specified below (next writer chosen dynamically, but still one at a time).

If free-for-all is ever pursued, it must be its own initiative opening with an explicit
**ordering/conflict strategy** decision (server-order vs logical clocks vs CRDT) — never an
incidental toggle.

## The sanctioned bridge — Designated-leader / claim mode

Between round-robin and free-for-all sits a mode that keeps everything simple while adding
competitive, chaotic fun: **the next writer is chosen dynamically, but there is still exactly one
writer at a time.** The "leader" (pen-holder) is designated by who **claims** the open slot
("Write next") or by a **queue**, arbitrated by the server. Single-writer is preserved, so the
offline/sync design and the turn-taking core are unchanged — only the *advance policy* differs.

**Modes (a Settings-Handshake option, `turn_mode`):**
- `round_robin` (default) — on submit, advance to the next participant in join order.
- `claim` — on submit, the slot **opens** (`current_author_id = null`, token++); the server grants the
  **first valid claim** ("grab the pen").
- `queue` — claimants line up; the server pops the queue in order ("writing: @a · next: you, @c").
- Optional **pass-to-@x** (deliberate handoff) and **auto-release on stall** (reuse the existing
  AI-director stall / `stalled_at` → reopen the slot or let the AI step in).

**RAFT, borrowed selectively.** We take the useful ideas — one leader at a time, a **lease/timeout**
(the turn timer), **leader-failure → re-elect** (a stall reopens the slot), and a monotonic **term**
(the turn **token/epoch**). We skip consensus / quorum / voting: with a central server there is no
election to hold — a claim is a single **atomic conditional update**
(`SET current_author_id = :claimer WHERE current_author_id IS NULL AND turn_token = :epoch`), and the
DB arbitrates the race. First valid claim wins.

**The token is the same primitive Offline & Sync needs.** A turn written offline is accepted on
reconnect iff its token still matches (the writer still holds the pen), rejected otherwise — the exact
"key the write to the turn-state" guardrail below. **Offline-rejection epoch == claim epoch.** Claiming
is inherently online (a server race); *writing* while holding the pen may be offline and synced. So
single-writer + server-arbitration keep the whole sync story trivial — no CRDT, no ordering machinery.

**Fairness (anti-hog) rule.** Claim mode invites a fast player hogging the pen. Rule:
- **No three-in-a-row, ever** — a participant may never author three consecutive turns.
- **Double cooldown** — after taking a **double** (two consecutive turns), a participant may not take
  another double until **every other participant has authored ≥1 turn since that double** *and* **at
  least one further turn has occurred beyond the turn that satisfied that condition**.
- **Single** (non-consecutive) turns are always allowed, subject to no-three-in-a-row.

Enforced server-side at claim time as `canClaim(A)`:
- if the last two turns are both `A` → **deny** (would be a triple);
- else if the previous turn is `A` (this claim would complete a double) **and** `A` is in double-
  cooldown → **deny**;
- else **allow**; if the granted turn completes a double, `A` enters cooldown, which clears at
  `allOthersWentSince(double) + 1` turns.

*Example (A, B, C, D):* A authors turns 5–6 (a double) → A enters cooldown. Others go B=7, C=8, D=9
("all others went" satisfied at 9) → **+1 turn** (turn 10, by anyone) → cooldown clears; A may double
again from turn 11. Throughout, A may still take *single* turns — only a **second back-to-back** is
gated. *(Open edge: with dynamic joins, "every other participant" = the participant set snapshot at
the double; late joiners don't reset an in-flight cooldown.)*

**Cost — all additive; the core is untouched:** a `claim` endpoint (atomic lock), the turn
`token`/epoch, a lease/timeout, an optional `queue`, the `turn_mode` setting, and claim/queue UI. The
single-`current_author_id` append / attribute / advance core and the offline design stay as-is. This
is the **sanctioned bridge**: it delivers dynamic, competitive turn-selection with **single-writer
preserved, server-arbitrated, no CRDT** — everything heavier (true concurrent writes) remains the
free-for-all initiative above.

## Phase 6 (Offline & Sync) guardrails — free forward-compat

The offline design is agnostic to author *count* as long as the model stays turn-gated. To keep it
that way at no cost:

- **Key each queued turn to the turn-state it was written against** (story + expected sequence /
  whose-turn), so the server can **reject cleanly if the turn moved on**. This protects 2- and
  N-author turn-gated models *identically*.
- **Phrase rejection copy generally** — "it's no longer your turn / the story moved on" — not "your
  partner took the turn."

These are already the intended shape of the Phase 6 write-queue work; this note just records why.
