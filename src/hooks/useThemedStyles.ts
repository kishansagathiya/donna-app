import { useMemo } from 'react';
import {
  StyleSheet,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { ThemeColors } from '../theme/colors';
import { resolveThemeFontFamily } from '../theme/font';
import { useTheme } from './useTheme';

type NamedStyles<T> = {
  [P in keyof T]: ViewStyle | TextStyle | ImageStyle;
};

function looksLikeTextStyle(style: ViewStyle | TextStyle | ImageStyle): boolean {
  const s = style as TextStyle;
  return (
    s.fontSize != null ||
    s.fontWeight != null ||
    s.fontStyle != null ||
    s.lineHeight != null ||
    s.letterSpacing != null ||
    s.textAlign != null ||
    s.textDecorationLine != null ||
    s.fontFamily != null
  );
}

/** Inject theme fontFamily into text-like styles inside a StyleSheet factory result. */
export function withThemeFonts<T extends NamedStyles<T>>(
  styles: T,
  themeFontFamily: string | undefined,
): T {
  if (!themeFontFamily) {
    return styles;
  }

  const next = {} as T;
  for (const key of Object.keys(styles) as (keyof T)[]) {
    const style = styles[key];
    if (
      style &&
      typeof style === 'object' &&
      !Array.isArray(style) &&
      looksLikeTextStyle(style)
    ) {
      const fontFamily = resolveThemeFontFamily(
        themeFontFamily,
        style as TextStyle,
      );
      next[key] = (
        fontFamily && !(style as TextStyle).fontFamily
          ? { ...style, fontFamily }
          : style
      ) as T[keyof T];
    } else {
      next[key] = style;
    }
  }
  return next;
}

export function useThemedStyles<T extends NamedStyles<T>>(
  factory: (colors: ThemeColors) => T,
): T {
  const { colors } = useTheme();
  return useMemo(
    () => StyleSheet.create(withThemeFonts(factory(colors), colors.fontFamily)),
    [colors],
  );
}
