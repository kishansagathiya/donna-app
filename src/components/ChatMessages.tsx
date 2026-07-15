import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from './ThemedText';
import { MemoryCitations } from './MemoryCitations';
import { MessageActions } from './MessageActions';
import { MessageContent } from './MessageContent';
import { ArrowDownIcon } from './icons';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { isDonnaThinkingPhase } from '../lib/thinkingPhrases';
import type { ThemeColors } from '../theme/colors';
import { AssistantThinkingBlock } from './ThinkingIndicator';

/** Distance from bottom (px) that still counts as "following" the stream. */
const NEAR_BOTTOM_PX = 80;

export type ChatTurnAttachment = {
  id: string;
  filename: string;
  previewUri?: string;
  mime?: string;
};

export type ChatTurn = {
  id: string;
  user: string;
  /** Grounded content for follow-up history when attachments were used. */
  historyUser?: string;
  assistant: string | null;
  attachmentLabels?: string[];
  attachments?: ChatTurnAttachment[];
  error?: boolean;
  cancelled?: boolean;
  streaming?: boolean;
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
  onOpenNote?: (noteId: string) => void;
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
  onOpenNote,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const scrollRef = useRef<ScrollView>(null);
  const stickToBottomRef = useRef(true);
  const prevTurnCountRef = useRef(0);
  const [stickToBottom, setStickToBottom] = useState(true);
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

  const enableStickToBottom = () => {
    stickToBottomRef.current = true;
    setStickToBottom(true);
  };

  const scrollToBottom = (animated = false) => {
    scrollRef.current?.scrollToEnd({ animated });
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;
    const nearBottom = distanceFromBottom <= NEAR_BOTTOM_PX;
    if (nearBottom === stickToBottomRef.current) return;
    stickToBottomRef.current = nearBottom;
    setStickToBottom(nearBottom);
  };

  // New / loaded conversation: always resume follow mode.
  const threadKey = turns[0]?.id ?? 'empty';
  useEffect(() => {
    enableStickToBottom();
    prevTurnCountRef.current = turns.length;
  }, [threadKey]);

  // User send: jump back to bottom and resume follow.
  useEffect(() => {
    const count = turns.length;
    const grew = count > prevTurnCountRef.current;
    prevTurnCountRef.current = count;
    if (!grew) return;
    const last = turns[count - 1];
    if (last?.user) {
      enableStickToBottom();
    }
  }, [turns]);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    scrollToBottom(false);
  }, [turns, phaseLabel, stickToBottom]);

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onContentSizeChange={() => {
          if (stickToBottomRef.current) {
            scrollToBottom(false);
          }
        }}
      >
        {turns.map(turn => {
          const showWaitingBubble =
            turn.id === thinkingTurnId && turn.user && !turn.assistant;
          const isActionable =
            Boolean(actionableTurnIds?.has(turn.id)) &&
            Boolean(onCopyMessage);
          // Copy/edit sit under the user prompt even while Donna is thinking.
          const showUserActions = isActionable && Boolean(turn.user);
          const showAssistantActions =
            isActionable && Boolean(turn.assistant) && !showWaitingBubble;
          const hasAttachmentChips =
            (turn.attachments && turn.attachments.length > 0) ||
            (turn.attachmentLabels && turn.attachmentLabels.length > 0);
          const isStreaming =
            Boolean(turn.streaming) ||
            (busy && turn.id === latestTextTurnId && Boolean(turn.assistant));

          return (
            <View key={turn.id} style={styles.turn}>
              {turn.user ? (
                <View style={[styles.bubble, styles.userBubble]}>
                  {hasAttachmentChips ? (
                    <View style={styles.attachmentChips}>
                      {turn.attachments && turn.attachments.length > 0
                        ? turn.attachments.map(att => (
                            <View key={att.id} style={styles.attachmentChip}>
                              {att.previewUri ? (
                                <Image
                                  source={{ uri: att.previewUri }}
                                  style={styles.attachmentThumb}
                                />
                              ) : null}
                              <Text
                                style={styles.attachmentChipText}
                                numberOfLines={1}
                              >
                                {att.filename}
                              </Text>
                            </View>
                          ))
                        : turn.attachmentLabels?.map(label => (
                            <View key={label} style={styles.attachmentChip}>
                              <Text
                                style={styles.attachmentChipText}
                                numberOfLines={1}
                              >
                                {label}
                              </Text>
                            </View>
                          ))}
                    </View>
                  ) : null}
                  <MessageContent
                    content={
                      hasAttachmentChips
                        ? turn.user
                            .replace(/\n\n📎 .+$/s, '')
                            .replace(/^📎 .+$/s, '') || ''
                        : turn.user
                    }
                    variant="user"
                    textStyle={styles.userText}
                  />
                </View>
              ) : null}

              {showUserActions ? (
                <MessageActions
                  turn={turn}
                  target="user"
                  isLatest={turn.id === latestTextTurnId}
                  busy={busy}
                  onCopy={onCopyMessage!}
                  onEdit={onEditMessage}
                />
              ) : null}

              {turn.assistant ? (
                <View
                  style={[
                    styles.bubble,
                    styles.assistantBubble,
                    isStreaming && styles.streamingBubble,
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
                <MemoryCitations
                  citations={turn.citations}
                  onOpenNote={onOpenNote}
                />
              ) : null}

              {showAssistantActions ? (
                <MessageActions
                  turn={turn}
                  target="assistant"
                  isLatest={turn.id === latestTextTurnId}
                  busy={busy}
                  onCopy={onCopyMessage!}
                  onRegenerate={
                    turn.id === latestTextTurnId ? onRegenerate : undefined
                  }
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

      {!stickToBottom ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scroll to latest messages"
          onPress={() => {
            enableStickToBottom();
            scrollToBottom(true);
          }}
          style={({ pressed }) => [
            styles.jumpFab,
            pressed && styles.jumpFabPressed,
          ]}
        >
          <ArrowDownIcon size={18} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      flex: 1,
      position: 'relative',
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 16,
      // Extra room so the last lines / actions clear the composer edge.
      paddingBottom: 24,
      gap: 12,
    },
    jumpFab: {
      position: 'absolute',
      bottom: 12,
      left: '50%',
      marginLeft: -18,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    jumpFabPressed: {
      opacity: 0.85,
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
    attachmentChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 8,
    },
    attachmentChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: 160,
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.15)',
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    attachmentThumb: {
      width: 28,
      height: 28,
      borderRadius: 4,
    },
    attachmentChipText: {
      flexShrink: 1,
      color: colors.white,
      fontSize: 12,
      fontFamily: colors.fontFamily,
    },
    assistantBubble: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderBottomLeftRadius: 4,
    },
    streamingBubble: {
      opacity: 0.95,
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
