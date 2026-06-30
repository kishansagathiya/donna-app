import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useAuth } from '../hooks/useAuth';
import type { ThemeColors } from '../theme/colors';
import { HistoryIcon, SettingsIcon } from './icons';
import { ModeToggle } from './ModeToggle';
import type { DonnaMode } from '../types/mode';

type Props = {
  mode: DonnaMode;
  onModeChange: (mode: DonnaMode) => void;
  modeDisabled?: boolean;
  onAvatarPress?: () => void;
  onHistoryPress?: () => void;
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
  const styles = useThemedStyles(createAvatarStyles);
  const avatarUrl = session?.user.user_metadata?.avatar_url as
    | string
    | undefined;
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
      accessibilityLabel="Open profile"
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Text style={[styles.avatarText, { fontSize: size * 0.39 }]}>
          {initial}
        </Text>
      )}
    </Pressable>
  );
}

export function AppHeader({
  mode,
  onModeChange,
  modeDisabled,
  onAvatarPress,
  onHistoryPress,
  onSettingsPress,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <ModeToggle
        mode={mode}
        onChange={onModeChange}
        disabled={modeDisabled}
      />

      <View style={styles.actions}>
        {onHistoryPress ? (
          <Pressable
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
            ]}
            onPress={onHistoryPress}
            accessibilityRole="button"
            accessibilityLabel="Chat history"
          >
            <HistoryIcon size={20} color={colors.muted} />
          </Pressable>
        ) : null}
        <Pressable
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.iconButtonPressed,
          ]}
          onPress={onSettingsPress}
          accessibilityRole="button"
          accessibilityLabel="Profile and settings"
        >
          <SettingsIcon size={20} color={colors.muted} />
        </Pressable>
        <UserAvatar onPress={onAvatarPress} />
      </View>
    </View>
  );
}

function createAvatarStyles(colors: ThemeColors) {
  return StyleSheet.create({
    avatar: {
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarText: {
      fontWeight: '600',
      color: colors.primary,
    },
  });
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
      gap: 8,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconButtonPressed: {
      backgroundColor: colors.surface,
    },
  });
}
