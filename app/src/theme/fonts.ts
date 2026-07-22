/**
 * Lora font loading. Story content is set in Lora (design-tokens.md); the splash
 * is held until the fonts are ready so the reading surface never flashes in an
 * unstyled serif fallback. UI chrome uses the platform default and needs no load.
 */
import { useFonts } from 'expo-font';
import {
  Lora_400Regular,
  Lora_400Regular_Italic,
  Lora_500Medium,
  Lora_600SemiBold,
} from '@expo-google-fonts/lora';

/** Weights the type scale actually references (design-tokens: 400 / 500 / 600 / 400-italic). */
export const loraFontMap = {
  Lora_400Regular,
  Lora_400Regular_Italic,
  Lora_500Medium,
  Lora_600SemiBold,
} as const;

/** Returns `[loaded, error]`; hold the splash while `!loaded && !error`. */
export function useAppFonts(): [boolean, Error | null] {
  return useFonts(loraFontMap);
}
