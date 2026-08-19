import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './ThemedText';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useTheme } from '../hooks/useTheme';
import type { ComposerMode } from '../lib/composerMode';
import type { ThemeColors } from '../theme/colors';
import { BotIcon, MessageSquareIcon } from './icons';

type Props = {
  mode: ComposerMode;
  onChange: (mode: ComposerMode) => void;
  disabled?: boolean;
};

const OPTIONS: {
  id: ComposerMode;
  label: string;
  Icon: typeof MessageSquareIcon;
}[] = [
  { id: 'chat', label: 'Chat', Icon: MessageSquareIcon },
  { id: 'agent', label: 'Agent', Icon: BotIcon },
];

export function ComposerModeToggle({ mode, onChange, disabled }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View
      style={[styles.group, disabled && styles.groupDisabled]}
      accessibilityRole="tablist"
      accessibilityLabel="Composer mode"
    >
      {OPTIONS.map(option => {
        const selected = mode === option.id;
        const iconColor = selected ? colors.white : colors.muted;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <option.Icon size={14} color={iconColor} />
            <Text
              style={[styles.label, selected && styles.labelSelected]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    group: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 2,
    },
    groupDisabled: {
      opacity: 0.6,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    optionSelected: {
      backgroundColor: colors.primary,
    },
    label: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    labelSelected: {
      color: colors.white,
    },
  });
}
