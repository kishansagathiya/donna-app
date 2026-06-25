import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { ModeToggle } from './ModeToggle';
import type { DonnaMode } from '../types/mode';
import { colors } from '../theme/colors';

type Props = {
  mode: DonnaMode;
  onModeChange: (mode: DonnaMode) => void;
  modeDisabled?: boolean;
  onAvatarPress?: () => void;
  onSettingsPress: () => void;
};

export function UserAvatar({
  onPress,
  size = 36,
}: {
  onPress?: () => void;
  size?: number;
}) {
  const { session } = useAuth();
  const name =
    (session?.user.user_metadata?.full_name as string | undefined) ??
    session?.user.email ??
    'U';
  const initial = name.charAt(0).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel="Profile"
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{initial}</Text>
    </Pressable>
  );
}

export function AppHeader({
  mode,
  onModeChange,
  modeDisabled,
  onAvatarPress,
  onSettingsPress,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <UserAvatar onPress={onAvatarPress} />
        <Text style={styles.brand}>Donna</Text>
      </View>

      <ModeToggle
        mode={mode}
        onChange={onModeChange}
        disabled={modeDisabled}
      />

      <Pressable
        style={styles.settingsButton}
        onPress={onSettingsPress}
        accessibilityRole="button"
        accessibilityLabel="Settings"
      >
        <Text style={styles.settingsIcon}>⚙</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  brand: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  avatar: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '700',
    color: colors.primary,
  },
  settingsButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  settingsIcon: {
    fontSize: 22,
    color: colors.muted,
  },
});
