import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './ThemedText';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useTheme } from '../hooks/useTheme';
import type { ThemeColors } from '../theme/colors';
import {
  DatabaseIcon,
  MessageSquareIcon,
  StickyNoteIcon,
  UserIcon,
} from './icons';

export type AppTab = 'chat' | 'notes' | 'memory' | 'profile';

type Props = {
  active: AppTab;
  onChange: (tab: AppTab) => void;
};

const tabs: {
  id: AppTab;
  label: string;
  Icon: typeof MessageSquareIcon;
}[] = [
  { id: 'chat', label: 'Chat', Icon: MessageSquareIcon },
  { id: 'notes', label: 'Notes', Icon: StickyNoteIcon },
  { id: 'memory', label: 'Memory', Icon: DatabaseIcon },
  { id: 'profile', label: 'Profile', Icon: UserIcon },
];

export function BottomTabBar({ active, onChange }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      {tabs.map(tab => {
        const selected = active === tab.id;
        const iconColor = selected ? colors.primary : colors.muted;
        return (
          <Pressable
            key={tab.id}
            style={styles.tab}
            onPress={() => onChange(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
          >
            <View style={[styles.iconWrap, selected && styles.iconWrapActive]}>
              <tab.Icon size={20} color={iconColor} />
            </View>
            <Text style={[styles.label, selected && styles.labelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
      paddingTop: 8,
      paddingBottom: 6,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    iconWrap: {
      width: 44,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapActive: {
      backgroundColor: colors.primaryLight,
    },
    label: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.muted,
    },
    labelActive: {
      color: colors.primary,
      fontWeight: '600',
    },
  });
}
