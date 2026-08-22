import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Text } from '../components/ThemedText';
import { EnableBriefingAlertsButton } from '../components/DailyBriefingAlertsToggle';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import {
  checkDailyNotes,
  deleteNote,
  type DailyBriefing,
  type DailyTask,
} from '../services/notesApi';
import {
  getDailyBriefingNotificationsEnabled,
  showDailyBriefingNotification,
} from '../services/dailyBriefingNotifications';
import {
  briefingWithoutNotes,
  collapseDailyNoteText,
  dailyTaskText,
  shouldCollapseDailyNote,
} from '../lib/dailyTasks';
import { removeNoteFromFeeds } from '../lib/notesCache';
import { notesQueryKeys } from '../lib/notesQueryKeys';
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
  selected,
  onToggle,
  onPress,
  styles,
  colors,
}: {
  task: DailyTask;
  selected: boolean;
  onToggle: () => void;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  const text = dailyTaskText(task);
  const long = shouldCollapseDailyNote(text);
  const [expanded, setExpanded] = useState(false);
  const shown = long && !expanded ? collapseDailyNoteText(text) : text;

  return (
    <View style={[styles.card, selected && styles.cardSelected]}>
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        style={styles.checkboxHit}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`Select note: ${task.title || 'untitled'}`}
      >
        <View
          style={[
            styles.checkbox,
            selected && { backgroundColor: colors.primary, borderColor: colors.primary },
          ]}
        >
          {selected ? <Text style={styles.checkboxMark}>✓</Text> : null}
        </View>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.cardBody, pressed && styles.cardPressed]}
        onPress={onPress}
      >
        <Text style={styles.cardText}>{shown}</Text>
        {long ? (
          <Pressable
            onPress={() => setExpanded(value => !value)}
            hitSlop={6}
          >
            <Text style={[styles.showMore, { color: colors.primary }]}>
              {expanded ? 'Show less' : 'Show more'}
            </Text>
          </Pressable>
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
    </View>
  );
}

export function TodayScreen({ embedded = false, onOpenNote }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
      setSelected(new Set());
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

  const allNoteIds = useMemo(
    () => (briefing?.tasks ?? []).map(task => task.note_id),
    [briefing],
  );
  const selectedCount = selected.size;
  const allSelected = allNoteIds.length > 0 && selectedCount === allNoteIds.length;

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(allNoteIds));
  };

  const handleBulkDelete = () => {
    if (selectedCount === 0 || !briefing) {
      return;
    }
    const ids = [...selected];
    const label = ids.length === 1 ? 'this note' : `${ids.length} notes`;
    Alert.alert(`Delete ${label}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setDeleting(true);
            setError(null);
            try {
              const results = await Promise.allSettled(ids.map(id => deleteNote(id)));
              const deleted: string[] = [];
              const failed: string[] = [];
              results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                  deleted.push(ids[index]);
                } else {
                  failed.push(ids[index]);
                }
              });

              if (deleted.length > 0) {
                setBriefing(prev =>
                  prev ? briefingWithoutNotes(prev, deleted) : prev,
                );
                if (userId) {
                  for (const id of deleted) {
                    removeNoteFromFeeds(queryClient, userId, id);
                    queryClient.removeQueries({
                      queryKey: notesQueryKeys.detail(userId, id),
                    });
                  }
                  void queryClient.invalidateQueries({
                    queryKey: notesQueryKeys.feeds(userId),
                  });
                  void queryClient.invalidateQueries({
                    queryKey: notesQueryKeys.tags(userId),
                  });
                }
              }

              setSelected(new Set(failed));
              if (failed.length > 0) {
                setError(
                  `Deleted ${deleted.length} ${deleted.length === 1 ? 'note' : 'notes'}, but ${failed.length} failed.`,
                );
              }
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : 'Failed to delete notes');
            } finally {
              setDeleting(false);
            }
          })();
        },
      },
    ]);
  };

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

      {allNoteIds.length > 0 ? (
        <View style={styles.bulkBar}>
          <Pressable
            style={({ pressed }) => [
              styles.bulkSecondary,
              pressed && styles.checkButtonPressed,
            ]}
            onPress={toggleSelectAll}
          >
            <Text style={styles.bulkSecondaryText}>
              {allSelected ? 'Clear selection' : 'Select all'}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.bulkDelete,
              (selectedCount === 0 || deleting) && styles.bulkDeleteDisabled,
              pressed && selectedCount > 0 && !deleting && styles.checkButtonPressed,
            ]}
            onPress={handleBulkDelete}
            disabled={selectedCount === 0 || deleting}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.bulkDeleteText}>
                {selectedCount > 0 ? `Delete ${selectedCount}` : 'Delete'}
              </Text>
            )}
          </Pressable>
          <Text style={styles.bulkHint}>
            {selectedCount > 0
              ? `${selectedCount} selected`
              : 'Select notes to delete'}
          </Text>
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
          extraData={selected}
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
                selected={selected.has(item.task.note_id)}
                onToggle={() => toggleSelected(item.task.note_id)}
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
    bulkBar: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    bulkSecondary: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    bulkSecondaryText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
    },
    bulkDelete: {
      backgroundColor: colors.destructive,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      minWidth: 88,
      alignItems: 'center',
    },
    bulkDeleteDisabled: {
      opacity: 0.45,
    },
    bulkDeleteText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
    },
    bulkHint: {
      fontSize: 13,
      color: colors.muted,
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
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      gap: 10,
    },
    cardSelected: {
      borderColor: colors.primary,
    },
    cardBody: {
      flex: 1,
      minWidth: 0,
    },
    cardPressed: {
      opacity: 0.85,
    },
    checkboxHit: {
      paddingTop: 2,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    checkboxMark: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 16,
    },
    cardText: {
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 22,
      color: colors.text,
    },
    showMore: {
      marginTop: 6,
      fontSize: 13,
      fontWeight: '600',
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
