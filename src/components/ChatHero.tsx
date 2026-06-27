import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { ThemeColors } from '../theme/colors';
import { MicButton, type MicState } from './MicButton';

type Props = {
  micState: MicState;
  onMicPress: () => void;
  micDisabled?: boolean;
  compact?: boolean;
  sessionLabel?: string | null;
};

export function ChatHero({
  micState,
  onMicPress,
  micDisabled,
  compact = false,
  sessionLabel,
}: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <MicButton state={micState} onPress={onMicPress} disabled={micDisabled} />
      {sessionLabel ? (
        <Text style={styles.status} accessibilityRole="text">
          {sessionLabel}
        </Text>
      ) : null}
      {compact || sessionLabel ? null : (
        <>
          <Text style={styles.title}>Ask Donna anything</Text>
          <Text style={styles.subtitle}>
            Donna remembers what you save — links, files, and past conversations.
          </Text>
        </>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    containerCompact: {
      flex: 0,
      paddingVertical: 16,
    },
    status: {
      marginTop: 16,
      fontSize: 15,
      fontWeight: '600',
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 22,
    },
    title: {
      marginTop: 32,
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    subtitle: {
      marginTop: 10,
      fontSize: 15,
      lineHeight: 22,
      color: colors.muted,
      textAlign: 'center',
      maxWidth: 320,
    },
  });
}
