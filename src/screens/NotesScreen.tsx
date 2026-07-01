import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useTheme } from '../hooks/useTheme';
import {
  formatNoteDate,
  listNotesForTag,
  listRecentNotes,
  listTags,
  updateNote,
  type NoteSummary,
  type TagCount,
} from '../services/notesApi';
import type { ThemeColors } from '../theme/colors';
import { TodayScreen } from './TodayScreen';

type NotesView = 'all' | 'today';

const PAGE_SIZE = 50;

function NoteCard({
  note,
  onPress,
  onToggleUrgent,
  onToggleImportant,
  styles,
  colors,
}: {
  note: NoteSummary;
  onPress: () => void;
  onToggleUrgent: () => void;
  onToggleImportant: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {note.title}
        </Text>
        <View style={styles.flagActions}>
          <Pressable
            onPress={onToggleUrgent}
            hitSlop={8}
            accessibilityLabel={note.is_urgent ? 'Mark not urgent' : 'Mark urgent'}
          >
            <Text
              style={[
                styles.flagButton,
                note.is_urgent && { color: colors.destructive },
              ]}
            >
              !
            </Text>
          </Pressable>
          <Pressable
            onPress={onToggleImportant}
            hitSlop={8}
            accessibilityLabel={
              note.is_important ? 'Mark not important' : 'Mark important'
            }
          >
            <Text
              style={[
                styles.flagButton,
                note.is_important && { color: colors.primary },
              ]}
            >
              ★
            </Text>
          </Pressable>
        </View>
      </View>
      {note.preview ? (
        <Text style={styles.cardPreview} numberOfLines={3}>
          {note.preview}
        </Text>
      ) : null}
      <Text style={styles.cardDate}>{formatNoteDate(note.note_date)}</Text>
      {note.category || (note.keywords && note.keywords.length > 0) ? (
        <View style={styles.tagRow}>
          {note.category ? (
            <Text style={styles.metaTag}>{note.category}</Text>
          ) : null}
          {(note.keywords ?? []).slice(0, 4).map(kw => (
            <Text key={kw} style={styles.metaTag}>
              {kw}
            </Text>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

export function NotesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [view, setView] = useState<NotesView>('all');
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [tags, setTags] = useState<TagCount[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotes = useCallback(async (offset = 0, append = false) => {
    if (offset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);
    try {
      const batch = await listRecentNotes(PAGE_SIZE, offset);
      setNotes(prev => (append ? [...prev, ...batch] : batch));
      setHasMore(batch.length === PAGE_SIZE);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load notes');
      if (!append) {
        setNotes([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const loadTagged = useCallback(async (tag: string) => {
    setLoading(true);
    setError(null);
    try {
      const batch = await listNotesForTag(tag, PAGE_SIZE);
      setNotes(batch);
      setHasMore(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tag');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view !== 'all') {
      return;
    }
    void loadNotes();
    void listTags(30)
      .then(setTags)
      .catch(() => setTags([]));
  }, [view, loadNotes]);

  const selectTag = (tag: string | null) => {
    setActiveTag(tag);
    if (tag) {
      void loadTagged(tag);
    } else {
      void loadNotes();
    }
  };

  const openNote = (note: NoteSummary) => {
    Alert.alert(note.title, note.preview || 'No additional details.');
  };

  const toggleFlag = async (
    note: NoteSummary,
    field: 'is_urgent' | 'is_important',
  ) => {
    const next = !note[field];
    setNotes(prev =>
      prev.map(item => (item.id === note.id ? { ...item, [field]: next } : item)),
    );
    try {
      await updateNote(note.id, { [field]: next });
    } catch (err: unknown) {
      setNotes(prev =>
        prev.map(item =>
          item.id === note.id ? { ...item, [field]: note[field] } : item,
        ),
      );
      setError(err instanceof Error ? err.message : 'Failed to update note');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Notes</Text>
        <View style={styles.segmented} accessibilityRole="tablist">
          <Pressable
            style={[styles.segment, view === 'all' && styles.segmentActive]}
            onPress={() => setView('all')}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === 'all' }}
          >
            <Text style={[styles.segmentLabel, view === 'all' && styles.segmentLabelActive]}>
              All
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segment, view === 'today' && styles.segmentActive]}
            onPress={() => setView('today')}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === 'today' }}
          >
            <Text
              style={[styles.segmentLabel, view === 'today' && styles.segmentLabelActive]}
            >
              Today
            </Text>
          </Pressable>
        </View>
      </View>

      {view === 'today' ? (
        <TodayScreen embedded />
      ) : (
        <>
          {tags.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tagFilterRow}
            >
              <Pressable
                style={[styles.filterChip, activeTag === null && styles.filterChipActive]}
                onPress={() => selectTag(null)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    activeTag === null && styles.filterChipTextActive,
                  ]}
                >
                  All
                </Text>
              </Pressable>
              {tags.map(t => (
                <Pressable
                  key={t.tag}
                  style={[styles.filterChip, activeTag === t.tag && styles.filterChipActive]}
                  onPress={() => selectTag(t.tag)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      activeTag === t.tag && styles.filterChipTextActive,
                    ]}
                  >
                    #{t.tag} {t.count}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={notes}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                !error ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>No notes yet</Text>
                    <Text style={styles.emptyBody}>
                      Switch to Notes mode in chat and jot something down, or save links and
                      documents for Donna to turn into notes.
                    </Text>
                  </View>
                ) : null
              }
              renderItem={({ item }) => (
                <NoteCard
                  note={item}
                  onPress={() => openNote(item)}
                  onToggleUrgent={() => void toggleFlag(item, 'is_urgent')}
                  onToggleImportant={() => void toggleFlag(item, 'is_important')}
                  styles={styles}
                  colors={colors}
                />
              )}
              ListFooterComponent={
                hasMore && notes.length > 0 ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.loadMore,
                      pressed && styles.loadMorePressed,
                    ]}
                    onPress={() => void loadNotes(notes.length, true)}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text style={styles.loadMoreText}>Load more</Text>
                    )}
                  </Pressable>
                ) : null
              }
            />
          )}
        </>
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
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    segmented: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 3,
    },
    segment: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 16,
    },
    segmentActive: {
      backgroundColor: colors.primary,
    },
    segmentLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.muted,
    },
    segmentLabelActive: {
      color: colors.white,
    },
    tagFilterRow: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
      flexDirection: 'row',
      alignItems: 'center',
    },
    filterChip: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.surface,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
    },
    filterChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
    },
    filterChipTextActive: {
      color: colors.white,
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
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
    },
    cardTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    flagActions: {
      flexDirection: 'row',
      gap: 4,
    },
    flagButton: {
      fontSize: 18,
      color: colors.muted,
      paddingHorizontal: 4,
    },
    cardPreview: {
      marginTop: 6,
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
    },
    cardDate: {
      marginTop: 8,
      fontSize: 12,
      color: colors.muted,
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 8,
    },
    metaTag: {
      fontSize: 11,
      color: colors.muted,
      backgroundColor: colors.surface,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      overflow: 'hidden',
      textTransform: 'capitalize',
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
    loadMore: {
      alignSelf: 'center',
      marginTop: 4,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10,
      minWidth: 120,
      alignItems: 'center',
    },
    loadMorePressed: {
      backgroundColor: colors.surface,
    },
    loadMoreText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.muted,
    },
  });
}
