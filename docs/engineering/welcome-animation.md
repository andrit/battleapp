# Welcome-screen brand entrance — how it works & how to update it

**Engineering note · `app/src/screens/auth/WelcomeScreen.tsx`.** The Welcome screen plays a short,
staged "brand entrance" on mount — the app's first impression. This documents how it's built and how
to swap in new design elements (a real logo, revised timings, extra beats) once they exist. It
implements the *brand-entrance* beat from `design/discussions/motion-signatures.md`.

## How it works

The native splash (expo-splash-screen) is held only until fonts load, then hides. The first React
screen is Welcome, whose elements animate in as a **staged reveal**, each with a delay after mount:

1. **wordmark** (t=0)
2. **tagline** (t≈260ms)
3. **sign-in options** (t≈620ms)

Total ≈1.2s; the buttons land around the 1-second mark. Motion is built on **Reanimated**:

- Each element is an `Animated.Text` / `Animated.View` with an `entering=` preset.
- A small helper picks the preset per element:

  ```ts
  const enter = (delay: number) =>
    reduced ? FadeIn.duration(REDUCED_FADE_MS) : FadeInDown.springify().damping(20).delay(delay);
  ```

  Normal motion = a gentle fade-up spring (`FadeInDown`), staggered by `delay`. **Reduced motion**
  (`useReducedMotion()`) collapses everything to a plain ~150ms fade — no movement or stagger.

### The two knobs

Both live at the top of `WelcomeScreen.tsx`:

```ts
const ENTRANCE = { wordmark: 0, tagline: 260, actions: 620 } as const; // ms delays per element
const REDUCED_FADE_MS = 150;                                           // reduced-motion fade
```

- **Retune the pacing** → change the `ENTRANCE` delays. Larger gaps = a slower, more dramatic reveal.
- Each element's JSX references its own key (`enter(ENTRANCE.wordmark)`, `enter(ENTRANCE.tagline)`,
  `enter(reduced ? 0 : ENTRANCE.actions)`), so the mapping stays obvious.

## How to update it after new design elements are created

The elements are intentionally easy to trade out — the *structure* (staged `entering` presets +
`ENTRANCE` delays) stays; you swap the *content*.

### Swap the typographic wordmark for a real logo

The wordmark is a placeholder `<Animated.Text>battleapp</Animated.Text>`. To use a real brandmark:

- **Static image (PNG/SVG):** replace that node with an `Animated.Image` (or an `Animated.View`
  wrapping an SVG) using the same `entering={enter(ENTRANCE.wordmark)}`. Keep it centered in `hero`.
- **Animated logo (the richer "first beat"):** this is where a **Lottie** (`lottie-react-native`) or
  **Rive** (`rive-react-native`) intro belongs — play it as beat 1, then let the tagline + options
  follow. Both are native modules → they require the **EAS dev build** (they don't run in Expo Go),
  the same tradeoff noted for auth. Drive the tagline/options entrance off the logo's completion
  callback (or keep the fixed `ENTRANCE` delays if the logo's duration is known).

### Add or reorder beats

Add another staged element by giving it an `entering={enter(ENTRANCE.newThing)}` and a delay in
`ENTRANCE` between the neighbours you want it to sit between. Keep the count small — restraint is the
rule (`motion-signatures.md`): a calm 2–4 beat reveal, not a cascade.

### Restyle within the design system

Colors/type come from `app/src/theme/tokens.ts` (`type.display`, `fontFamily.serif`, `color.primary`,
etc.), so the entrance stays consistent with the rest of the app — restyle there, not with ad-hoc
values.

### Keep these invariants

- **Always keep the reduced-motion path** (`enter` already handles it) — every entrance must have a
  no-movement fade fallback. This is the a11y line.
- **Don't block the CTAs for long** — the sign-in buttons should be tappable ~1s in. If you add a
  longer logo beat, let the buttons still appear promptly (don't gate them behind a 3s intro).
- **Play it once per launch, not on every re-render** — it lives on mount; don't retrigger it on
  state changes.

## Related

`design/discussions/motion-signatures.md` (the motion system this implements) ·
`design/discussions/curator-character.md` (a future animated character — same Lottie/Rive + dev-build
considerations) · `app/src/theme/tokens.ts` (palette/type).
