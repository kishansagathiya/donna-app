import { Platform, StyleSheet, type TextStyle } from 'react-native';

/** PostScript / family name registered by Literata-Regular.ttf */
export const LITERATA_REGULAR =
  Platform.OS === 'android' ? 'Literata-Regular' : 'Literata';

/** SemiBold face — Android needs the file name; iOS uses family + fontWeight. */
export const LITERATA_SEMIBOLD =
  Platform.OS === 'android' ? 'Literata-SemiBold' : 'Literata';

const BOLD_WEIGHTS = new Set([
  '500',
  '600',
  '700',
  '800',
  '900',
  'bold',
  'medium',
  'semibold',
  'heavy',
  'black',
]);

export function isBoldFontWeight(
  weight: TextStyle['fontWeight'] | undefined,
): boolean {
  if (weight == null) {
    return false;
  }
  return BOLD_WEIGHTS.has(String(weight).toLowerCase());
}

/**
 * Resolve the concrete font family for the current theme + style weight.
 * Pass `themeFontFamily` from ThemeColors (`Literata` when e-ink).
 */
export function resolveThemeFontFamily(
  themeFontFamily: string | undefined,
  style?: TextStyle | TextStyle[] | null,
): string | undefined {
  if (!themeFontFamily) {
    return undefined;
  }

  const flat = style ? StyleSheet.flatten(style) : undefined;
  const bold = isBoldFontWeight(flat?.fontWeight);

  if (themeFontFamily === 'Literata' || themeFontFamily.startsWith('Literata')) {
    return bold ? LITERATA_SEMIBOLD : LITERATA_REGULAR;
  }

  return themeFontFamily;
}

/** Style to merge onto Text / TextInput when a theme font is active. */
export function themeFontStyle(
  themeFontFamily: string | undefined,
  style?: TextStyle | TextStyle[] | null,
): TextStyle | undefined {
  const fontFamily = resolveThemeFontFamily(themeFontFamily, style);
  if (!fontFamily) {
    return undefined;
  }

  // Android loads weight as distinct files; keep fontWeight normal so the
  // SemiBold face is not faux-bolded or rematched.
  if (Platform.OS === 'android' && fontFamily === LITERATA_SEMIBOLD) {
    return { fontFamily, fontWeight: '400' };
  }

  return { fontFamily };
}
