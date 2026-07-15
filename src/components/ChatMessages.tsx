import React, { useEffect, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from './ThemedText';
import { MemoryCitations } from './MemoryCitations';
import { MessageActions } from './MessageActions';
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
  error?: boolean;
  cancelled?: boolean;
  feedback?: 'up' | 'down';
  citations?: import('../types/citations').MemoryCitation[];
};

type Props = {
  turns: ChatTurn[];
  phaseLabel?: string | null;
  busy?: boolean;
  actionableTurnIds?: Set<string>;
  onCopyMessage?: (content: string) => void;
  onRegenerate?: () => void;
  onEditMessage?: (turnId: string, nextText: string) => void;
  onFeedback?: (turnId: string, rating: 'up' | 'down') => void;
  onRetry?: () => void;
};

export function ChatMessages({
  turns,
  phaseLabel,
  busy = false,
  actionableTurnIds,
  onCopyMessage,
  onRegenerate,
  onEditMessage,
  onFeedback,
  onRetry,
}: Props) {
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
  const latestTextTurnId = [...turns]
    .reverse()
    .find(turn => actionableTurnIds?.has(turn.id))?.id;

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
        const canShowActions =
          Boolean(actionableTurnIds?.has(turn.id)) &&
          Boolean(onCopyMessage) &&
          !showWaitingBubble &&
          Boolean(turn.user || turn.assistant);

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
              <View
                style={[
                  styles.bubble,
                  styles.assistantBubble,
                  turn.error && styles.errorBubble,
                  turn.cancelled && styles.cancelledBubble,
                ]}
              >
                <MessageContent
                  content={turn.assistant}
                  variant="assistant"
                  textStyle={styles.assistantText}
                />
              </View>
            ) : showWaitingBubble ? (
              <AssistantThinkingBlock colors={colors} />
            ) : turn.cancelled ? (
              <View style={[styles.bubble, styles.assistantBubble]}>
                <Text style={styles.cancelledText}>Generation stopped</Text>
              </View>
            ) : null}

            {turn.citations && turn.citations.length > 0 && turn.assistant ? (
              <MemoryCitations citations={turn.citations} />
            ) : null}

            {canShowActions ? (
              <MessageActions
                turn={turn}
                isLatest={turn.id === latestTextTurnId}
                busy={busy}
                onCopy={onCopyMessage!}
                onRegenerate={
                  turn.id === latestTextTurnId ? onRegenerate : undefined
                }
                onEdit={onEditMessage}
                onFeedback={onFeedback}
                onRetry={onRetry}
              />
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
      gap: 8,
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
      overflow: 'hidden',
    },
    errorBubble: {
      borderColor: colors.destructive,
    },
    cancelledBubble: {
      opacity: 0.85,
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
    cancelledText: {
      color: colors.muted,
      fontSize: 14,
      fontStyle: 'italic',
      fontFamily: colors.fontFamily,
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
