# BattleApp — The Curator (character as accent)

**Design exploration · written 2026-07-23 · lands Phase 8/9 (Polish + delighters); needs a
character/motion designer.** A named character that gives the app a face and a share-hook — scoped
deliberately as an **accent**, not a mechanism. Sibling doc: `motion-signatures.md`.

## What it is

A **curator / guide** — "a good English teacher running a reading-or-writing exercise": sets the
room, grants permission to play, celebrates the work, and then **gets out of the way so the writers
actually write.** It is the app's host and identity, not a participant in the story.

Two reasons it's worth building:

1. **Identity** — an extra layer of personality that makes battleapp *recognizable*.
2. **Shareability** — the "you have to *see* this" hook, spent at the finish (see § The curtain call).

## The two invariants (these keep "no AI slop" intact)

1. **The Curator is never the AI, and never touches your words.** It operates on **rituals and
   lifecycle events** — you *started* a story, your partner's turn *arrived*, you *finished* — never
   on the *content* of a turn. The instant a character reacts to *what you wrote*, it becomes "the AI
   watching you," which is the exact thing §1 ("no AI slop") positions against. Hold this line hard.
2. **It's an accent — remove it and nothing breaks.** No flow depends on it; no state requires it.
   That's precisely why it's *safe* to be charming: it can't do harm it isn't load-bearing for.

### Curator ≠ AI Director

Keep these two as separate concepts that never blur:

| | **AI Director** (`ai-director-spec.md`) | **The Curator** (this doc) |
|---|---|---|
| Visibility | **Invisible** system | **Visible** character |
| Acts on | The story text (a stall-gated hint) | Rituals/events only — never content |
| Nature | A mechanical nudge | The app's host / brand voice |
| When | Silent while you write; ½-span stall only | Onboarding + the finish; never mid-composition |

If a user could ever confuse the Curator's cheer for the Director's guidance, the boundary has been
drawn wrong.

## Set reactions for scripted moments (the production model)

The character is a **finite library of named states**, each bound to **one** scripted lifecycle
moment — not open-ended animation. This is what makes it commissionable (you order N clips), keeps it
consistent (one moment → one canonical reaction), and keeps it an accent. It rides the
`motion-signatures.md` system; it does **not** replace it.

| Scripted moment (event, not content) | Curator reaction | Notes / boundary |
|---|---|---|
| **First run / onboarding** | Welcome — "let's begin" | Grants permission to play; sets the tone. |
| **Story started / invite sent** | An encouraging send-off | "Off you go" — then it leaves. |
| **Lobby / waiting for partner** | Patient, anticipatory idle *(optional)* | Warm, never nagging (we are **not** Duo's guilt loop). |
| **Milestone** *(optional)* | A small, quiet "nice" at a notable beat | Use sparingly; must not intrude on the loop. |
| **Story complete — the curtain call** | The hero moment: celebrate + present the finished story | The one animation worth the most polish. |
| **Share** | "Show this off" gesture on the End-screen | Turns the finished story into the shareable artifact. |

**Explicitly not in the set:** any reaction to the words of a turn; any presence during active
composition; anything corrective or evaluative. "Runs the exercise, then gets out of the way."

## The curtain call (its home)

The Curator's center of gravity is the **End-screen**, where a completed story pays off ("the
surprise"). This is where identity, virality, the `story_completed` analytics event, and the `curtain`
motion signature all converge into a single earned moment: the Curator presents *your* finished story
as something to show a friend. One character, one earned moment, maximum signature — the opposite of a
mascot that hovers everywhere.

## Voice & tone

- **Grants permission; celebrates the craft; never grades.** Delighted fellow-enthusiast, not a
  marker. "You two are *cooking!*" — never "here's what to fix."
- **Warm-restrained**, matching the app's literary voice — closer to a theatre emcee than a
  gameshow host. No guilt, no streak-shaming, no manufactured urgency.
- Fits the warm-paper / serif world of `design-tokens.md` — it should look like it belongs *in the
  book*, not pasted on top of it.

## Open — to develop (with a designer)

Identity is intentionally unresolved here: **name, look, and voice are TBD.** The "spectacled,
handlebar-mustachioed English teacher" is the seed image, reframed as curator (not grader). Develop
the persona, then fold the final identity back into this doc so it ships alive rather than as a role.

## Commissioning notes (for when a designer is engaged)

- **Deliver as a finite set of named states** matching the reaction table above (plus a neutral idle).
  A state-machine tool fits this exactly.
- **Format for React Native / Expo:** **Rive** (`rive-react-native`) suits a character-with-states
  best (state machine = "set reactions"; small files); **Lottie** (`lottie-react-native`) is the
  well-trodden alternative (After Effects → Bodymovin). Both ship native code → they require a
  **custom dev client** (they break Expo Go), same upgrade-path tradeoff we flagged for
  `react-native-keyboard-controller`. That's fine at Phase 8/9 (EAS is already configured) — just
  budget for the dev-client switch when the character lands.
- **Constrain the palette & timing to our tokens** — the character animates *within* the
  `motion-signatures.md` durations/easings and the `design-tokens.md` palette, so it reads as one
  system, not a bolt-on.
- **Brief the boundary explicitly:** accent not load-bearing; reacts to events, never to the user's
  words; warm not evaluative.

## Roadmap

- **Phase 8 (Polish):** onboarding + curtain-call reactions, once the End-screen exists.
- **Phase 9 (delighters, `kano.md`):** the optional idle/milestone states, richer share.
- **Not Phase 5 (auth), which stays next.** The character is an accent on a finished loop, not a
  prerequisite for one.

## Cross-references

`motion-signatures.md` (the system it rides) · `ai-director-spec.md` (the invisible AI it must never
be confused with) · `design-tokens.md` (palette/voice it lives inside) · `kano.md` (delighter tier) ·
the deferred **End-screen** + `story_completed` analytics event (Phase 4 Task 8) — its home.
