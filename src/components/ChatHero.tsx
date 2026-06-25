import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MicButton, type MicState } from './MicButton';
import { colors } from '../theme/colors';

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
  return (
    <View style={styles.container}>
      <View style={styles.glow} pointerEvents="none" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  glow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.primaryLight,
    opacity: 0.45,
    top: '18%',
  },
  title: {
    marginTop: 20,
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
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: colors.primary,
    fontWeight: '500',
  },
});
