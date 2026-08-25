import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
import { useAgentSession } from '../hooks/useAgentSession';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useTheme } from '../hooks/useTheme';
import { useCreateNoteMutation } from '../hooks/useNotes';
import { useVoiceSession } from '../hooks/useVoiceSession';
import {
  assertAttachmentBudget,
  displayUserContent,
  MAX_CHAT_ATTACHMENTS,
  pickDocumentForChat,
  pickPhotoForChat,
  type ChatAttachmentPayload,
  type PendingAttachment,
} from '../lib/chatAttachments';
import {
  getStoredComposerMode,
  storeComposerMode,
  type ComposerMode,
} from '../lib/composerMode';
import {
  chatPhaseLabel,
  coerceChatPhase,
  isGeneratingPhase,
} from '../lib/chatPhaseLabel';
import {
  DONNA_THINKING_PHASE,
  isDonnaThinkingPhase,
} from '../lib/thinkingPhrases';
import { AgentDetail, createAgentStyles } from './AgentsScreen';
import type { ThemeColors } from '../theme/colors';
import { listSkills, type Skill } from '../services/skillsApi';
import { isApprovalPause } from '../lib/agentTurns';
import {
  streamChatMessage,
  type ChatStreamHandle,
  type ChatTurnMessage,
} from '../services/chatApi';
import {
  submitTurnFeedback,
  truncateConversationTurns,
} from '../services/conversationsApi';
import { newNoteId } from '../services/notesApi';

const QUICK_ACTIONS = [
  {
    label: 'What do you remember?',
    prompt: 'What do you remember about me?',
  },
  {
    label: 'Catch me up',
    prompt: 'Catch me up from my notes and recent conversations.',
  },
  {
    label: 'Continue last chat',
    prompt: 'Continue where we left off.',
  },
] as const;

