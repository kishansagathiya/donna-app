import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { isDonnaThinkingPhase } from '../lib/thinkingPhrases';
import type { ThemeColors } from '../theme/colors';
import { MicButton, type MicState } from './MicButton';
import { ThinkingIndicator } from './ThinkingIndicator';

type Props = {
  micState: MicState;
  onMicPress: () => void;
  micDisabled?: boolean;
  compact?: boolean;
  showMic?: boolean;
  sessionLabel?: string | null;
};

export function ChatHero({
  micState,
  onMicPress,
  micDisabled,
  compact = false,
  showMic = true,
  sessionLabel,
}: Props) {
  const styles = useThemedStyles(createStyles);

  if (compact && !showMic && !sessionLabel) {
    return null;
  }

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {showMic ? (
        <MicButton state={micState} onPress={onMicPress} disabled={micDisabled} />
      ) : null}
      {showMic && isDonnaThinkingPhase(sessionLabel) ? (
        <ThinkingIndicator style={styles.status} />
      ) : showMic && sessionLabel ? (
        <Text style={styles.status} accessibilityRole="text">
          {sessionLabel}
        </Text>
      ) : null}
      {compact || sessionLabel || !showMic ? null : (
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
