import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '../components/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { ThemeColors } from '../theme/colors';
import {
  archiveSchedule,
  cadenceLabel,
  createSchedule,
  listSchedules,
  pauseSchedule,
  resumeSchedule,
  runScheduleNow,
  type ScheduledGoal,
} from '../services/schedulesApi';

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenRun?: (runId: string) => void;
};

const statusLabel: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Done',
  archived: 'Archived',
};

const cadenceChoices: { label: string; minutes: number }[] = [
  { label: 'Once', minutes: 0 },
  { label: 'Hourly', minutes: 60 },
  { label: 'Daily', minutes: 1440 },
  { label: 'Weekly', minutes: 10080 },
];

export function SchedulesScreen({ visible, onClose, onOpenRun }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [schedules, setSchedules] = useState<ScheduledGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [cadence, setCadence] = useState(1440);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSchedules(await listSchedules());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, 10000);
    return () => clearInterval(id);
  }, [visible, refresh]);

  const create = async () => {
    if (!title.trim() || !goal.trim() || saving) return;
    setSaving(true);
    try {
      await createSchedule({
        title: title.trim(),
        goal: goal.trim(),
        cadence_minutes: cadence,
      });
      setTitle('');
      setGoal('');
      setCadence(1440);
      await refresh();
    } catch (e) {
      Alert.alert(
        'Could not create',
        e instanceof Error ? e.message : 'Unknown error',
      );
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (
    id: string,
    action: 'pause' | 'resume' | 'archive' | 'run',
  ) => {
    setBusyId(id);
    try {
      if (action === 'pause') await pauseSchedule(id);
      else if (action === 'resume') await resumeSchedule(id);
      else if (action === 'run') await runScheduleNow(id);
      else await archiveSchedule(id);
      await refresh();
    } catch (e) {
      Alert.alert('Action failed', e instanceof Error ? e.message : 'Error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 },
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.back}>Close</Text>
          </Pressable>
          <Text style={styles.title}>Schedules</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.lead}>
            Recurring agent goals that run on Donna&apos;s cloud — daily briefs,
            price watches. Approve only irreversible steps.
          </Text>

          <View style={styles.hireCard}>
            <Text style={styles.sectionLabel}>New schedule</Text>
            <TextInput
              style={styles.input}
              placeholder="Title"
              placeholderTextColor={colors.muted}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.input, styles.goalInput]}
              placeholder="Goal"
              placeholderTextColor={colors.muted}
              value={goal}
              onChangeText={setGoal}
              multiline
            />
            <View style={styles.cadenceRow}>
              {cadenceChoices.map(opt => (
                <Pressable
                  key={opt.minutes}
                  onPress={() => setCadence(opt.minutes)}
                  style={[
                    styles.cadenceChip,
                    cadence === opt.minutes && styles.cadenceChipOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.cadenceChipText,
                      cadence === opt.minutes && styles.cadenceChipTextOn,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={[styles.primaryBtn, saving && styles.btnDisabled]}
              disabled={saving || !title.trim() || !goal.trim()}
              onPress={() => void create()}
            >
              <Text style={styles.primaryBtnText}>
                {saving ? 'Creating…' : 'Schedule'}
              </Text>
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : schedules.length === 0 ? (
            <Text style={styles.empty}>No schedules yet.</Text>
          ) : (
            schedules.map(sch => (
              <View key={sch.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName}>{sch.title}</Text>
                  <Text style={styles.badge}>
                    {statusLabel[sch.status] ?? sch.status}
                  </Text>
                </View>
                <Text style={styles.goal}>{sch.goal}</Text>
                <Text style={styles.progress} numberOfLines={3}>
                  {sch.last_summary ? `Last: ${sch.last_summary}` : 'No runs yet.'}
                </Text>
                <Text style={styles.meta}>
                  {sch.run_count} run{sch.run_count === 1 ? '' : 's'} ·{' '}
                  {cadenceLabel(sch.cadence_minutes)}
                  {sch.current_agent_run_id ? ' · running' : ''}
                </Text>
                <View style={styles.actions}>
                  {sch.current_agent_run_id && onOpenRun ? (
                    <Pressable
                      onPress={() => onOpenRun(sch.current_agent_run_id!)}
                    >
                      <Text style={styles.link}>Open run</Text>
                    </Pressable>
                  ) : null}
                  {sch.status === 'active' && !sch.current_agent_run_id ? (
                    <Pressable
                      disabled={busyId === sch.id}
                      onPress={() => void runAction(sch.id, 'run')}
                    >
                      <Text style={styles.link}>Run now</Text>
                    </Pressable>
                  ) : null}
                  {sch.status === 'active' ? (
                    <Pressable
                      disabled={busyId === sch.id}
                      onPress={() => void runAction(sch.id, 'pause')}
                    >
                      <Text style={styles.link}>Pause</Text>
                    </Pressable>
                  ) : null}
                  {sch.status === 'paused' ? (
                    <Pressable
                      disabled={busyId === sch.id}
                      onPress={() => void runAction(sch.id, 'resume')}
                    >
                      <Text style={styles.link}>Resume</Text>
                    </Pressable>
                  ) : null}
                  {sch.status !== 'archived' ? (
                    <Pressable
                      disabled={busyId === sch.id}
                      onPress={() => void runAction(sch.id, 'archive')}
                    >
                      <Text style={[styles.link, styles.danger]}>Archive</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
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
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    back: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
      width: 48,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
    },
    content: {
      padding: 16,
      gap: 12,
      paddingBottom: 40,
    },
    lead: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
      marginBottom: 4,
    },
    hireCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      backgroundColor: colors.surface,
      gap: 10,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.background,
    },
    goalInput: {
      minHeight: 72,
      textAlignVertical: 'top',
    },
    cadenceRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    cadenceChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    cadenceChipOn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    cadenceChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    cadenceChipTextOn: {
      color: '#fff',
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    primaryBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 15,
    },
    btnDisabled: {
      opacity: 0.6,
    },
    error: {
      color: colors.destructive,
      fontSize: 13,
    },
    empty: {
      textAlign: 'center',
      color: colors.muted,
      marginTop: 24,
    },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      backgroundColor: colors.surface,
      gap: 6,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    cardName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    badge: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.muted,
      backgroundColor: colors.background,
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    goal: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    progress: {
      fontSize: 12,
      color: colors.muted,
      lineHeight: 17,
    },
    meta: {
      fontSize: 11,
      color: colors.muted,
      marginTop: 2,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
      marginTop: 8,
    },
    link: {
      color: colors.primary,
      fontWeight: '600',
      fontSize: 14,
    },
    danger: {
      color: colors.destructive,
    },
  });
}
