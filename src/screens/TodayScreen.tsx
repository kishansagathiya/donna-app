import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useTheme } from '../hooks/useTheme';
import {
  checkDailyNotes,
  formatNoteDate,
  type DailyBriefing,
  type DailyTask,
  type OutdatedNote,
} from '../services/notesApi';
import type { ThemeColors } from '../theme/colors';

const PRIORITY_LABELS: Record<string, string> = {
  do_first: 'Do first',
  schedule: 'Schedule',
  delegate: 'Quick win',
};

type Props = {
  embedded?: boolean;
};

function TaskRow({
  task,
  onPress,
  styles,
  colors,
}: {
  task: DailyTask;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  const priorityLabel = PRIORITY_LABELS[task.priority] ?? 'Schedule';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.priorityBadge}>
        <Text style={styles.priorityText}>{priorityLabel}</Text>
      </View>
      <Text style={styles.cardTitle}>{task.title}</Text>
      {task.preview ? (
        <Text style={styles.cardPreview} numberOfLines={2}>
          {task.preview}
        </Text>
      ) : null}
      {task.reason ? (
        <Text style={styles.cardReason}>{task.reason}</Text>
      ) : null}
      <View style={styles.flagRow}>
        {task.is_urgent ? (
          <Text style={[styles.flag, { color: colors.destructive }]}>Urgent</Text>
        ) : null}
        {task.is_important ? (
          <Text style={[styles.flag, { color: colors.primary }]}>Important</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function OutdatedRow({
  note,
  onPress,
  styles,
}: {
  note: OutdatedNote;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, styles.outdatedCard, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <Text style={styles.cardTitle}>{note.title}</Text>
      {note.preview ? (
        <Text style={styles.cardPreview} numberOfLines={2}>
          {note.preview}
        </Text>
      ) : null}
      {note.reason ? (
        <Text style={styles.cardReason}>{note.reason}</Text>
      ) : null}
    </Pressable>
  );
}

export function TodayScreen({ embedded = false }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showNote = (title: string, preview: string, reason?: string) => {
    const message = [preview, reason].filter(Boolean).join('\n\n');
    Alert.alert(title, message || 'No additional details.');
  };

  const runCheck = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      setBriefing(await checkDailyNotes());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to check notes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const openTask = (task: DailyTask) => {
    showNote(task.title, task.preview, task.reason);
  };

  const openOutdated = (note: OutdatedNote) => {
    showNote(note.title, note.preview, note.reason);
  };

  const listData: Array<
    | { type: 'summary'; id: string; text: string }
    | { type: 'section'; id: string; title: string }
    | { type: 'task'; id: string; task: DailyTask }
    | { type: 'outdated'; id: string; note: OutdatedNote }
    | { type: 'footer'; id: string; date: string }
  > = [];

  if (briefing?.summary) {
    listData.push({ type: 'summary', id: 'summary', text: briefing.summary });
  }
  if (briefing && briefing.tasks.length > 0) {
    listData.push({
      type: 'section',
      id: 'tasks-header',
      title: `Focus today (${briefing.tasks.length})`,
    });
    for (const task of briefing.tasks) {
      listData.push({ type: 'task', id: task.note_id, task });
    }
  }
  if (briefing && briefing.outdated.length > 0) {
    listData.push({
      type: 'section',
      id: 'outdated-header',
      title: `May be outdated (${briefing.outdated.length})`,
    });
    for (const note of briefing.outdated) {
      listData.push({ type: 'outdated', id: note.note_id, note });
    }
  }
  if (briefing?.date) {
    listData.push({
      type: 'footer',
      id: 'footer',
      date: formatNoteDate(`${briefing.date}T12:00:00.000Z`),
    });
  }

  return (
    <View style={[styles.container, !embedded && { paddingTop: insets.top }]}>
      {!embedded ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Today</Text>
            <Text style={styles.subtitle}>{todayLabel}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.checkButton, pressed && styles.checkButtonPressed]}
            onPress={() => void runCheck(true)}
            disabled={loading || refreshing}
          >
            {loading || refreshing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.checkButtonText}>Check notes</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.embeddedHeader}>
          <Text style={styles.subtitle}>{todayLabel}</Text>
          <Pressable
            style={({ pressed }) => [styles.checkButton, pressed && styles.checkButtonPressed]}
            onPress={() => void runCheck(true)}
            disabled={loading || refreshing}
          >
            {loading || refreshing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.checkButtonText}>Check notes</Text>
            )}
          </Pressable>
        </View>
      )}

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && !briefing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void runCheck(true)}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            !loading && !error ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>All clear for today</Text>
                <Text style={styles.emptyBody}>
                  Add notes from chat, links, or documents and Donna will build your daily list.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            if (item.type === 'summary') {
              return (
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryText}>{item.text}</Text>
                </View>
              );
            }
            if (item.type === 'section') {
              return <Text style={styles.sectionTitle}>{item.title}</Text>;
            }
            if (item.type === 'task') {
              return (
                <TaskRow
                  task={item.task}
                  onPress={() => openTask(item.task)}
                  styles={styles}
                  colors={colors}
                />
              );
            }
            if (item.type === 'outdated') {
              return (
                <OutdatedRow
                  note={item.note}
                  onPress={() => openOutdated(item.note)}
                  styles={styles}
                />
              );
            }
            return <Text style={styles.footer}>Last checked for {item.date}</Text>;
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
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerText: {
      flex: 1,
      marginRight: 12,
    },
    embeddedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      marginTop: 2,
      fontSize: 14,
      color: colors.muted,
    },
    checkButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minWidth: 108,
      alignItems: 'center',
    },
    checkButtonPressed: {
      opacity: 0.85,
    },
    checkButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    errorBanner: {
      marginHorizontal: 16,
      marginTop: 12,
      padding: 12,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.destructive,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 14,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      padding: 16,
      paddingBottom: 24,
      gap: 12,
    },
    summaryBox: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 4,
    },
    summaryText: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.muted,
      marginTop: 8,
      marginBottom: 4,
    },
    card: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
    },
    outdatedCard: {
      opacity: 0.85,
    },
    cardPressed: {
      backgroundColor: colors.surface,
    },
    priorityBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.primaryLight,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginBottom: 8,
    },
    priorityText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    cardPreview: {
      marginTop: 6,
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
    },
    cardReason: {
      marginTop: 8,
      fontSize: 12,
      fontStyle: 'italic',
      color: colors.muted,
    },
    flagRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
    },
    flag: {
      fontSize: 12,
      fontWeight: '600',
    },
    empty: {
      alignItems: 'center',
      paddingVertical: 48,
      paddingHorizontal: 24,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    emptyBody: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
      textAlign: 'center',
    },
    footer: {
      textAlign: 'center',
      fontSize: 12,
      color: colors.muted,
      marginTop: 8,
    },
  });
}
