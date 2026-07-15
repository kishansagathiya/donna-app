import React, { useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Text } from '../components/ThemedText';
import { AppHeader } from '../components/AppHeader';
import { ChatHero } from '../components/ChatHero';
import { ChatHistorySheet } from '../components/ChatHistorySheet';
import { ChatInput } from '../components/ChatInput';
import { ChatMessages, type ChatTurn } from '../components/ChatMessages';
import type { MicState } from '../components/MicButton';
import { useThemedStyles } from '../hooks/useThemedStyles';
import {
  assertAttachmentBudget,
  displayUserContent,
  pickDocumentForChat,
  pickPhotoForChat,
  type ChatAttachmentPayload,
  type PendingAttachment,
} from '../lib/chatAttachments';
import {
  DONNA_THINKING_PHASE,
  isDonnaThinkingPhase,
} from '../lib/thinkingPhrases';
import type { ThemeColors } from '../theme/colors';
import {
  streamChatMessage,
  type ChatStreamHandle,
  type ChatTurnMessage,
} from '../services/chatApi';
import {
  submitTurnFeedback,
  truncateConversationTurns,
} from '../services/conversationsApi';

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
  onClearVoiceChat?: () => void;
  onToast?: (message: string, isError?: boolean) => void;
};

function historyFromTurns(turns: ChatTurn[]): ChatTurnMessage[] {
  const history: ChatTurnMessage[] = [];
  for (const turn of turns) {
    if (turn.user) {
      history.push({
        role: 'user',
        content: turn.historyUser ?? turn.user,
      });
    }
    if (turn.assistant) {
      history.push({ role: 'assistant', content: turn.assistant });
    }
  }
  return history;
}

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
  onClearVoiceChat,
  onToast,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const [textMessages, setTextMessages] = useState<ChatTurn[]>([]);
  const [textSessionId, setTextSessionId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [streamHasText, setStreamHasText] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const streamAbortRef = useRef<(() => void) | null>(null);
  const textMessagesRef = useRef(textMessages);
  const textSessionIdRef = useRef(textSessionId);
  const isSendingRef = useRef(isSending);

  textMessagesRef.current = textMessages;
  textSessionIdRef.current = textSessionId;
  isSendingRef.current = isSending;

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

  async function runStream(
    trimmed: string,
    history: ChatTurnMessage[],
    turnId: string,
    sessionId: string | null,
    attachments?: ChatAttachmentPayload[],
  ) {
    setTextError(null);
    setStreamHasText(false);
    setIsSending(true);

    let handle: ChatStreamHandle | null = null;
    try {
      handle = streamChatMessage(
        {
          message: trimmed,
          history,
          sessionId: sessionId ?? undefined,
          attachments,
        },
        {
          onSession: nextSessionId => {
            setTextSessionId(nextSessionId);
          },
          onChunk: replyText => {
            setStreamHasText(true);
            setTextMessages(prev =>
              prev.map(t =>
                t.id === turnId
                  ? {
                      ...t,
                      assistant: replyText,
                      error: false,
                      cancelled: false,
                    }
                  : t,
              ),
            );
          },
          onCitations: citations => {
            setTextMessages(prev =>
              prev.map(t => (t.id === turnId ? { ...t, citations } : t)),
            );
          },
          onDone: result => {
            setTextSessionId(result.sessionId);
            setTextMessages(prev =>
              prev.map(t =>
                t.id === turnId
                  ? {
                      ...t,
                      assistant: result.reply || t.assistant,
                      historyUser: result.groundedUserMessage ?? t.historyUser,
                      error: false,
                      cancelled: Boolean(result.aborted),
                      citations: result.citations ?? t.citations,
                    }
                  : t,
              ),
            );
          },
          onError: message => {
            setTextError(message);
            setTextMessages(prev =>
              prev.map(t =>
                t.id === turnId ? { ...t, error: true, cancelled: false } : t,
              ),
            );
          },
        },
      );
      streamAbortRef.current = handle.abort;
      await handle.promise;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to send message. Please try again.';
      setTextError(message);
      setTextMessages(prev =>
        prev.map(t =>
          t.id === turnId ? { ...t, error: true, cancelled: false } : t,
        ),
      );
    } finally {
      streamAbortRef.current = null;
      setIsSending(false);
    }
  }

  async function handleSend(
    text: string,
    attachments: PendingAttachment[] = [],
  ) {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || isSendingRef.current) {
      return;
    }

    const turnId = `text-${Date.now()}`;
    const history = historyFromTurns(textMessagesRef.current);
    const payloads = attachments.map(a => a.payload);
    const labels = attachments.map(a => a.filename);

    setTextMessages(prev => [
      ...prev,
      {
        id: turnId,
        user: displayUserContent(trimmed, attachments),
        assistant: null,
        attachmentLabels: labels.length > 0 ? labels : undefined,
      },
    ]);
    setPendingAttachments([]);

    await runStream(
      trimmed,
      history,
      turnId,
      textSessionIdRef.current,
      payloads.length > 0 ? payloads : undefined,
    );
  }

  function handleStop() {
    streamAbortRef.current?.();
  }

  async function addPending(att: PendingAttachment | null) {
    if (!att) return;
    try {
      assertAttachmentBudget(pendingAttachments.length, 1);
      setPendingAttachments(prev => [...prev, att]);
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Could not attach', true);
    }
  }

  function handleAttachPress() {
    const options = [
      'Attach file to message',
      'Attach photo to message',
      'Cancel',
    ];
    const cancelButtonIndex = options.length - 1;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          title: 'Attach',
          message: 'Attach a file or photo for this chat turn only.',
        },
        buttonIndex => {
          if (buttonIndex === 0) {
            void pickDocumentForChat()
              .then(addPending)
              .catch(err =>
                onToast?.(
                  err instanceof Error ? err.message : 'Could not attach file',
                  true,
                ),
              );
          } else if (buttonIndex === 1) {
            void pickPhotoForChat()
              .then(addPending)
              .catch(err =>
                onToast?.(
                  err instanceof Error ? err.message : 'Could not attach photo',
                  true,
                ),
              );
          }
        },
      );
      return;
    }

    Alert.alert(
      'Attach',
      'Attach a file or photo for this chat turn only.',
      [
        {
          text: 'Attach file to message',
          onPress: () => {
            void pickDocumentForChat()
              .then(addPending)
              .catch(err =>
                onToast?.(
                  err instanceof Error ? err.message : 'Could not attach file',
                  true,
                ),
              );
          },
        },
        {
          text: 'Attach photo to message',
          onPress: () => {
            void pickPhotoForChat()
              .then(addPending)
              .catch(err =>
                onToast?.(
                  err instanceof Error ? err.message : 'Could not attach photo',
                  true,
                ),
              );
          },
        },
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  }

  async function handleRegenerate() {
    if (isSendingRef.current) return;

    const current = textMessagesRef.current;
    if (current.length === 0) return;

    const last = current[current.length - 1];
    if (!last?.user) return;

    const turnIndex = current.length - 1;
    const sessionId = textSessionIdRef.current;
    if (sessionId) {
      try {
        await truncateConversationTurns(sessionId, turnIndex);
      } catch (err) {
        setTextError(
          err instanceof Error ? err.message : 'Failed to regenerate',
        );
        return;
      }
    }

    const kept = current.slice(0, -1);
    const history = historyFromTurns(kept);
    const turnId = `text-${Date.now()}`;

    setTextMessages([
      ...kept,
      { id: turnId, user: last.user, assistant: null, attachmentLabels: last.attachmentLabels },
    ]);

    await runStream(
      last.historyUser ?? last.user,
      history,
      turnId,
      sessionId,
    );
  }

  async function handleEditAndResend(turnId: string, nextText: string) {
    const trimmed = nextText.trim();
    if (!trimmed || isSendingRef.current) return;

    const current = textMessagesRef.current;
    const index = current.findIndex(t => t.id === turnId);
    if (index < 0) return;

    const sessionId = textSessionIdRef.current;
    if (sessionId) {
      try {
        await truncateConversationTurns(sessionId, index);
      } catch (err) {
        setTextError(
          err instanceof Error ? err.message : 'Failed to edit message',
        );
        return;
      }
    }

    const kept = current.slice(0, index);
    const history = historyFromTurns(kept);
    const newTurnId = `text-${Date.now()}`;

    setTextMessages([
      ...kept,
      { id: newTurnId, user: trimmed, assistant: null },
    ]);

    await runStream(trimmed, history, newTurnId, sessionId);
  }

  async function handleRetry() {
    if (isSendingRef.current) return;

    const current = textMessagesRef.current;
    const last = current[current.length - 1];
    if (!last?.user) return;

    const sessionId = textSessionIdRef.current;
    const turnIndex = current.length - 1;
    if (sessionId) {
      try {
        await truncateConversationTurns(sessionId, turnIndex);
      } catch {
        // Best-effort for never-persisted failures.
      }
    }

    const kept = current.slice(0, -1);
    const history = historyFromTurns(kept);
    const turnId = `text-${Date.now()}`;

    setTextMessages([
      ...kept,
      { id: turnId, user: last.user, assistant: null, error: false, attachmentLabels: last.attachmentLabels },
    ]);
    setTextError(null);

    await runStream(
      last.historyUser ?? last.user,
      history,
      turnId,
      sessionId,
    );
  }

  async function handleFeedback(turnId: string, rating: 'up' | 'down') {
    const current = textMessagesRef.current;
    const index = current.findIndex(t => t.id === turnId);
    const sessionId = textSessionIdRef.current;
    if (index < 0 || !sessionId) return;

    setTextMessages(prev =>
      prev.map(t => (t.id === turnId ? { ...t, feedback: rating } : t)),
    );

    try {
      await submitTurnFeedback(sessionId, index, rating);
    } catch {
      setTextMessages(prev =>
        prev.map(t =>
          t.id === turnId ? { ...t, feedback: undefined } : t,
        ),
      );
    }
  }

  function handleCopy(content: string) {
    try {
      Clipboard.setString(content);
      onToast?.('Copied', false);
    } catch {
      onToast?.('Could not copy', true);
    }
  }

  function handleResumeConversation(
    sessionId: string | undefined,
    resumedMessages: ChatTurn[],
  ) {
    streamAbortRef.current?.();
    setTextMessages(resumedMessages);
    setTextSessionId(sessionId ?? null);
    setTextError(null);
    setIsSending(false);
    setStreamHasText(false);
  }

  function handleNewChat() {
    streamAbortRef.current?.();
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
            busy={isSending}
            actionableTurnIds={new Set(textMessages.map(t => t.id))}
            onCopyMessage={handleCopy}
            onRegenerate={() => void handleRegenerate()}
            onEditMessage={(id, text) => void handleEditAndResend(id, text)}
            onFeedback={(id, rating) => void handleFeedback(id, rating)}
            onRetry={() => void handleRetry()}
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

        {textError || errorMsg ? (
          <View style={styles.errorRow}>
            <Text style={styles.error} accessibilityRole="alert">
              {textError ?? errorMsg}
            </Text>
            {textError ? (
              <Pressable
                onPress={() => void handleRetry()}
                accessibilityRole="button"
                accessibilityLabel="Retry"
              >
                <Text style={styles.retryLink}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <ChatInput
        onSend={(text, attachments) => void handleSend(text, attachments)}
        onStop={handleStop}
        onAttachPress={handleAttachPress}
        attachments={pendingAttachments}
        onRemoveAttachment={id =>
          setPendingAttachments(prev => prev.filter(a => a.id !== id))
        }
        disabled={micDisabled || isSending}
        busy={isSending}
        placeholder="Message Donna…"
        showMic={hasMessages}
        micState={micState}
        onMicPress={onMicPress}
        micDisabled={micDisabled}
        sessionLabel={
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
    errorRow: {
      paddingHorizontal: 24,
      paddingBottom: 8,
      alignItems: 'center',
      gap: 6,
    },
    error: {
      color: colors.destructive,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      fontFamily: colors.fontFamily,
    },
    retryLink: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
      fontFamily: colors.fontFamily,
    },
  });
}
