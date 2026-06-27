import React, { useEffect, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { ThemeColors } from '../theme/colors';

export type ChatTurn = {
  id: string;
  user: string;
  assistant: string | null;
};

type Props = {
  turns: ChatTurn[];
  phaseLabel?: string | null;
};

export function ChatMessages({ turns, phaseLabel }: Props) {
  const styles = useThemedStyles(createStyles);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [turns, phaseLabel]);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {turns.map(turn => (
        <View key={turn.id} style={styles.turn}>
          {turn.user ? (
            <View style={[styles.bubble, styles.userBubble]}>
              <Text style={styles.userText}>{turn.user}</Text>
            </View>
          ) : null}
          {turn.assistant ? (
            <View style={[styles.bubble, styles.assistantBubble]}>
              <Text style={styles.assistantText}>{turn.assistant}</Text>
            </View>
          ) : null}
        </View>
      ))}

      {phaseLabel ? (
        <Text style={styles.phase} accessibilityRole="text">
          {phaseLabel}
        </Text>
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
      gap: 12,
    },
    turn: {
      gap: 12,
    },
    bubble: {
      maxWidth: '85%',
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primary,
      borderBottomRightRadius: 4,
    },
    assistantBubble: {
      alignSelf: 'flex-start',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderBottomLeftRadius: 4,
    },
    userText: {
      color: colors.white,
      fontSize: 15,
      lineHeight: 22,
    },
    assistantText: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
    },
    phase: {
      alignSelf: 'center',
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 4,
    },
  });
}
