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
  cancelReminder,
  createReminder,
  dismissReminder,
  formatReminderWhen,
  listReminders,
  type Reminder,
} from '../services/remindersApi';
import {
  cancelReminderNotification,
  scheduleReminderNotification,
  syncReminderNotifications,
} from '../services/reminderNotifications';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function RemindersScreen({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [notes, setNotes] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const rows = await listReminders('open');
      setReminders(rows);
      setError(null);
      void syncReminderNotifications(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reminders');
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
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const created = await createReminder({
        title: title.trim(),
        when: when.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setTitle('');
      setWhen('');
      setNotes('');
      await scheduleReminderNotification(created);
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

  const runAction = async (rem: Reminder, action: 'cancel' | 'dismiss') => {
    setBusyId(rem.id);
    try {
      if (action === 'cancel') {
        await cancelReminder(rem.id);
        await cancelReminderNotification(rem.id);
      } else {
        await dismissReminder(rem.id);
        await cancelReminderNotification(rem.id);
      }
      await refresh();
    } catch (e) {
      Alert.alert('Action failed', e instanceof Error ? e.message : 'Error');
    } finally {
      setBusyId(null);
    }
  };

  const due = reminders.filter(r => r.status === 'fired');
  const upcoming = reminders.filter(r => r.status === 'scheduled');

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
          <Text style={styles.title}>Reminders</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.lead}>
            Ask Donna in chat, or add one here. Use times like “in 10 minutes”
            or “tomorrow 4pm”. Set your timezone in Profile so they fire on time.
          </Text>

          <View style={styles.hireCard}>
            <Text style={styles.sectionLabel}>New reminder</Text>
            <TextInput
              style={styles.input}
              placeholder="What"
              placeholderTextColor={colors.muted}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={styles.input}
              placeholder="When (tomorrow 4pm)"
              placeholderTextColor={colors.muted}
              value={when}
              onChangeText={setWhen}
            />
            <TextInput
              style={[styles.input, styles.goalInput]}
              placeholder="Notes (optional)"
              placeholderTextColor={colors.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
            <Pressable
              style={[styles.primaryBtn, saving && styles.btnDisabled]}
              disabled={saving || !title.trim()}
              onPress={() => void create()}
            >
              <Text style={styles.primaryBtnText}>
                {saving ? 'Saving…' : 'Remind me'}
              </Text>
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : reminders.length === 0 ? (
            <Text style={styles.empty}>No reminders yet.</Text>
          ) : (
            <>
              {due.map(rem => (
                <View key={rem.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName}>{rem.title}</Text>
                    <Text style={styles.badge}>Due</Text>
                  </View>
                  <Text style={styles.meta}>
                    {formatReminderWhen(rem.due_at, rem.timezone)}
                  </Text>
                  {rem.notes ? (
                    <Text style={styles.goal}>{rem.notes}</Text>
                  ) : null}
                  <View style={styles.actions}>
                    <Pressable
                      disabled={busyId === rem.id}
                      onPress={() => void runAction(rem, 'dismiss')}
                    >
                      <Text style={styles.link}>Done</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
              {upcoming.map(rem => (
                <View key={rem.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName}>{rem.title}</Text>
                    <Text style={styles.badge}>Upcoming</Text>
                  </View>
                  <Text style={styles.meta}>
                    {formatReminderWhen(rem.due_at, rem.timezone)}
                  </Text>
                  {rem.notes ? (
                    <Text style={styles.goal}>{rem.notes}</Text>
                  ) : null}
                  <View style={styles.actions}>
                    <Pressable
                      disabled={busyId === rem.id}
                      onPress={() => void runAction(rem, 'cancel')}
                    >
                      <Text style={[styles.link, styles.danger]}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </>
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
      minHeight: 64,
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
    goal: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    meta: {
      fontSize: 13,
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
