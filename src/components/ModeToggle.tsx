import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { ThemeColors } from '../theme/colors';
import type { DonnaMode } from '../types/mode';

type ModeToggleProps = {
  mode: DonnaMode;
  onChange: (mode: DonnaMode) => void;
  disabled?: boolean;
};

export function ModeToggle({ mode, onChange, disabled }: ModeToggleProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container} accessibilityRole="tablist">
      <Pressable
        style={[styles.segment, mode === 'talk' && styles.segmentActive]}
        onPress={() => onChange('talk')}
        disabled={disabled}
        accessibilityRole="tab"
        accessibilityState={{ selected: mode === 'talk', disabled: !!disabled }}
      >
        <Text style={[styles.label, mode === 'talk' && styles.labelActive]}>
          Talk
        </Text>
      </Pressable>
      <Pressable
        style={[styles.segment, mode === 'listen' && styles.segmentActive]}
        onPress={() => onChange('listen')}
        disabled={disabled}
        accessibilityRole="tab"
        accessibilityState={{ selected: mode === 'listen', disabled: !!disabled }}
      >
        <Text style={[styles.label, mode === 'listen' && styles.labelActive]}>
          Listen
        </Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 3,
    },
    segment: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 16,
    },
    segmentActive: {
      backgroundColor: colors.primary,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.muted,
    },
    labelActive: {
      color: colors.white,
    },
  });
}
