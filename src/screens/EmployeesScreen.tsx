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
  archiveEmployee,
  hireEmployee,
  listEmployees,
  pauseEmployee,
  resumeEmployee,
  type AIEmployee,
} from '../services/employeesApi';

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenShift?: (runId: string) => void;
};

const statusLabel: Record<string, string> = {
  active: 'Working',
  paused: 'Paused',
  completed: 'Done',
  archived: 'Archived',
};

export function EmployeesScreen({ visible, onClose, onOpenShift }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [employees, setEmployees] = useState<AIEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hiring, setHiring] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [goal, setGoal] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setEmployees(await listEmployees());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load employees');
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

  const hire = async () => {
    if (!name.trim() || !goal.trim() || hiring) return;
    setHiring(true);
    try {
      await hireEmployee({
        name: name.trim(),
        role: role.trim() || undefined,
        goal: goal.trim(),
        cadence_minutes: 0,
      });
      setName('');
      setRole('');
      setGoal('');
      await refresh();
    } catch (e) {
      Alert.alert(
        'Could not hire',
        e instanceof Error ? e.message : 'Unknown error',
      );
    } finally {
      setHiring(false);
    }
  };

  const runAction = async (
    id: string,
    action: 'pause' | 'resume' | 'archive',
  ) => {
    setBusyId(id);
    try {
      if (action === 'pause') await pauseEmployee(id);
      else if (action === 'resume') await resumeEmployee(id);
      else await archiveEmployee(id);
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
          <Text style={styles.title}>AI Employees</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.lead}>
            Hire someone with a goal. They keep working in the background until
            it's done.
          </Text>

          <View style={styles.hireCard}>
            <Text style={styles.sectionLabel}>Hire</Text>
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="Role (optional)"
              placeholderTextColor={colors.muted}
              value={role}
              onChangeText={setRole}
            />
            <TextInput
              style={[styles.input, styles.goalInput]}
              placeholder="Goal"
              placeholderTextColor={colors.muted}
              value={goal}
              onChangeText={setGoal}
              multiline
            />
            <Pressable
              style={[styles.primaryBtn, hiring && styles.btnDisabled]}
              disabled={hiring || !name.trim() || !goal.trim()}
              onPress={() => void hire()}
            >
              <Text style={styles.primaryBtnText}>
                {hiring ? 'Hiring…' : 'Hire'}
              </Text>
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : employees.length === 0 ? (
            <Text style={styles.empty}>No employees yet.</Text>
          ) : (
            employees.map(emp => (
              <View key={emp.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName}>{emp.name}</Text>
                  <Text style={styles.badge}>
                    {statusLabel[emp.status] ?? emp.status}
                  </Text>
                </View>
                {emp.role ? <Text style={styles.role}>{emp.role}</Text> : null}
                <Text style={styles.goal}>{emp.goal}</Text>
                <Text style={styles.progress} numberOfLines={3}>
                  {emp.progress_summary
                    ? `Progress: ${emp.progress_summary}`
                    : 'No progress yet.'}
                </Text>
                <Text style={styles.meta}>
                  {emp.shift_count} shift{emp.shift_count === 1 ? '' : 's'}
                  {emp.current_agent_run_id ? ' · on shift' : ''}
                </Text>
                <View style={styles.actions}>
                  {emp.current_agent_run_id && onOpenShift ? (
                    <Pressable
                      onPress={() => onOpenShift(emp.current_agent_run_id!)}
                    >
                      <Text style={styles.link}>Open shift</Text>
                    </Pressable>
                  ) : null}
                  {emp.status === 'active' ? (
                    <Pressable
                      disabled={busyId === emp.id}
                      onPress={() => void runAction(emp.id, 'pause')}
                    >
                      <Text style={styles.link}>Pause</Text>
                    </Pressable>
                  ) : null}
                  {emp.status === 'paused' ? (
                    <Pressable
                      disabled={busyId === emp.id}
                      onPress={() => void runAction(emp.id, 'resume')}
                    >
                      <Text style={styles.link}>Resume</Text>
                    </Pressable>
                  ) : null}
                  {emp.status !== 'archived' ? (
                    <Pressable
                      disabled={busyId === emp.id}
                      onPress={() => void runAction(emp.id, 'archive')}
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
    role: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
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