type Props = {
  onOpenProfile: () => void;
  onOpenNote?: (noteId: string) => void;
  onToast?: (message: string, isError?: boolean) => void;
  pendingAgentRunId?: string | null;
  pendingAgentSkill?: string | null;
  onPendingAgentConsumed?: () => void;
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
  onOpenProfile,
  onOpenNote,
  onToast,
  pendingAgentRunId,
  pendingAgentSkill,
  onPendingAgentConsumed,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const agentStyles = useThemedStyles(createAgentStyles);
  const createNoteMutation = useCreateNoteMutation();
  const [textMessages, setTextMessages] = useState<ChatTurn[]>([]);
  const [textSessionId, setTextSessionId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [streamHasText, setStreamHasText] = useState(false);
  const [textPhase, setTextPhase] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<ComposerMode>('chat');
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const isAgent = composerMode === 'agent';
  const agent = useAgentSession(isAgent);
  const composerModeRef = useRef(composerMode);
  composerModeRef.current = composerMode;
  const agentSendRef = useRef(agent.handleSend);
  agentSendRef.current = agent.handleSend;
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [pickerSkills, setPickerSkills] = useState<Skill[]>([]);
  const streamAbortRef = useRef<(() => void) | null>(null);
  const textMessagesRef = useRef(textMessages);
  const textSessionIdRef = useRef(textSessionId);
  const isSendingRef = useRef(isSending);
  const pendingChunkRef = useRef<string | null>(null);
  const chunkRafRef = useRef<number | null>(null);
  const streamingTurnIdRef = useRef<string | null>(null);
  const streamHasTextRef = useRef(false);
  const sendFromVoiceRef = useRef<(text: string) => void>(() => {});

  textMessagesRef.current = textMessages;
  textSessionIdRef.current = textSessionId;
  isSendingRef.current = isSending;
  streamHasTextRef.current = streamHasText;

  const {
    state: micState,
    toggleTalk,
    phaseLabel: voicePhaseLabel,
    sessionLabel,
    errorMsg: voiceError,
    disabled: micDisabled,
    sessionActive: voiceSessionActive,
  } = useVoiceSession({
    onTranscript: text => {
      sendFromVoiceRef.current(text);
    },
  });

  const messages = textMessages;
  const hasChatThread = messages.length > 0;
  const hasAgentThread = Boolean(agent.active);
  const hasThread = isAgent ? hasAgentThread : hasChatThread;
  const sessionActive = voiceSessionActive || micState === 'requesting';
  const composerBusy = isAgent ? agent.busy : isSending;
  const composerError = isAgent ? agent.error : textError;

  const actionableTurnIds = useMemo(
    () => new Set(textMessages.map(t => t.id)),
    [textMessages],
  );

  const displayPhase =
    textPhase ??
    (isSending && !streamHasText ? DONNA_THINKING_PHASE : voicePhaseLabel);

  function cancelChunkRaf() {
    if (chunkRafRef.current != null) {
      cancelAnimationFrame(chunkRafRef.current);
      chunkRafRef.current = null;
    }
  }

  function flushPendingChunk() {
    cancelChunkRaf();
    const turnId = streamingTurnIdRef.current;
    const replyText = pendingChunkRef.current;
    if (!turnId || replyText == null) {
      return;
    }
    pendingChunkRef.current = null;
    setTextMessages(prev =>
      prev.map(t =>
        t.id === turnId
          ? {
              ...t,
              assistant: replyText,
              streaming: true,
              error: false,
              cancelled: false,
            }
          : t,
      ),
    );
  }

  function scheduleChunk(turnId: string, replyText: string) {
    streamingTurnIdRef.current = turnId;
    pendingChunkRef.current = replyText;
    if (!streamHasTextRef.current) {
      streamHasTextRef.current = true;
      setStreamHasText(true);
    }
    if (chunkRafRef.current != null) {
      return;
    }
    chunkRafRef.current = requestAnimationFrame(() => {
      chunkRafRef.current = null;
      flushPendingChunk();
    });
  }

  async function runStream(
    trimmed: string,
    history: ChatTurnMessage[],
    turnId: string,
    sessionId: string | null,
    attachments?: ChatAttachmentPayload[],
    webSearch?: boolean,
  ) {
    setTextError(null);
    setStreamHasText(false);
    streamHasTextRef.current = false;
    setTextPhase(DONNA_THINKING_PHASE);
    setIsSending(true);
    streamingTurnIdRef.current = turnId;
    pendingChunkRef.current = null;
    cancelChunkRaf();
    const startedAt = performance.now();
    let recordedFirstToken = false;

    let handle: ChatStreamHandle | null = null;
    try {
      handle = streamChatMessage(
        {
          message: trimmed,
          history,
          sessionId: sessionId ?? undefined,
          attachments,
          webSearch,
        },
        {
          onSession: nextSessionId => {
            setTextSessionId(nextSessionId);
          },
          onPhase: (phase, meta) => {
            const label = chatPhaseLabel(phase, meta?.host);
            if (label) {
              setTextPhase(label);
              return;
            }
            const raw = coerceChatPhase(phase, meta?.host)?.phase;
            if (
              !streamHasTextRef.current &&
              (isGeneratingPhase(phase) || raw === 'thinking')
            ) {
              setTextPhase(DONNA_THINKING_PHASE);
              return;
            }
            if (raw === 'idle' || raw === 'done') {
              setTextPhase(null);
            }
          },
          onChunk: replyText => {
            setTextPhase(null);
            if (!recordedFirstToken && replyText) {
              recordedFirstToken = true;
              const firstTokenMs = Math.round(performance.now() - startedAt);
              setTextMessages(prev =>
                prev.map(t =>
                  t.id === turnId && t.firstTokenMs == null
                    ? { ...t, firstTokenMs }
                    : t,
                ),
              );
            }
            scheduleChunk(turnId, replyText);
          },
          onCitations: citations => {
            setTextMessages(prev =>
              prev.map(t => (t.id === turnId ? { ...t, citations } : t)),
            );
          },
          onDone: result => {
            flushPendingChunk();
            const totalMs = Math.round(performance.now() - startedAt);
            setTextSessionId(result.sessionId);
            setTextMessages(prev =>
              prev.map(t =>
                t.id === turnId
                  ? {
                      ...t,
                      assistant: result.reply || t.assistant,
                      historyUser: result.groundedUserMessage ?? t.historyUser,
                      streaming: false,
                      error: false,
                      cancelled: Boolean(result.aborted),
                      citations: result.citations ?? t.citations,
                      totalMs,
                    }
                  : t,
              ),
            );
          },
          onError: message => {
            cancelChunkRaf();
            pendingChunkRef.current = null;
            setTextError(message);
            setTextMessages(prev =>
              prev.map(t =>
                t.id === turnId
                  ? {
                      ...t,
                      error: true,
                      cancelled: false,
                      streaming: false,
                      totalMs: Math.round(performance.now() - startedAt),
                    }
                  : t,
              ),
            );
          },
        },
      );
      streamAbortRef.current = handle.abort;
      await handle.promise;
    } catch (err) {
      cancelChunkRaf();
      pendingChunkRef.current = null;
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to send message. Please try again.';
      setTextError(message);
      setTextMessages(prev =>
        prev.map(t =>
          t.id === turnId
            ? {
                ...t,
                error: true,
                cancelled: false,
                streaming: false,
                totalMs: Math.round(performance.now() - startedAt),
              }
            : t,
        ),
      );
    } finally {
      streamAbortRef.current = null;
      streamingTurnIdRef.current = null;
      setTextPhase(null);
      setIsSending(false);
    }
  }

  async function handleSend(
    text: string,
    attachments: PendingAttachment[] = [],
    options?: { webSearch?: boolean },
  ) {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || isSendingRef.current) {
      return;
    }

    const turnId = `text-${Date.now()}`;
    const history = historyFromTurns(textMessagesRef.current);
    const payloads = attachments.map(a => a.payload);
    const labels = attachments.map(a => a.filename);
    const turnAttachments = attachments.map(a => ({
      id: a.id,
      filename: a.filename,
      previewUri: a.previewUri,
      mime: a.mime,
    }));

    setTextMessages(prev => [
      ...prev,
      {
        id: turnId,
        user: displayUserContent(trimmed, attachments),
        assistant: null,
        streaming: true,
        attachmentLabels: labels.length > 0 ? labels : undefined,
        attachments: turnAttachments.length > 0 ? turnAttachments : undefined,
      },
    ]);
    setPendingAttachments([]);

    await runStream(
      trimmed,
      history,
      turnId,
      textSessionIdRef.current,
      payloads.length > 0 ? payloads : undefined,
      options?.webSearch,
    );
  }

  sendFromVoiceRef.current = (text: string) => {
    if (composerModeRef.current === 'agent') {
      void agentSendRef.current(text);
      return;
    }
    void handleSend(text);
  };

  useEffect(() => {
    void getStoredComposerMode().then(setComposerMode);
  }, []);

  function handleModeChange(next: ComposerMode) {
    setComposerMode(next);
    void storeComposerMode(next);
  }

  useEffect(() => {
    if (!pendingAgentRunId) {
      return;
    }
    handleModeChange('agent');
    agent.setSelectedId(pendingAgentRunId);
    onPendingAgentConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAgentRunId]);

  useEffect(() => {
    if (!pendingAgentSkill) {
      return;
    }
    handleModeChange('agent');
    agent.handleNewRun();
    agent.setSelectedSkills([pendingAgentSkill]);
    onPendingAgentConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAgentSkill]);

  function handleStop() {
    flushPendingChunk();
    streamAbortRef.current?.();
  }

  async function addPending(att: PendingAttachment | null) {
    if (!att) return;
    await addPendingMany([att]);
  }

  async function addPendingMany(atts: PendingAttachment[]) {
    if (atts.length === 0) return;
    try {
      assertAttachmentBudget(pendingAttachments.length, atts.length);
      setPendingAttachments(prev => [...prev, ...atts]);
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
            void pickPhotoForChat(
              MAX_CHAT_ATTACHMENTS - pendingAttachments.length,
            )
              .then(addPendingMany)
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
            void pickPhotoForChat(
              MAX_CHAT_ATTACHMENTS - pendingAttachments.length,
            )
              .then(addPendingMany)
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
      {
        id: turnId,
        user: last.user,
        assistant: null,
        streaming: true,
        attachmentLabels: last.attachmentLabels,
        attachments: last.attachments,
      },
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
      { id: newTurnId, user: trimmed, assistant: null, streaming: true },
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
      {
        id: turnId,
        user: last.user,
        assistant: null,
        streaming: true,
        error: false,
        attachmentLabels: last.attachmentLabels,
        attachments: last.attachments,
      },
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
    conversationId: string,
    sessionId: string | undefined,
    resumedMessages: ChatTurn[],
  ) {
    handleModeChange('chat');
    streamAbortRef.current?.();
    cancelChunkRaf();
    pendingChunkRef.current = null;
    setActiveConversationId(conversationId);
    setTextMessages(resumedMessages);
    setTextSessionId(sessionId ?? null);
    setTextError(null);
    setTextPhase(null);
    setIsSending(false);
    setStreamHasText(false);
  }

  function handleNewChat() {
    if (composerModeRef.current === 'agent') {
      agent.handleNewRun();
      return;
    }
    streamAbortRef.current?.();
    cancelChunkRaf();
    pendingChunkRef.current = null;
    setTextMessages([]);
    setTextSessionId(null);
    setActiveConversationId(null);
    setTextError(null);
    setTextPhase(null);
    setIsSending(false);
    setStreamHasText(false);
  }

  const agentPlaceholder = !agent.active
    ? 'Describe a cloud agent goal…'
    : isApprovalPause(agent.active.result)
      ? 'Tell Donna what to change…'
      : agent.waitingWithOptions
        ? agent.allowMultiple
          ? 'Optional note to add with your selection…'
          : 'Or type a different answer…'
        : agent.needsReply
          ? 'Write your answer…'
          : 'Add a follow-up or correction…';

  return (
    <View style={styles.container}>
      <AppHeader
        title={isAgent ? 'Agent' : 'Chat'}
        onAvatarPress={onOpenProfile}
        onHistoryPress={() => setHistoryOpen(true)}
        onNewChatPress={handleNewChat}
      />

      <View style={styles.main}>
        {isAgent ? (
          agent.active ? (
            <AgentDetail
              run={agent.active}
              steps={agent.steps}
              busy={agent.busy}
              error={null}
              reply=""
              onChangeReply={() => {}}
              onCancel={() => void agent.onCancel(agent.active!.id)}
              onFinish={() => void agent.onFinish(agent.active!.id)}
              onReply={message =>
                void agent.replyToRun(agent.active!.id, message)
              }
              selectedOptions={agent.selectedOptions}
              onToggleOption={agent.toggleOption}
              embedded
              styles={agentStyles}
              colors={colors}
            />
          ) : (
            <ChatHero
              micState={micState}
              onMicPress={() => void toggleTalk()}
              micDisabled={micDisabled}
              showMic
              sessionLabel={
                agent.busy ? DONNA_THINKING_PHASE : sessionLabel
              }
              title="Start a cloud agent goal…"
              description="Background goals on Donna cloud — your phone can lock while it works."
            />
          )
        ) : (
          <>
            {hasChatThread ? (
              <ChatMessages
                turns={messages}
                phaseLabel={displayPhase}
                busy={isSending}
                actionableTurnIds={actionableTurnIds}
                onCopyMessage={handleCopy}
                onRegenerate={() => void handleRegenerate()}
                onEditMessage={(id, text) => void handleEditAndResend(id, text)}
                onFeedback={(id, rating) => void handleFeedback(id, rating)}
                onSaveAsNote={async content => {
                  try {
                    await createNoteMutation.mutateAsync({
                      content,
                      id: newNoteId(),
                    });
                    onToast?.('Saved to Notes', false);
                  } catch (err: unknown) {
                    onToast?.(
                      err instanceof Error ? err.message : 'Could not save note',
                      true,
                    );
                    throw err;
                  }
                }}
                onRetry={() => void handleRetry()}
                onOpenNote={onOpenNote}
              />
            ) : null}

            <ChatHero
              micState={micState}
              onMicPress={() => void toggleTalk()}
              micDisabled={micDisabled}
              compact={hasChatThread}
              showMic={!hasChatThread}
              sessionLabel={hasChatThread ? null : sessionLabel}
            />
          </>
        )}

        {composerError || voiceError ? (
          <View style={styles.errorRow}>
            <Text style={styles.error} accessibilityRole="alert">
              {composerError ?? voiceError}
            </Text>
            {!isAgent && textError ? (
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

      {isAgent && agent.selectedSkills.length > 0 ? (
        <View style={styles.skillRow}>
          <Text style={styles.skillHint}>Using skill:</Text>
          {agent.selectedSkills.map(name => (
            <Pressable
              key={name}
              onPress={() => agent.setSelectedSkills([])}
              style={styles.skillChip}
            >
              <Text style={styles.skillChipText}>{name} ×</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <ChatInput
        onSend={(text, attachments, options) => {
          if (composerModeRef.current === 'agent') {
            void agent.handleSend(text, attachments);
            return;
          }
          void handleSend(text, attachments, options);
        }}
        onStop={isAgent ? undefined : handleStop}
        onAttachPress={handleAttachPress}
        attachments={pendingAttachments}
        onRemoveAttachment={id =>
          setPendingAttachments(prev => prev.filter(a => a.id !== id))
        }
        disabled={micDisabled || composerBusy || sessionActive}
        busy={composerBusy}
        placeholder={isAgent ? agentPlaceholder : 'Message Donna…'}
        showMic={hasThread}
        micState={micState}
        onMicPress={() => void toggleTalk()}
        micDisabled={micDisabled || (isAgent && agent.busy)}
        sessionLabel={
          hasThread && sessionLabel && !isDonnaThinkingPhase(sessionLabel)
            ? sessionLabel
            : isAgent && agent.busy
              ? DONNA_THINKING_PHASE
              : null
        }
        showWebSearch={!isAgent}
        allowEmptySend={isAgent && agent.allowEmptySend}
        mode={composerMode}
        onModeChange={handleModeChange}
        onSkillsPress={
          isAgent && !agent.active
            ? () => {
                setSkillsOpen(true);
                void listSkills()
                  .then(setPickerSkills)
                  .catch(() => setPickerSkills([]));
              }
            : undefined
        }
        skillsSelected={agent.selectedSkills.length}
        onSendToAgent={(text, attachments) => {
          handleModeChange('agent');
          agent.handleNewRun();
          void agent.createRun(text, attachments);
        }}
        quickActions={
          !isAgent && !hasChatThread && !isSending && !sessionActive
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
        selectedChatId={isAgent ? null : activeConversationId}
        selectedAgentId={isAgent ? agent.selectedId : null}
        onResume={handleResumeConversation}
        onSelectAgent={run => {
          handleModeChange('agent');
          agent.setSelectedId(run.id);
        }}
      />

      <Modal
        visible={skillsOpen}
        animationType="slide"
        onRequestClose={() => setSkillsOpen(false)}
      >
        <View style={styles.skillSheet}>
          <View style={styles.skillSheetHeader}>
            <Text style={styles.skillSheetTitle}>Skills for this run</Text>
            <Pressable onPress={() => setSkillsOpen(false)}>
              <Text style={styles.retryLink}>Done</Text>
            </Pressable>
          </View>
          <ScrollView>
            {pickerSkills.length === 0 ? (
              <Text style={styles.skillHint}>
                No skills yet. Add one in Profile → Skills.
              </Text>
            ) : (
              pickerSkills.map(skill => {
                const on = agent.selectedSkills.includes(skill.name);
                return (
                  <Pressable
                    key={skill.id ?? skill.name}
                    style={styles.skillOption}
                    onPress={() => {
                      agent.setSelectedSkills(
                        on
                          ? agent.selectedSkills.filter(n => n !== skill.name)
                          : [...agent.selectedSkills, skill.name],
                      );
                    }}
                  >
                    <Text style={styles.skillOptionTitle}>
                      {on ? '✓ ' : ''}
                      {skill.name}
                    </Text>
                    {skill.description ? (
                      <Text style={styles.skillHint}>{skill.description}</Text>
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>
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
    skillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 4,
    },
    skillHint: {
      fontSize: 12,
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    skillChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.surface,
    },
    skillChipText: {
      fontSize: 12,
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    skillSheet: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: 56,
      paddingHorizontal: 20,
    },
    skillSheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    skillSheetTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    skillOption: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 4,
    },
    skillOptionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
  });
}
