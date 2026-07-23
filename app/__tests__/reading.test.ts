import {
  clampFontStep,
  fontStepLabel,
  paperColor,
  readingStoryStyle,
} from '../src/theme/reading';

describe('readingStoryStyle', () => {
  it('maps the step to serif size + line-height (default M)', () => {
    expect(readingStoryStyle({ fontStep: 1, comfort: false, paper: 'warm' })).toEqual({
      fontSize: 18,
      lineHeight: 30,
      fontFamily: 'Lora_400Regular',
    });
  });

  it('boosts line-height when comfort is on', () => {
    expect(readingStoryStyle({ fontStep: 1, comfort: true, paper: 'warm' }).lineHeight).toBe(34);
  });

  it('scales up at XL', () => {
    const s = readingStoryStyle({ fontStep: 3, comfort: false, paper: 'white' });
    expect(s.fontSize).toBe(22);
    expect(s.lineHeight).toBe(38);
  });
});

describe('clampFontStep', () => {
  it('clamps into 0..3', () => {
    expect(clampFontStep(-1)).toBe(0);
    expect(clampFontStep(4)).toBe(3);
    expect(clampFontStep(2)).toBe(2);
  });
});

describe('fontStepLabel', () => {
  it('labels S/M/L/XL', () => {
    expect(fontStepLabel(0)).toBe('S');
    expect(fontStepLabel(1)).toBe('M');
    expect(fontStepLabel(2)).toBe('L');
    expect(fontStepLabel(3)).toBe('XL');
  });
});

describe('paperColor', () => {
  it('maps the paper choice to its token', () => {
    expect(paperColor('warm')).toBe('#FBF7F0');
    expect(paperColor('white')).toBe('#FFFFFF');
  });
});
