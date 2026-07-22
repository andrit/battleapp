/**
 * BattleApp design tokens — RN mapping of design/wireframes/design-tokens.md.
 *
 * Keep token names identical to the CSS `:root` in that doc so wireframe <-> build
 * stays legible. Light theme is V1; dark is a Phase 9 token-swap (not here yet).
 *
 * Two load-bearing ideas the tokens encode:
 *  - Reading is the hero: story content is serif (Lora) on user-chosen `paper`.
 *  - AI is the quieter voice: AI Sections sit on a fixed cool-slate tint (`ai.*`)
 *    that deliberately does NOT follow the paper choice — the human/AI contrast holds
 *    on warm or white paper.
 */

// --- Color: light theme (V1) ---------------------------------------------------

export const color = {
  // Neutrals (warm-leaning)
  ink900: '#1A1712', // story text
  ink700: '#3D3833',
  ink500: '#6B645C', // muted meta
  ink300: '#A8A199', // placeholder / disabled
  line: '#E6E0D8', // hairline
  surface: '#FFFFFF', // UI cards
  appBg: '#F4F1EC',

  // Brand — spark indigo ("battle" energy)
  primary: '#4B3FE4',
  primaryInk: '#FFFFFF',
  primaryTint: '#ECEAFC', // your-turn / selected bg
  primaryPress: '#3E33C4',

  // Accent / reactions
  heart: '#E5484D',
  amber: '#E8912B', // lobby / awaiting spark

  // Interaction accents (warm/cool paired to the human/AI split)
  coral: '#F2664B', // user-action acknowledgements (turn posted, reaction sent)
  tealElectric: '#16B8A6', // AI-interaction moments (director hint, moderation clearing)

  // AI / restraint (cool, subordinate — paper-independent)
  aiTint: '#EEF2F6', // AI-Section bg
  aiLine: '#D3DBE3',
  aiInk: '#5A6B7B', // AI chip text + compute glyph

  // Author colors (muted, two-player — chip text / leading dot, never fills)
  authorA: '#2F6F6A', // teal
  authorB: '#8A5A2B', // terracotta

  // Semantic
  success: '#2E7D57',
  warning: '#B8791B',
  error: '#B0231F',
  info: '#3A6EA5',
} as const;

/**
 * Reading surface — a user choice (Task 5 reading controls), stored client-side.
 * Swaps ONLY the story-scroll background. The AI cool-slate tint above never follows it.
 */
export const paper = {
  warm: '#FBF7F0', // default — warm, book-like
  white: '#FFFFFF', // bright, high-contrast
} as const;

export type PaperChoice = keyof typeof paper;
export const defaultPaper: PaperChoice = 'warm';

/** Story-status pills: [background tint, text color]. */
export const statusPill = {
  yourTurn: { bg: color.primaryTint, text: color.primary },
  waiting: { bg: color.line, text: color.ink500 },
  lobby: { bg: '#FBEFD9', text: color.amber },
  complete: { bg: '#E4F0EA', text: color.success },
  abandoned: { bg: '#EFECE7', text: color.ink300 },
} as const;

// --- Typography ----------------------------------------------------------------

/**
 * Lora font-family names as exported by @expo-google-fonts/lora. Story text uses
 * `Lora_400Regular`; UI text omits fontFamily (platform default: SF Pro / Roboto).
 */
export const fontFamily = {
  serif: 'Lora_400Regular',
  serifMedium: 'Lora_500Medium',
  serifSemiBold: 'Lora_600SemiBold',
  serifItalic: 'Lora_400Regular_Italic',
} as const;

/**
 * Type scale. Sans tokens carry a `fontWeight` and no `fontFamily` (system).
 * Serif tokens (`story`, `storyLg`) carry a Lora `fontFamily` and no weight —
 * weight comes from the font file. The serif scale is built to scale up cleanly
 * for the reading-control size bump.
 */
export const type = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '700' }, // wordmark, celebration
  title: { fontSize: 22, lineHeight: 28, fontWeight: '600' }, // screen titles
  heading: { fontSize: 17, lineHeight: 24, fontWeight: '600' }, // section headers
  story: { fontSize: 18, lineHeight: 30, fontFamily: fontFamily.serif }, // story body (hero)
  storyLg: { fontSize: 20, lineHeight: 34, fontFamily: fontFamily.serif }, // reading-control bump
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' }, // UI body
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' }, // buttons, chips
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' }, // author chip, meta
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '700' }, // badges, counts
} as const;

// --- Spacing, radii, elevation -------------------------------------------------

/** 4-base spacing scale. */
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  14: 56,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

/** Minimum tap target (thumb-zone / WCAG). */
export const minTapTarget = 48;

/** FAB diameter ("Start Story"). */
export const fabSize = 56;

/**
 * Elevation as RN shadow objects (iOS shadow* + Android elevation).
 * card = y2 blur8 rgba(0,0,0,.06); modal = y8 blur24 rgba(0,0,0,.16).
 */
export const elevation = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  modal: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

// --- Aggregate -----------------------------------------------------------------

export const tokens = {
  color,
  paper,
  defaultPaper,
  statusPill,
  fontFamily,
  type,
  space,
  radius,
  minTapTarget,
  fabSize,
  elevation,
} as const;

export default tokens;
