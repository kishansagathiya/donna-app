import React, { useEffect, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from './ThemedText';
import { MessageContent } from './MessageContent';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { isDonnaThinkingPhase } from '../lib/thinkingPhrases';
import type { ThemeColors } from '../theme/colors';
import { AssistantThinkingBlock } from './ThinkingIndicator';

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
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const scrollRef = useRef<ScrollView>(null);
  const isThinking = isDonnaThinkingPhase(phaseLabel);
  const thinkingTurnId =
    isThinking && turns.length > 0 ? turns[turns.length - 1]?.id : null;
  const hasWaitingBubble = Boolean(
    thinkingTurnId &&
      turns.some(turn => turn.id === thinkingTurnId && turn.user && !turn.assistant),
  );

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [turns, phaseLabel]);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      nestedScrollEnabled
    >
      {turns.map(turn => {
        const showWaitingBubble =
          turn.id === thinkingTurnId && turn.user && !turn.assistant;

        return (
          <View key={turn.id} style={styles.turn}>
            {turn.user ? (
              <View style={[styles.bubble, styles.userBubble]}>
                <MessageContent
                  content={turn.user}
                  variant="user"
                  textStyle={styles.userText}
                />
              </View>
            ) : null}
            {turn.assistant ? (
              <View style={[styles.bubble, styles.assistantBubble]}>
                <MessageContent
                  content={turn.assistant}
                  variant="assistant"
                  textStyle={styles.assistantText}
                />
              </View>
            ) : showWaitingBubble ? (
              <AssistantThinkingBlock colors={colors} />
            ) : null}
          </View>
        );
      })}

      {isThinking && !hasWaitingBubble ? (
        <AssistantThinkingBlock colors={colors} />
      ) : phaseLabel && !isThinking ? (
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
      alignSelf: 'flex-start',
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 4,
      paddingLeft: 4,
    },
  });
}
