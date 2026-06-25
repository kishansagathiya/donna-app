import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { ThemeColors } from '../theme/colors';
import { MicButton, type MicState } from './MicButton';

type Props = {
  micState: MicState;
  onMicPress: () => void;
  micDisabled?: boolean;
  onSuggestionPress?: (prompt: string) => void;
};

const SUGGESTION = 'What did I save last week?';

export function ChatHero({
  micState,
  onMicPress,
  micDisabled,
  onSuggestionPress,
}: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <View style={styles.glowOuter} pointerEvents="none" />
      <View style={styles.glowInner} pointerEvents="none" />
      <MicButton state={micState} onPress={onMicPress} disabled={micDisabled} />
      <Text style={styles.title}>Ask Donna anything</Text>
      <Text style={styles.subtitle}>
        Donna remembers what you save — links, files, and past conversations.
      </Text>
      {onSuggestionPress ? (
        <Pressable
          style={styles.suggestion}
          onPress={() => onSuggestionPress(SUGGESTION)}
          accessibilityRole="button"
        >
          <Text style={styles.suggestionText}>“{SUGGESTION}”</Text>
        </Pressable>
      ) : null}
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
    glowOuter: {
      position: 'absolute',
      width: 300,
      height: 300,
      borderRadius: 150,
      backgroundColor: colors.primaryLight,
      opacity: 0.35,
      top: '14%',
    },
    glowInner: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: colors.primaryLight,
      opacity: 0.5,
      top: '20%',
    },
    title: {
      marginTop: 24,
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
    suggestion: {
      marginTop: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: colors.primaryLight,
    },
    suggestionText: {
      fontSize: 14,
      fontStyle: 'italic',
      color: colors.primary,
      fontWeight: '500',
    },
  });
}
