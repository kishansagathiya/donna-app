import React, { forwardRef } from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { themeFontStyle } from '../theme/font';

/**
 * Drop-in Text that applies the active theme font (Literata in e-ink).
 * React Native does not inherit fontFamily, so every label needs this.
 */
export const Text = forwardRef<RNText, TextProps>(function Text(
  { style, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const themed = themeFontStyle(colors.fontFamily, style as TextStyle);
  // Themed font last so it wins over StyleSheet fontFamily / Android weight.
  return <RNText ref={ref} {...rest} style={themed ? [style, themed] : style} />;
});

/**
 * Drop-in TextInput that applies the active theme font (Literata in e-ink).
 */
export const TextInput = forwardRef<RNTextInput, TextInputProps>(
  function TextInput({ style, ...rest }, ref) {
    const { colors } = useTheme();
    const themed = themeFontStyle(colors.fontFamily, style as TextStyle);
    return (
      <RNTextInput
        ref={ref}
        {...rest}
        style={themed ? [style, themed] : style}
      />
    );
  },
);
