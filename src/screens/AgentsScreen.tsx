import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { MessageContent } from '../components/MessageContent';
import { Text } from '../components/ThemedText';
import { CheckIcon, StopIcon } from '../components/icons';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useTheme } from '../hooks/useTheme';
import {
  buildAgentTurns,
  canReply,
  isActiveStatus,
  parseOptions,
  stepBody,
  stepTitle,
  upsertAgentRun,
  type AgentStepLike,
  type AgentTurn,
  type AskOption,
} from '../lib/agentTurns';
import {
  cancelAgentRun,
  createAgentRun,
  createAgentRunShare,
  finishAgentRun,
  listAgentRuns,
  listAgentSteps,
  redirectAgentRun,
  revokeAgentRunShare,
  type AgentRun,
  type AgentStep,
} from '../services/agentsApi';
import type { ThemeColors } from '../theme/colors';

type Props = {
  isVisible: boolean;
};

function statusLabel(status: string) {
  return status === 'waiting_for_user' ? 'needs reply' : status;
}

function isOpenStatus(status: string) {
  return (
    status === 'running' ||
    status === 'queued' ||
    status === 'waiting_for_user'
  );
}

function StepRow({
  step,
  active,
  defaultOpen,
  styles,
}: {
  step: AgentStepLike;
  active?: boolean;
  defaultOpen?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const body = stepBody(step).trim();
  const title = stepTitle(step);
  const hasBody = body.length > 0 && body !== title;
  const [open, setOpen] = useState(true);
  const useMarkdown =
    step.kind === 'thought' ||
    step.kind === 'tool_result' ||
    step.kind === 'approval_request';

  return (
    <View style={[styles.stepRow, active && styles.stepRowActive]}>
      <Pressable
        style={({ pressed }) => [
          styles.stepHeader,
          pressed && hasBody && styles.buttonPressed,
        ]}
        disabled={!hasBody}
        onPress={() => hasBody && setOpen(v => !v)}
      >
        <Text style={styles.stepSeq}>#{step.seq}</Text>
        <View style={styles.stepHeaderText}>
          <Text style={[styles.stepTitle, active && styles.stepTitleActive]}>
            {title}
            {active ? ' · running' : ''}
          </Text>
          {!open && hasBody ? (
            <Text style={styles.stepPreview} numberOfLines={1}>
              {body.replace(/\s+/g, ' ')}
            </Text>
          ) : null}
        </View>
        {hasBody ? (
          <Text style={styles.stepChevron}>{open ? '▾' : '▸'}</Text>
        ) : null}
      </Pressable>
      {open && hasBody ? (
        <View style={styles.stepBody}>
          {useMarkdown ? (
            <MessageContent content={body} variant="assistant" />
          ) : (
            <Text style={styles.monoBody}>{body}</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function StepsGroup({
  steps,
  activeStepId,
  showEmptyWaiting,
  defaultOpen = true,
  styles,
}: {
  steps: AgentStepLike[];
  activeStepId: string | null;
  showEmptyWaiting?: boolean;
  defaultOpen?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (steps.length === 0) {
    if (!showEmptyWaiting) {
      return null;
    }
    return <Text style={styles.emptyBody}>Waiting for steps…</Text>;
  }

  return (
    <View style={styles.block}>
      <Pressable
        onPress={() => setOpen(v => !v)}
        style={({ pressed }) => [
          styles.stepsToggle,
          pressed && styles.buttonPressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.sectionLabel}>
          {open ? '▾' : '▸'} Steps ({steps.length})
          {!open ? ' · show timeline' : ''}
        </Text>
      </Pressable>
      {open ? (
        <View style={styles.stepsCard}>
          {steps.map(step => (
            <StepRow
              key={step.id}
              step={step}
              styles={styles}
              active={activeStepId === step.id}
              defaultOpen={
                activeStepId === step.id ||
                step.kind === 'thought' ||
                step.kind === 'approval_request'
              }
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function TurnView({
  turn,
  runStatus,
  waitingExtras,
  styles,
  colors,
}: {
  turn: AgentTurn;
  runStatus: string;
  waitingExtras?: {
    busy: boolean;
    onFinish: () => void;
  } | null;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  // Run is no longer live (finished or waiting for a reply) and the Output
  // block is visible: collapse the steps timeline so the Output sits right
  // under the prompt. `key` forces a remount on the live → settled transition
  // so the collapsed default takes effect.
  const collapseSteps =
    !isActiveStatus(runStatus) && turn.output.kind === 'summary';

  return (
    <View style={styles.turn}>
      <View style={styles.promptRow}>
        <View style={styles.promptBubble}>
          <Text style={styles.promptText}>{turn.prompt}</Text>
        </View>
      </View>

      <View style={styles.turnBody}>
        <StepsGroup
          key={collapseSteps ? 'collapsed' : 'open'}
          steps={turn.steps}
          activeStepId={turn.activeStepId}
          showEmptyWaiting={turn.isLatest && isActiveStatus(runStatus)}
          defaultOpen={!collapseSteps}
          styles={styles}
        />

        {turn.output.kind === 'summary' ? (
          <View style={styles.block}>
            <Text style={styles.sectionLabel}>Output</Text>
            <View style={styles.outputBox}>
              <MessageContent
                content={turn.output.text}
                variant="assistant"
              />
            </View>
          </View>
        ) : null}

        {turn.question ? (
          <View
            style={
              turn.question.live ? styles.waitingCard : styles.block
            }
          >
            <Text
              style={
                turn.question.live ? styles.waitingLabel : styles.sectionLabel
              }
            >
              {turn.question.live ? 'Donna needs your reply' : 'Question'}
            </Text>
            <View style={styles.outputBox}>
              <MessageContent
                content={turn.question.text}
                variant="assistant"
              />
            </View>
            {turn.question.live && waitingExtras ? (
              <View style={styles.waitingFooter}>
                <Text style={styles.waitingHint}>
                  Or close this agent without answering.
                </Text>
                <Pressable
                  disabled={waitingExtras.busy}
                  onPress={waitingExtras.onFinish}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    styles.actionButton,
                    waitingExtras.busy && styles.buttonDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <CheckIcon size={16} color={colors.text} />
                  <Text style={styles.secondaryButtonText}>Mark finished</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ReplyComposer({
  waiting,
  options,
  allowMultiple,
  busy,
  value,
  onChange,
  onSend,
  styles,
  colors,
}: {
  waiting: boolean;
  options: AskOption[];
  allowMultiple: boolean;
  busy: boolean;
  value: string;
  onChange: (v: string) => void;
  onSend: (message: string) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const optionKey = options.map(o => o.id).join('|');

  useEffect(() => {
    setSelected([]);
  }, [optionKey]);

  function toggle(id: string) {
    setSelected(prev => {
      if (allowMultiple) {
        return prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      }
      return prev[0] === id ? [] : [id];
    });
  }

  function composeFromSelection(): string {
    const labels = options
      .filter(o => selected.includes(o.id))
      .map(o => o.label);
    if (labels.length === 0) {
      return value.trim();
    }
    const choice = labels.join(', ');
    const extra = value.trim();
    return extra ? `${choice}\n\n${extra}` : choice;
  }

  const canSend = Boolean(composeFromSelection());

  return (
    <View style={styles.replyCard}>
      <Text style={styles.sectionLabel}>
        {waiting ? 'Your reply' : 'Continue / reply'}
      </Text>
      {options.length > 0 ? (
        <View style={styles.optionsBlock}>
          <Text style={styles.optionsHint}>
            {allowMultiple
              ? 'Select one or more options'
              : 'Select an option'}
          </Text>
          <View style={styles.optionRow}>
            {options.map(opt => {
              const on = selected.includes(opt.id);
              return (
                <Pressable
                  key={opt.id}
                  disabled={busy}
                  onPress={() => toggle(opt.id)}
                  style={({ pressed }) => [
                    styles.optionChip,
                    on && styles.optionChipOn,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      on && styles.optionChipTextOn,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      <TextInput
        style={styles.replyInput}
        multiline
        editable={!busy}
        placeholder={
          options.length > 0
            ? allowMultiple
              ? 'Optional note to add with your selection…'
              : 'Or type a different answer…'
            : waiting
              ? 'Write your answer…'
              : 'Add a follow-up or correction…'
        }
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={onChange}
      />
      <View style={styles.replyActions}>
        <Pressable
          disabled={busy || !canSend}
          onPress={() => onSend(composeFromSelection())}
          style={({ pressed }) => [
            styles.primaryButton,
            (busy || !canSend) && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {options.length > 0 && selected.length > 0 && !value.trim()
              ? 'Confirm'
              : 'Reply'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function AgentDetail({
  run,
  steps,
  busy,
  error,
  reply,
  onChangeReply,
  onBack,
  onCancel,
  onFinish,
  onReply,
  styles,
  colors,
}: {
  run: AgentRun;
  steps: AgentStep[];
  busy: boolean;
  error: string | null;
  reply: string;
  onChangeReply: (v: string) => void;
  onBack: () => void;
  onCancel: () => void;
  onFinish: () => void;
  onReply: (message: string) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  const turns = useMemo(() => buildAgentTurns(run, steps), [run, steps]);
  const needsReply = Boolean(
    run.status === 'waiting_for_user' ||
      turns[turns.length - 1]?.question?.live,
  );
  const options = useMemo(
    () => (needsReply ? parseOptions(run.result) : []),
    [needsReply, run.result],
  );
  const allowMultiple = Boolean(
    needsReply &&
      (run.result?.allow_multiple === true ||
        (run.result?.args as { allow_multiple?: boolean } | undefined)
          ?.allow_multiple === true),
  );
  const showReply = canReply(run.status);
  const scrollRef = useRef<ScrollView>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [run.id, steps.length, turns.length, run.status]);

  async function handleShare() {
    setSharing(true);
    try {
      const share = await createAgentRunShare(run.id);
      await Share.share({ message: share.url, url: share.url });
    } catch (e) {
      Alert.alert(
        'Share failed',
        e instanceof Error ? e.message : 'Could not create share link',
      );
    } finally {
      setSharing(false);
    }
  }

  async function handleRevokeShare() {
    setSharing(true);
    try {
      await revokeAgentRunShare(run.id);
      Alert.alert('Sharing stopped', 'Anyone with the old link will lose access.');
    } catch (e) {
      Alert.alert(
        'Could not stop sharing',
        e instanceof Error ? e.message : 'Try again.',
      );
    } finally {
      setSharing(false);
    }
  }

  function onSharePress() {
    Alert.alert(
      'Share agent',
      'Anyone with the link can view the prompt and output. Steps and memory are not shared.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share link',
          onPress: () => void handleShare(),
        },
        {
          text: 'Stop sharing',
          style: 'destructive',
          onPress: () => void handleRevokeShare(),
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.backButtonText}>← Agents</Text>
          </Pressable>
          <Text style={styles.subtitle}>
            {needsReply ? 'needs reply' : statusLabel(run.status)}
            {run.error ? ` · ${run.error}` : ''}
          </Text>
        </View>
        <Pressable
          disabled={sharing || busy}
          onPress={onSharePress}
          style={({ pressed }) => [
            styles.refreshButton,
            (sharing || busy) && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.refreshButtonText}>Share</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.detailContent}
        keyboardShouldPersistTaps="handled"
      >
        {isOpenStatus(run.status) || needsReply ? (
          <View style={styles.actionRow}>
            <Pressable
              disabled={busy}
              onPress={onFinish}
              style={({ pressed }) => [
                styles.secondaryButton,
                styles.actionButton,
                busy && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
            >
              <CheckIcon size={16} color={colors.text} />
              <Text style={styles.secondaryButtonText}>Mark finished</Text>
            </Pressable>
            {isOpenStatus(run.status) ? (
              <Pressable
                disabled={busy}
                onPress={onCancel}
                style={({ pressed }) => [
                  styles.ghostButton,
                  styles.actionButton,
                  busy && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
              >
                <StopIcon size={16} color={colors.muted} />
                <Text style={styles.ghostButtonText}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {turns.map(turn => (
          <TurnView
            key={turn.id}
            turn={turn}
            runStatus={run.status}
            styles={styles}
            colors={colors}
            waitingExtras={
              turn.isLatest && needsReply ? { busy, onFinish } : null
            }
          />
        ))}
      </ScrollView>

      {showReply ? (
        <View style={styles.composerDock}>
          <ReplyComposer
            waiting={needsReply}
            options={options}
            allowMultiple={allowMultiple}
            busy={busy}
            value={reply}
            onChange={onChangeReply}
            onSend={onReply}
            styles={styles}
            colors={colors}
          />
        </View>
      ) : null}
    </View>
  );
}

export function AgentsScreen({ isVisible }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [goal, setGoal] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listFetchGen = useRef(0);

  const selected = runs.find(r => r.id === selectedId) ?? null;

  const refreshRuns = useCallback(async () => {
    const gen = ++listFetchGen.current;
    setError(null);
    try {
      const list = await listAgentRuns();
      if (gen !== listFetchGen.current) {
        return;
      }
      setRuns(list);
    } catch (e) {
      if (gen !== listFetchGen.current) {
        return;
      }
      setError(e instanceof Error ? e.message : 'Failed to load agents');
    } finally {
      if (gen === listFetchGen.current) {
        setLoading(false);
      }
    }
  }, []);

  const refreshSteps = useCallback(async (id: string) => {
    try {
      const list = await listAgentSteps(id);
      setSteps(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load steps');
    }
  }, []);

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    setSelectedId(null);
    setSteps([]);
    setReply('');
    setError(null);
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    void refreshRuns();
  }, [isVisible, refreshRuns]);

  useEffect(() => {
    if (!isVisible || !selectedId) {
      setSteps([]);
      return;
    }
    void refreshSteps(selectedId);
    const timer = setInterval(() => {
      void refreshRuns();
      void refreshSteps(selectedId);
    }, 2500);
    return () => clearInterval(timer);
  }, [isVisible, selectedId, refreshRuns, refreshSteps]);

  useEffect(() => {
    setReply('');
  }, [selectedId]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshRuns();
      if (selectedId) {
        await refreshSteps(selectedId);
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function onStart() {
    const g = goal.trim();
    if (!g || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const run = await createAgentRun(g);
      listFetchGen.current += 1;
      setGoal('');
      setRuns(prev => upsertAgentRun(prev, run));
      setSelectedId(run.id);
      await refreshRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start agent');
    } finally {
      setBusy(false);
    }
  }

  async function onCancel(id: string) {
    setBusy(true);
    try {
      const updated = await cancelAgentRun(id);
      listFetchGen.current += 1;
      setRuns(prev => upsertAgentRun(prev, updated));
      await refreshRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusy(false);
    }
  }

  async function onFinish(id: string) {
    setBusy(true);
    try {
      const updated = await finishAgentRun(id);
      listFetchGen.current += 1;
      setRuns(prev => upsertAgentRun(prev, updated));
      setReply('');
      await refreshRuns();
      await refreshSteps(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not mark finished');
    } finally {
      setBusy(false);
    }
  }

  async function onReply(id: string, message: string) {
    const msg = message.trim();
    if (!msg) {
      return;
    }
    setBusy(true);
    try {
      const updated = await redirectAgentRun(id, msg);
      listFetchGen.current += 1;
      setRuns(prev => upsertAgentRun(prev, updated));
      setReply('');
      await refreshRuns();
      await refreshSteps(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reply failed');
    } finally {
      setBusy(false);
    }
  }

  if (selected) {
    return (
      <AgentDetail
        run={selected}
        steps={steps}
        busy={busy}
        error={error}
        reply={reply}
        onChangeReply={setReply}
        onBack={() => setSelectedId(null)}
        onCancel={() => void onCancel(selected.id)}
        onFinish={() => void onFinish(selected.id)}
        onReply={message => void onReply(selected.id, message)}
        styles={styles}
        colors={colors}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Cloud agents</Text>
          <Text style={styles.subtitle}>
            Background goals on Donna cloud — phone can lock while it works.
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => void handleRefresh()}
          disabled={loading || refreshing || busy}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.refreshButtonText}>Refresh</Text>
          )}
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.composeCard}>
        <Text style={styles.composeLabel}>Start a goal</Text>
        <TextInput
          style={styles.goalInput}
          placeholder="Find the Lisbon rooftop dinner photo in my notes…"
          placeholderTextColor={colors.muted}
          value={goal}
          onChangeText={setGoal}
          editable={!busy}
          onSubmitEditing={() => void onStart()}
          returnKeyType="send"
        />
        <Pressable
          disabled={busy || !goal.trim()}
          onPress={() => void onStart()}
          style={({ pressed }) => [
            styles.primaryButton,
            (busy || !goal.trim()) && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Run</Text>
        </Pressable>
      </View>

      {loading && runs.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={runs}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.listContent,
            runs.length === 0 && styles.listEmptyContent,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No agent runs yet</Text>
              <Text style={styles.emptyBody}>
                Start a background goal above. Donna will search memory and the
                web while you do other things.
              </Text>
            </View>
          }
          ListHeaderComponent={
            runs.length > 0 ? (
              <Text style={styles.sectionLabel}>Runs ({runs.length})</Text>
            ) : null
          }
          renderItem={({ item }) => {
            const waiting = item.status === 'waiting_for_user';
            return (
              <Pressable
                onPress={() => setSelectedId(item.id)}
                style={({ pressed }) => [
                  styles.card,
                  waiting && styles.cardWaiting,
                  pressed && styles.buttonPressed,
                ]}
              >
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.badge,
                      waiting && styles.badgeWaiting,
                      item.status === 'succeeded' && styles.badgeOk,
                      (item.status === 'failed' ||
                        item.status === 'cancelled') &&
                        styles.badgeBad,
                      (item.status === 'running' || item.status === 'queued') &&
                        styles.badgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        waiting && styles.badgeTextWaiting,
                        item.status === 'succeeded' && styles.badgeTextOk,
                        (item.status === 'failed' ||
                          item.status === 'cancelled') &&
                          styles.badgeTextBad,
                        (item.status === 'running' ||
                          item.status === 'queued') &&
                          styles.badgeTextActive,
                      ]}
                    >
                      {statusLabel(item.status)}
                    </Text>
                  </View>
                  <Text style={styles.metaText}>{item.step_count} steps</Text>
                </View>
                <Text style={styles.cardTitle} numberOfLines={3}>
                  {item.goal}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerText: {
      flex: 1,
      gap: 4,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    subtitle: {
      fontSize: 14,
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    backButton: {
      alignSelf: 'flex-start',
      paddingVertical: 2,
      marginBottom: 2,
    },
    backButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
      fontFamily: colors.fontFamily,
    },
    refreshButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minWidth: 84,
      alignItems: 'center',
      justifyContent: 'center',
    },
    refreshButtonText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '600',
      fontFamily: colors.fontFamily,
    },
    errorBanner: {
      marginHorizontal: 20,
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.destructive,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 14,
      fontFamily: colors.fontFamily,
    },
    composeCard: {
      marginHorizontal: 20,
      marginTop: 16,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      gap: 10,
      backgroundColor: colors.background,
    },
    composeLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    goalInput: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 12,
    },
    listEmptyContent: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.muted,
      marginBottom: 4,
      fontFamily: colors.fontFamily,
    },
    emptyState: {
      alignItems: 'center',
      paddingHorizontal: 24,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    emptyBody: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.background,
      padding: 14,
      gap: 10,
    },
    cardWaiting: {
      borderColor: '#F59E0B',
      backgroundColor: '#FFFBEB',
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    badge: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    badgeWaiting: {
      borderColor: '#FCD34D',
      backgroundColor: '#FEF3C7',
    },
    badgeOk: {
      borderColor: '#A7F3D0',
      backgroundColor: '#ECFDF5',
    },
    badgeBad: {
      borderColor: '#FECACA',
      backgroundColor: '#FEF2F2',
    },
    badgeActive: {
      borderColor: colors.primaryLight,
      backgroundColor: colors.primaryLight,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    badgeTextWaiting: {
      color: '#92400E',
    },
    badgeTextOk: {
      color: '#065F46',
    },
    badgeTextBad: {
      color: colors.destructive,
    },
    badgeTextActive: {
      color: colors.primary,
    },
    metaText: {
      fontSize: 12,
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    detailContent: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 20,
      paddingBottom: 24,
    },
    turn: {
      gap: 12,
    },
    promptRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    promptBubble: {
      maxWidth: '92%',
      backgroundColor: colors.primary,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    promptText: {
      color: colors.white,
      fontSize: 15,
      lineHeight: 22,
      fontFamily: colors.fontFamily,
    },
    turnBody: {
      gap: 12,
      paddingLeft: 4,
    },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '600',
      fontFamily: colors.fontFamily,
    },
    secondaryButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      fontFamily: colors.fontFamily,
    },
    ghostButton: {
      backgroundColor: 'transparent',
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    ghostButtonText: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: '600',
      fontFamily: colors.fontFamily,
    },
    buttonPressed: {
      opacity: 0.7,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    waitingCard: {
      borderWidth: 1,
      borderColor: '#FCD34D',
      backgroundColor: '#FFFBEB',
      borderRadius: 14,
      padding: 14,
      gap: 12,
    },
    waitingLabel: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: '#92400E',
      fontFamily: colors.fontFamily,
    },
    waitingHint: {
      fontSize: 13,
      color: '#78350F',
      fontFamily: colors.fontFamily,
    },
    waitingFooter: {
      borderTopWidth: 1,
      borderTopColor: '#FDE68A',
      paddingTop: 12,
      gap: 10,
    },
    block: {
      gap: 8,
    },
    stepsToggle: {
      alignSelf: 'flex-start',
      paddingVertical: 2,
    },
    outputBox: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
    },
    composerDock: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 16,
      backgroundColor: colors.background,
    },
    replyCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      gap: 10,
      backgroundColor: colors.surface,
    },
    optionsBlock: {
      gap: 8,
    },
    optionsHint: {
      fontSize: 12,
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    optionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    optionChip: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    optionChipOn: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    optionChipText: {
      fontSize: 14,
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    optionChipTextOn: {
      color: colors.white,
      fontWeight: '600',
    },
    replyInput: {
      minHeight: 80,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
      textAlignVertical: 'top',
      fontFamily: colors.fontFamily,
    },
    replyActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    stepsCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      overflow: 'hidden',
    },
    stepRow: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    stepRowActive: {
      backgroundColor: colors.primaryLight,
    },
    stepHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    stepSeq: {
      fontSize: 11,
      color: colors.muted,
      fontFamily: colors.fontFamily,
      marginTop: 2,
    },
    stepHeaderText: {
      flex: 1,
      gap: 2,
    },
    stepTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    stepTitleActive: {
      color: colors.primary,
    },
    stepPreview: {
      fontSize: 12,
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    stepChevron: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    stepBody: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
      paddingLeft: 36,
    },
    monoBody: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.text,
      fontFamily: 'Menlo',
    },
  });
}
