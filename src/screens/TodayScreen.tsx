import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../components/ThemedText';
import { EnableBriefingAlertsButton } from '../components/DailyBriefingAlertsToggle';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useTheme } from '../hooks/useTheme';
import {
  checkDailyNotes,
  type DailyBriefing,
  type DailyTask,
} from '../services/notesApi';
import {
  getDailyBriefingNotificationsEnabled,
  showDailyBriefingNotification,
} from '../services/dailyBriefingNotifications';
import type { ThemeColors } from '../theme/colors';

const PRIORITY_SECTIONS: Array<{
  key: string;
  title: string;
  subtitle: string;
}> = [
  {
    key: 'do_first',
    title: 'Do first',
    subtitle: 'Urgent and important',
  },
  {
    key: 'schedule',
    title: 'Schedule',
    subtitle: 'Important, not urgent',
  },
  {
    key: 'delegate',
    title: 'Delegate',
    subtitle: 'Urgent, less important',
  },
];

type Props = {
  embedded?: boolean;
  onOpenNote?: (noteId: string) => void;
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
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <Text style={styles.cardTitle}>{task.title}</Text>
      {task.preview ? (
        <Text style={styles.cardPreview} numberOfLines={2}>
          {task.preview}
        </Text>
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

export function TodayScreen({ embedded = false, onOpenNote }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState(false);

  useEffect(() => {
    void getDailyBriefingNotificationsEnabled().then(setAlertsEnabled);
  }, []);

  const openTask = (task: DailyTask) => {
    onOpenNote?.(task.note_id);
  };

  const runCheck = useCallback(async (withNotification = false) => {
    if (withNotification) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await checkDailyNotes();
      setBriefing(result);
      if (withNotification) {
        await showDailyBriefingNotification(result);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load today');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void runCheck(false);
  }, [runCheck]);

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const tasksByPriority = useMemo(() => {
    const grouped: Record<string, DailyTask[]> = {
      do_first: [],
      schedule: [],
      delegate: [],
    };
    for (const task of briefing?.tasks ?? []) {
      if (!Object.prototype.hasOwnProperty.call(grouped, task.priority)) {
        continue;
      }
      grouped[task.priority].push(task);
    }
    return grouped;
  }, [briefing]);

  const listData: Array<
    | { type: 'summary'; id: string; text: string }
    | { type: 'section'; id: string; title: string; subtitle: string }
    | { type: 'task'; id: string; task: DailyTask }
  > = [];

  if (briefing?.summary) {
    listData.push({ type: 'summary', id: 'summary', text: briefing.summary });
  }
  for (const section of PRIORITY_SECTIONS) {
    const tasks = tasksByPriority[section.key] ?? [];
    if (tasks.length === 0) {
      continue;
    }
    listData.push({
      type: 'section',
      id: `section-${section.key}`,
      title: `${section.title} (${tasks.length})`,
      subtitle: section.subtitle,
    });
    for (const task of tasks) {
      listData.push({ type: 'task', id: `${section.key}-${task.note_id}`, task });
    }
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.title}>Today</Text>
        <Text style={styles.subtitle}>{todayLabel}</Text>
      </View>
      <View style={styles.headerActions}>
        {!alertsEnabled ? (
          <EnableBriefingAlertsButton
            onEnabled={() => {
              setAlertsEnabled(true);
              if (briefing) {
                void showDailyBriefingNotification(briefing);
              }
            }}
          />
        ) : null}
        <Pressable
          style={({ pressed }) => [
            styles.checkButton,
            pressed && styles.checkButtonPressed,
          ]}
          onPress={() => void runCheck(true)}
          disabled={loading || refreshing}
        >
          {loading || refreshing ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.checkButtonText}>Refresh</Text>
          )}
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, !embedded && { paddingTop: insets.top }]}>
      {header}

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
                  Mark notes as urgent or important and they will show up here,
                  with do-first items at the top.
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
              return (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{item.title}</Text>
                  <Text style={styles.sectionSubtitle}>{item.subtitle}</Text>
                </View>
              );
            }
            return (
              <TaskRow
                task={item.task}
                onPress={() => openTask(item.task)}
                styles={styles}
                colors={colors}
              />
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
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 1,
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
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
      minWidth: 88,
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
    sectionHeader: {
      marginTop: 8,
      marginBottom: 2,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.muted,
    },
    sectionSubtitle: {
      marginTop: 2,
      fontSize: 12,
      color: colors.muted,
    },
    card: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
    },
    cardPressed: {
      backgroundColor: colors.surface,
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
  });
}
