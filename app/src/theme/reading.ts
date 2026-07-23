/**
 * Reading controls → concrete styles (client-state-ux.md §B). The font stepper maps to the serif
 * scale (S 16 / M 18 / L 20 / XL 22); comfort boosts line-height for airier reading. Applies to
 * the STORY SERIF only — never UI chrome. Paper picks the story-scroll background; the AI
 * cool-slate tint deliberately never follows it (that contrast is handled in StorySection).
 */
import { fontFamily, paper as paperTokens, type PaperChoice } from './tokens';
import type { FontStep, ReadingPrefs } from '../state/preferencesStore';

interface StepSpec {
  fontSize: number;
  lineHeight: number;
  comfortLineHeight: number;
  label: string;
}

const STEPS: Record<FontStep, StepSpec> = {
  0: { fontSize: 16, lineHeight: 26, comfortLineHeight: 30, label: 'S' },
  1: { fontSize: 18, lineHeight: 30, comfortLineHeight: 34, label: 'M' }, // tokens `story`
  2: { fontSize: 20, lineHeight: 34, comfortLineHeight: 38, label: 'L' }, // tokens `story-lg`
  3: { fontSize: 22, lineHeight: 38, comfortLineHeight: 42, label: 'XL' },
};

export const FONT_STEP_MIN: FontStep = 0;
export const FONT_STEP_MAX: FontStep = 3;

/** The serif text style for story content at the reader's chosen size + comfort. */
export function readingStoryStyle(reading: ReadingPrefs): {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
} {
  const step = STEPS[reading.fontStep];
  return {
    fontSize: step.fontSize,
    lineHeight: reading.comfort ? step.comfortLineHeight : step.lineHeight,
    fontFamily: fontFamily.serif,
  };
}

/** Short label (S/M/L/XL) for the font stepper. */
export function fontStepLabel(fontStep: FontStep): string {
  return STEPS[fontStep].label;
}

/** Clamp a step change into the valid 0..3 range. */
export function clampFontStep(step: number): FontStep {
  return Math.min(FONT_STEP_MAX, Math.max(FONT_STEP_MIN, step)) as FontStep;
}

/** The story-scroll background for the chosen paper. */
export function paperColor(paper: PaperChoice): string {
  return paperTokens[paper];
}
