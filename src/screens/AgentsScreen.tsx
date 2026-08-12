import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
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
  cancelAgentRun,
  createAgentRun,
  finishAgentRun,
  listAgentRuns,
  listAgentSteps,
  redirectAgentRun,
  type AgentRun,
  type AgentStep,
} from '../services/agentsApi';
import type { ThemeColors } from '../theme/colors';

type AskOption = { id: string; label: string };

type Props = {
  isVisible: boolean;
};

function statusLabel(status: string) {
  return status === 'waiting_for_user' ? 'needs reply' : status;
}

function resultSummary(
  result: Record<string, unknown> | null | undefined,
): string {
  if (!result) {
    return '';
  }
  if (typeof result.summary === 'string' && result.summary.trim()) {
    return result.summary;
  }
  if (typeof result.question === 'string' && result.question.trim()) {
    return result.question;
  }
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

function pendingQuestion(
  result: Record<string, unknown> | null | undefined,
): string | null {
  if (!result) {
    return null;
  }
  if (typeof result.question === 'string' && result.question.trim()) {
    return result.question.trim();
  }
  if (
    result.kind === 'ask_user' &&
    typeof result.summary === 'string' &&
    result.summary.trim()
  ) {
    return result.summary.trim();
  }
  return null;
}

function parseOptions(
  result: Record<string, unknown> | null | undefined,
): AskOption[] {
  if (!result) {
    return [];
  }
  const raw =
    result.options ??
    (result.args as { options?: unknown } | undefined)?.options;
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: AskOption[] = [];
  raw.forEach((item, i) => {
    if (typeof item === 'string' && item.trim()) {
      out.push({ id: `opt_${i + 1}`, label: item.trim() });
      return;
    }
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const label = String(obj.label ?? obj.text ?? '').trim();
      if (!label) {
        return;
      }
      const id = String(obj.id ?? `opt_${i + 1}`).trim() || `opt_${i + 1}`;
      out.push({ id, label });
    }
  });
  return out;
}

function canReply(status: string) {
  return (
    status === 'waiting_for_user' ||
    status === 'running' ||
    status === 'queued' ||
    status === 'succeeded' ||
    status === 'failed'
  );
}

function isOpenStatus(status: string) {
  return (
    status === 'running' ||
    status === 'queued' ||
    status === 'waiting_for_user'
  );
}

function stepTitle(step: AgentStep): string {
  const p = step.payload || {};
  switch (step.kind) {
    case 'status':
      return String(p.text ?? 'status');
    case 'thought':
      return 'Thought';
    case 'tool_call':
      return `Tool → ${String(p.name ?? 'tool')}`;
    case 'tool_result':
      return `Result ← ${String(p.name ?? 'tool')}`;
    case 'user_message':
      return 'Reply';
    case 'approval_request':
      return p.kind === 'ask_user' || p.tool === 'ask_user'
        ? 'Question for you'
        : 'Approval requested';
    case 'error':
      return 'Error';
    case 'compress':
      return 'Context compressed';
    case 'memory_retrieve':
      return 'Memory';
    default:
      return step.kind;
  }
}

function stepBody(step: AgentStep): string {
  const p = step.payload || {};
  switch (step.kind) {
    case 'status':
    case 'thought':
      return String(p.text ?? '');
    case 'tool_call': {
      const args = p.args;
      if (args == null) {
        return '';
      }
      if (typeof args === 'string') {
        return args;
      }
      try {
        return JSON.stringify(args, null, 2);
      } catch {
        return String(args);
      }
    }
    case 'tool_result':
      return String(p.content ?? '');
    case 'user_message':
      return String(p.message ?? '');
    case 'approval_request':
      if (typeof p.question === 'string' && p.question.trim()) {
        return p.question;
      }
      try {
        return JSON.stringify(p, null, 2);
      } catch {
        return String(p);
      }
    case 'error':
      return String(p.error ?? '');
    default:
      try {
        return JSON.stringify(p, null, 2);
      } catch {
        return '';
      }
  }
}

