# Decision: Settings-Handshake fields are nullable, per-field by whether a safe default exists

**Decided:** 2026-07-09 (Phase 2) · **Status:** accepted · **Scope:** `stories` schema +
`Story` domain type

## Decision

The four fields set in the **Settings Handshake** are modeled **field-by-field**, according to
whether a *meaningful, safe* default exists — not uniformly:

| Field | Model | Why |
|-------|-------|-----|
| `turn_limit` | **nullable** (null in lobby, set at handshake) | No canonical default exists ("e.g. 10 or 20" are examples, not a default) — any default would be invented. |
| `pace_preset` | **nullable** (null in lobby, set at handshake) | A default *notion* exists, but a stored `'easy'` before confirmation is a placeholder indistinguishable from a real choice. |
| `pure_human` | **non-null, `DEFAULT false`** | `false` is the real default behavior (AI fill-in enabled) — safe and correct even if read early, not a placeholder. |
| `voice` | **non-null, `DEFAULT '{}'`** | Empty dial-map = "AI uses its default voice" — a real default, not a placeholder. |

`settings_confirmed_at` is the confirm/lock gate in all cases.

## Why nullable for turn_limit / pace_preset (Option A over Option B)

Evaluated "nullable" (A) vs "non-null with preloaded defaults" (B). A wins on four practical
grounds:

1. **Canon says settings-free at creation.** event-storm: *StartStory … no settings*; the
   *sheet* preloads defaults (a UX statement), not the row. B would contradict this.
2. **No `turn_limit` default to invent.** B forces a product decision we don't have.
3. **Reversibility asymmetry (the deciding factor).** A→B is a lossless backfill (fill nulls
   with a default whenever product defines one). B→A is **lossy** — once defaults and real
   choices share the same value, you can never separate them again. Start with the reversible
   option.
4. **Clean analytics.** "Which pace do players choose?" is `WHERE pace_preset IS NOT NULL` under
   A; under B the raw column is polluted by unconfirmed defaults and you must join
   `settings_confirmed_at`.

## The cost of A, and how it's contained

`pace_preset`/`turn_limit` become `| null` in the type, so consumers must null-guard. Contained
at the **lobby↔active boundary**: only active stories have these set, and active-only code
(the Phase 6 turn timer, status surfaces) should go through a single `assertConfirmed(story)`
helper or a narrow "ConfirmedStory" type — not sprinkle `?? 'easy'` everywhere.

## When to revisit

Switch `turn_limit`/`pace_preset` to non-null defaults only if **both**: (a) product commits to
canonical defaults, and (b) the downstream null-handling proves genuinely annoying. The forward
migration is cheap; the decision is not locked, only defaulted to the safer start.

## Propagation

Aligned across all three surfaces so canon ↔ types ↔ schema agree: `design/domain-model.md`
(field rows marked nullable), `server/src/domain/types.ts` + its `app/` mirror
(`number | null`, `PacePreset | null`), and `server/migrations/001_init.sql` (nullable columns,
CHECK still permits NULL).
