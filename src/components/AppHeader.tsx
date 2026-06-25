import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useAuth } from '../hooks/useAuth';
import type { ThemeColors } from '../theme/colors';
import { SettingsIcon } from './icons';
import { ModeToggle } from './ModeToggle';
import type { DonnaMode } from '../types/mode';

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
      accessibilityLabel="Profile"
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
        <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>
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
  onSettingsPress,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <View style={styles.side}>
        <UserAvatar onPress={onAvatarPress} />
        <Text style={styles.brand}>Donna</Text>
      </View>

      <ModeToggle
        mode={mode}
        onChange={onModeChange}
        disabled={modeDisabled}
      />

      <View style={styles.side}>
        <Pressable
          style={styles.settingsButton}
          onPress={onSettingsPress}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <SettingsIcon size={22} color={colors.muted} />
        </Pressable>
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
      fontWeight: '700',
      color: colors.primary,
    },
  });
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
      gap: 8,
    },
    side: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    brand: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: -0.3,
    },
    settingsButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 'auto',
    },
  });
}
