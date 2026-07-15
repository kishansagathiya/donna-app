import React, { useState } from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../components/ThemedText';
import { AppHeader } from '../components/AppHeader';
import { ChatHero } from '../components/ChatHero';
import { ChatHistorySheet } from '../components/ChatHistorySheet';
import { ChatInput } from '../components/ChatInput';
import { ChatMessages, type ChatTurn } from '../components/ChatMessages';
import type { MicState } from '../components/MicButton';
import { useThemedStyles } from '../hooks/useThemedStyles';
import {
  DONNA_THINKING_PHASE,
  isDonnaThinkingPhase,
} from '../lib/thinkingPhrases';
import type { ThemeColors } from '../theme/colors';
import {
  streamChatMessage,
  type ChatTurnMessage,
} from '../services/chatApi';

const QUICK_ACTIONS = [
  { label: 'Summarize PDF', prompt: 'Summarize the PDF I shared' },
  { label: 'Debug code', prompt: 'Help me debug this code' },
  { label: 'Draft email', prompt: 'Help me draft an email' },
] as const;

type Props = {
  micState: MicState;
  onMicPress: () => void;
  micDisabled?: boolean;
  turns: ChatTurn[];
  liveTranscript?: string | null;
  liveReply?: string | null;
  phaseLabel?: string | null;
  sessionLabel?: string | null;
  errorMsg?: string | null;
  onOpenProfile: () => void;
  onAttachPress: () => void;
  onClearVoiceChat?: () => void;
};

export function ChatScreen({
  micState,
  onMicPress,
  micDisabled,
  turns,
  liveTranscript,
  liveReply,
  phaseLabel,
  sessionLabel,
  errorMsg,
  onOpenProfile,
  onAttachPress,
  onClearVoiceChat,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const [textMessages, setTextMessages] = useState<ChatTurn[]>([]);
  const [textSessionId, setTextSessionId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [streamHasText, setStreamHasText] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const messages: ChatTurn[] = [...textMessages, ...turns];

  if (liveTranscript || liveReply) {
    messages.push({
      id: 'live',
      user: liveTranscript ?? '',
      assistant: liveReply ?? null,
    });
  }

  const hasMessages = messages.length > 0;
  const sessionActive =
    micState === 'listening' ||
    micState === 'processing' ||
    micState === 'requesting';

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) {
      return;
    }

    setTextError(null);
    setStreamHasText(false);
    const turnId = `text-${textMessages.length}`;

    setTextMessages(prev => [
      ...prev,
      { id: turnId, user: trimmed, assistant: null },
    ]);
    setIsSending(true);

    const history: ChatTurnMessage[] = [];
    for (const turn of textMessages) {
      if (turn.user) {
        history.push({ role: 'user', content: turn.user });
      }
      if (turn.assistant) {
        history.push({ role: 'assistant', content: turn.assistant });
      }
    }

    try {
      await streamChatMessage(
        {
          message: trimmed,
          history,
          sessionId: textSessionId ?? undefined,
        },
        {
          onSession: sessionId => {
            setTextSessionId(sessionId);
          },
          onChunk: replyText => {
            setStreamHasText(true);
            setTextMessages(prev =>
              prev.map(t =>
                t.id === turnId ? { ...t, assistant: replyText } : t,
              ),
            );
          },
          onDone: result => {
            setTextSessionId(result.sessionId);
            setTextMessages(prev =>
              prev.map(t =>
                t.id === turnId ? { ...t, assistant: result.reply } : t,
              ),
            );
          },
          onError: message => {
            setTextError(message);
          },
        },
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to send message. Please try again.';
      setTextError(message);
    } finally {
      setIsSending(false);
    }
  }

  function handleResumeConversation(
    sessionId: string | undefined,
    resumedMessages: ChatTurn[],
  ) {
    setTextMessages(resumedMessages);
    setTextSessionId(sessionId ?? null);
    setTextError(null);
    setIsSending(false);
    setStreamHasText(false);
  }

  function handleNewChat() {
    setTextMessages([]);
    setTextSessionId(null);
    setTextError(null);
    setIsSending(false);
    setStreamHasText(false);
    onClearVoiceChat?.();
  }

  return (
    <View style={styles.container}>
      <AppHeader
        onAvatarPress={onOpenProfile}
        onHistoryPress={() => setHistoryOpen(true)}
        onNewChatPress={handleNewChat}
      />

      <View style={styles.main}>
        {hasMessages ? (
          <ChatMessages
            turns={messages}
            phaseLabel={
              isSending && !streamHasText ? DONNA_THINKING_PHASE : phaseLabel
            }
          />
        ) : null}

        <ChatHero
          micState={micState}
          onMicPress={onMicPress}
          micDisabled={micDisabled}
          compact={hasMessages}
          showMic={!hasMessages}
          sessionLabel={hasMessages ? null : sessionLabel}
        />

        {(textError || errorMsg) ? (
          <Text style={styles.error} accessibilityRole="alert">
            {textError ?? errorMsg}
          </Text>
        ) : null}
      </View>

      <ChatInput
        onSend={handleSend}
        onAttachPress={onAttachPress}
        disabled={micDisabled || isSending}
        showMic={hasMessages}
        micState={micState}
        onMicPress={onMicPress}
        micDisabled={micDisabled}
        sessionLabel={
          // Thinking status already renders in ChatMessages; avoid a duplicate
          // "Donna is …" line above the input.
          hasMessages && !isDonnaThinkingPhase(sessionLabel)
            ? sessionLabel
            : null
        }
        quickActions={
          !hasMessages && !isSending && !sessionActive
            ? QUICK_ACTIONS.map(action => ({
                label: action.label,
                onPress: () => void handleSend(action.prompt),
              }))
            : undefined
        }
      />

      <ChatHistorySheet
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onResume={handleResumeConversation}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    main: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    error: {
      paddingHorizontal: 24,
      paddingBottom: 8,
      color: colors.destructive,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      fontFamily: colors.fontFamily,
    },
  });
}
