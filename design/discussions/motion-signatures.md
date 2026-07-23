# BattleApp — Motion Signatures (interaction motion as a semantic layer)

**Design exploration · written 2026-07-23 · informs Phase 8 (Polish); a few pieces pull forward.**
Extends the visual system in `design-tokens.md` into **motion**. Not decoration — motion is a second
dimension of the same semantic language color already carries. Sibling doc: `curator-character.md`.

## Thesis

Every interaction carries a **message signature** — "you acted," "the AI did something," "your
partner is here," "the story is finished." Today color encodes that (coral = you, teal = AI, author
colors = the two writers). **Motion should encode the *same* meaning, consistently.** Same event
class → same accent + same motion, every time. A user must never see "turn posted" animate two
different ways. When motion is consistent per signature, the animation *becomes* the meaning, and the
app feels authored rather than decorated.

## The signatures

| Message class | Accent (existing) | Motion signature | Lives on |
|---|---|---|---|
| **You acted** — turn posted, reaction sent, setting saved | `coral` | **Settle** — spring-in + one soft pulse | posted-ack toast, heart |
| **AI moment** — director hint appears, moderation clears | `teal-electric` | **Shimmer** — soft fade + brief teal ring | director-hint card |
| **Partner presence / turn arrival** — "Sam is writing", live turn lands | `author-a` / `author-b` | **Arrival** — typing pulse → the new Section slides + fades up from the partner's side | Story View scroll, presence line |
| **System state** — offline, error, loading | `amber` / neutral | **Notice** — slide-down banner; skeleton shimmer | banners, skeletons |
| **The payoff** — story complete (the surprise) | `primary` + celebration | **Curtain** — the one big staged moment | End-screen (see `curator-character.md`) |

## Motion tokens (to add to `app/src/theme/tokens.ts` in Phase 8)

Motion gets tokens the same way type and color do — a small fixed set, built on the Reanimated
already installed. Proposed starting values (tune on device):

- **Durations:** `instant 120ms` · `quick 200ms` · `settle 320ms` · `arrival 360ms` · `curtain ~700ms`.
- **Easings:** ease-out for entrances (`notice`, `shimmer`); spring for `settle`/`arrival`
  (damping ~18–20). `curtain` is a short *sequence*, not a single ease.
- **Travel:** reuse the spacing scale — `sm 8` / `md 12` for enter offsets (matches `FadeInDown`).
- **Loops:** only the typing pulse (partner presence) and skeleton shimmer loop; nothing else repeats.

Each signature ships as a named Reanimated preset (`motion.settle`, `motion.arrival`, …) so call
sites request a *meaning*, not a hand-tuned animation.

## Guardrails

1. **Restraint applies to motion, too.** One signature per event; nothing competes; calm over busy.
   "All interactions animate" does **not** mean loud — it means *consistently and quietly*. This is
   the same "no AI slop" discipline we apply to the AI, pointed at motion.
2. **Reduced-motion fallback on every signature** — collapse to a ~150ms cross-fade, no translate /
   scale / loop. This is the a11y line (`kano.md` reduced-motion delighter / Phase 8 a11y). No
   signature is allowed to exist without its reduced-motion form.
3. **Motion never replaces the accent or the copy** — it punctuates them. If the animation were
   removed, the meaning must still be legible from color + text.

## Priority / roadmap

- **Pull forward: "Sam is writing" + turn `Arrival`.** It lives in the *core loop*, not the polish
  edges — it's the beat that makes the exchange feel alive (the thing we most want to "punch up").
  Candidate for an early-Phase-8 or fast-follow, ahead of the rest of the motion pass.
- **Formalize the token set + presets** at the start of Phase 8 so the whole Polish phase is
  consistent instead of per-screen ad hoc.
- **Curtain** ships with the End-screen (Phase 8/9), where the Curator character hosts it.
- **Does not touch Phase 5 (auth), which stays next.**

## Cross-references

`design-tokens.md` (color/type/accent semantics this extends) · `curator-character.md` (the character
that rides the `curtain` + onboarding frame) · `ai-director-spec.md` (why restraint is load-bearing) ·
`client-state-ux.md` + `screen-states.md` (the states these signatures animate) · `kano.md`
(reduced-motion / delighter tier).
