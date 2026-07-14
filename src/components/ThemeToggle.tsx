import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme/colors';
import { APP_THEMES, THEME_ORDER, type AppTheme } from '../theme/theme';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Color theme</Text>
      <Text style={styles.description}>
        Switch between the indigo accent or a black-and-white e-ink reader.
      </Text>
      <View
        style={styles.toggle}
        accessibilityRole="radiogroup"
        accessibilityLabel="Color theme"
      >
        {THEME_ORDER.map((value: AppTheme) => {
          const selected = theme === value;
          return (
            <Pressable
              key={value}
              style={[styles.option, selected && styles.optionActive]}
              onPress={() => setTheme(value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
            >
              <Text
                style={[styles.optionLabel, selected && styles.optionLabelActive]}
              >
                {APP_THEMES[value].label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: 24,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
      fontFamily: colors.fontFamily,
    },
    description: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
      marginBottom: 12,
      fontFamily: colors.fontFamily,
    },
    toggle: {
      flexDirection: 'row',
      gap: 4,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      padding: 4,
    },
    option: {
      flex: 1,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 8,
      alignItems: 'center',
    },
    optionActive: {
      backgroundColor: colors.primary,
    },
    optionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    optionLabelActive: {
      color: colors.white,
    },
  });
}
