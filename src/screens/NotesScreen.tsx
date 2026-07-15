import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '../components/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useTheme } from '../hooks/useTheme';
import {
  createNote,
  formatNoteDate,
  listNotesForTag,
  listRecentNotes,
  listTags,
  updateNote,
  type NoteSummary,
  type TagCount,
} from '../services/notesApi';
import { isLocalDeviceNoteId, listLocalDeviceNoteSummaries } from '../services/localDeviceCaptures';
import type { ThemeColors } from '../theme/colors';
import { ArrowUpIcon, SearchIcon } from '../components/icons';
import { SearchNotesModal } from '../components/SearchContextModal';
import { NoteDetailScreen } from './NoteDetailScreen';
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
          {note.source_type !== 'device' ? (
            <>
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
            </>
          ) : null}
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

export function NotesScreen({
  notesRefreshToken = 0,
  isVisible = true,
  onAddLink,
  onSaveToMemory,
}: {
  notesRefreshToken?: number;
  isVisible?: boolean;
  onAddLink?: () => void;
  onSaveToMemory?: () => void;
}) {
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
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const loadNotes = useCallback(async (offset = 0, append = false) => {
    if (offset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);
    try {
      const [batch, localSummaries] = await Promise.all([
        listRecentNotes(PAGE_SIZE, offset),
        offset === 0 ? listLocalDeviceNoteSummaries() : Promise.resolve([]),
      ]);
      const merged = offset === 0
        ? [...localSummaries, ...batch].sort(
            (a, b) => new Date(b.note_date).getTime() - new Date(a.note_date).getTime(),
          )
        : batch;
      setNotes(prev => (append ? [...prev, ...merged] : merged));
      setHasMore(batch.length === PAGE_SIZE);
    } catch (err: unknown) {
      if (offset === 0) {
        try {
          const localSummaries = await listLocalDeviceNoteSummaries();
          if (localSummaries.length > 0) {
            setNotes(localSummaries);
            setError(null);
            return;
          }
        } catch {
          // fall through to server error
        }
      }
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
    if (!isVisible || view !== 'all' || activeTag) {
      return;
    }
    void loadNotes();
    void listTags(30)
      .then(setTags)
      .catch(() => setTags([]));
  }, [isVisible, view, activeTag, loadNotes, notesRefreshToken]);

  const selectTag = (tag: string | null) => {
    setActiveTag(tag);
    if (tag) {
      void loadTagged(tag);
    } else {
      void loadNotes();
    }
  };

  const toggleFlag = async (
    note: NoteSummary,
    field: 'is_urgent' | 'is_important',
  ) => {
    if (isLocalDeviceNoteId(note.id)) return;
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

  const openNote = (note: NoteSummary) => {
    setSelectedNoteId(note.id);
  };

  const handleNoteUpdated = (note: NoteSummary) => {
    setNotes(prev => prev.map(item => (item.id === note.id ? note : item)));
  };

  const handleNoteDeleted = (noteId: string) => {
    setNotes(prev => prev.filter(item => item.id !== noteId));
  };

  if (selectedNoteId) {
    return (
      <NoteDetailScreen
        noteId={selectedNoteId}
        onClose={() => setSelectedNoteId(null)}
        onUpdated={handleNoteUpdated}
        onDeleted={handleNoteDeleted}
      />
    );
  }

  const handleCreateNote = async () => {
    const trimmed = draft.trim();
    if (!trimmed || saving) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const created = await createNote(trimmed);
      if (activeTag) {
        setActiveTag(null);
        setHasMore(true);
      }
      setDraft('');
      setNotes(prev => [created, ...prev.filter(note => note.id !== created.id)]);
      void listTags(30)
        .then(setTags)
        .catch(() => setTags([]));
      void loadNotes();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Notes</Text>
        <View style={styles.headerActions}>
          {view === 'all' ? (
            <Pressable
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.iconButtonPressed,
              ]}
              onPress={() => setSearchOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Search notes"
            >
              <SearchIcon size={20} color={colors.muted} />
            </Pressable>
          ) : null}
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
      </View>

      {view === 'today' ? (
        <TodayScreen embedded onOpenNote={setSelectedNoteId} />
      ) : (
        <>
          <View style={styles.composeRow}>
            <TextInput
              style={styles.composeInput}
              value={draft}
              onChangeText={setDraft}
              placeholder="Jot down a note…"
              placeholderTextColor={colors.muted}
              multiline
              editable={!saving}
              returnKeyType="default"
              blurOnSubmit={false}
            />
            <Pressable
              style={({ pressed }) => [
                styles.composeSend,
                draft.trim().length > 0 && !saving && styles.composeSendActive,
                pressed && styles.composeSendPressed,
              ]}
              onPress={() => void handleCreateNote()}
              disabled={!draft.trim() || saving}
              accessibilityRole="button"
              accessibilityLabel="Save note"
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <ArrowUpIcon size={18} color={draft.trim() ? colors.white : colors.muted} />
              )}
            </Pressable>
          </View>

          {onAddLink || onSaveToMemory ? (
            <View style={styles.ingestActions}>
              {onAddLink ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.ingestButton,
                    pressed && styles.ingestButtonPressed,
                  ]}
                  onPress={onAddLink}
                  accessibilityRole="button"
                  accessibilityLabel="Add link"
                >
                  <Text style={styles.ingestButtonText}>Add link</Text>
                </Pressable>
              ) : null}
              {onSaveToMemory ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.ingestButton,
                    pressed && styles.ingestButtonPressed,
                  ]}
                  onPress={onSaveToMemory}
                  accessibilityRole="button"
                  accessibilityLabel="Save to memory"
                >
                  <Text style={styles.ingestButtonText}>Save to memory</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

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
                      Jot a note above, or save links and documents for Donna to
                      turn into notes.
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

      <SearchNotesModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={setSelectedNoteId}
      />
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
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconButtonPressed: {
      backgroundColor: colors.surface,
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
    composeRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    composeInput: {
      flex: 1,
      minHeight: 44,
      maxHeight: 128,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      lineHeight: 22,
      color: colors.text,
      backgroundColor: colors.background,
    },
    composeSend: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    composeSendActive: {
      backgroundColor: colors.primary,
    },
    composeSendPressed: {
      opacity: 0.85,
    },
    ingestActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    ingestButton: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    ingestButtonPressed: {
      opacity: 0.85,
    },
    ingestButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
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