function StepRow({
  step,
  defaultOpen,
  styles,
}: {
  step: AgentStep;
  defaultOpen?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const body = stepBody(step).trim();
  const title = stepTitle(step);
  const hasBody = body.length > 0 && body !== title;
  const [open, setOpen] = useState(
    Boolean(defaultOpen || step.kind === 'thought' || step.kind === 'error'),
  );
  const useMarkdown =
    step.kind === 'thought' ||
    step.kind === 'tool_result' ||
    step.kind === 'approval_request';

  return (
    <View style={styles.stepRow}>
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
          <Text style={styles.stepTitle}>{title}</Text>
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
                    style={[styles.optionChipText, on && styles.optionChipTextOn]}
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
  const summary = resultSummary(run.result);
  const question =
    run.status === 'waiting_for_user'
      ? pendingQuestion(run.result) ?? summary
      : null;
  const options = useMemo(
    () =>
      run.status === 'waiting_for_user' ? parseOptions(run.result) : [],
    [run.status, run.result],
  );
  const allowMultiple = Boolean(
    run.status === 'waiting_for_user' &&
      (run.result?.allow_multiple === true ||
        (run.result?.args as { allow_multiple?: boolean } | undefined)
          ?.allow_multiple === true),
  );
  const showReply = canReply(run.status);

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
          <Text style={styles.detailGoal}>{run.goal}</Text>
          <Text style={styles.subtitle}>
            {run.status}
            {run.error ? ` · ${run.error}` : ''}
          </Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.detailContent}
        keyboardShouldPersistTaps="handled"
      >
        {isOpenStatus(run.status) ? (
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
          </View>
        ) : null}

        {run.status === 'waiting_for_user' ? (
          <View style={styles.waitingCard}>
            <Text style={styles.waitingLabel}>Donna needs your reply</Text>
            {question ? (
              <View style={styles.outputBox}>
                <MessageContent content={question} variant="assistant" />
              </View>
            ) : (
              <Text style={styles.waitingHint}>
                Answer below to continue this agent.
              </Text>
            )}
            <View style={styles.waitingFooter}>
              <Text style={styles.waitingHint}>
                Or close this agent without answering.
              </Text>
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
            </View>
          </View>
        ) : null}

        {summary && run.status !== 'waiting_for_user' ? (
          <View style={styles.block}>
            <Text style={styles.sectionLabel}>Output</Text>
            <View style={styles.outputBox}>
              <MessageContent content={summary} variant="assistant" />
            </View>
          </View>
        ) : null}

        {showReply ? (
          <ReplyComposer
            waiting={run.status === 'waiting_for_user'}
            options={options}
            allowMultiple={allowMultiple}
            busy={busy}
            value={reply}
            onChange={onChangeReply}
            onSend={onReply}
            styles={styles}
            colors={colors}
          />
        ) : null}

        <View style={styles.block}>
          <Text style={styles.sectionLabel}>Steps ({steps.length})</Text>
          <View style={styles.stepsCard}>
            {steps.length === 0 ? (
              <Text style={styles.emptyBody}>Waiting for steps…</Text>
            ) : (
              steps.map(step => (
                <StepRow
                  key={step.id}
                  step={step}
                  styles={styles}
                  defaultOpen={
                    step.kind === 'thought' ||
                    step.kind === 'approval_request' ||
                    (step.kind === 'tool_result' &&
                      step.seq === steps[steps.length - 1]?.seq)
                  }
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>
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

  const selected = runs.find(r => r.id === selectedId) ?? null;

  const refreshRuns = useCallback(async () => {
    setError(null);
    try {
      const list = await listAgentRuns();
      setRuns(list);
      if (selectedId && !list.some(r => r.id === selectedId) && list[0]) {
        setSelectedId(list[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

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
      setGoal('');
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
      await cancelAgentRun(id);
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
      await finishAgentRun(id);
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
      await redirectAgentRun(id, msg);
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
    detailGoal: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
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
      gap: 16,
      paddingBottom: 40,
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
    outputBox: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      minHeight: 120,
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
      minHeight: 110,
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
