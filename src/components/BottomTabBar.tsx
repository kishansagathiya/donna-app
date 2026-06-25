import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export type AppTab = 'chat' | 'memory' | 'profile';

type Props = {
  active: AppTab;
  onChange: (tab: AppTab) => void;
};

const tabs: { id: AppTab; label: string; icon: string }[] = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'memory', label: 'Memory', icon: '🗃' },
  { id: 'profile', label: 'Profile', icon: '👤' },
];

export function BottomTabBar({ active, onChange }: Props) {
  return (
    <View style={styles.container}>
      {tabs.map(tab => {
        const selected = active === tab.id;
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
              <Text style={[styles.icon, selected && styles.iconActive]}>
                {tab.icon}
              </Text>
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

const styles = StyleSheet.create({
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
    backgroundColor: colors.primary,
  },
  icon: {
    fontSize: 18,
  },
  iconActive: {
    color: colors.white,
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
