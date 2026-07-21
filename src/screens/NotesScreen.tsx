import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  formatNoteDate,
  newNoteId,
  type NoteSummary,
} from '../services/notesApi';
import {
  isLocalDeviceNoteId,
  listLocalDeviceNoteSummaries,
} from '../services/localDeviceCaptures';
import type { ThemeColors } from '../theme/colors';
import { ArrowUpIcon, SearchIcon } from '../components/icons';
import { SearchNotesModal } from '../components/SearchContextModal';
import { NoteDetailScreen } from './NoteDetailScreen';
import {
  useCreateNoteMutation,
  useFailedNoteMutations,
  useNotesFeed,
  useNotesTags,
  useRetryFailedNoteMutation,
  useUpdateNoteMutation,
} from '../hooks/useNotes';

function NoteCard({
  note,
  onPress,
  onToggleUrgent,
  onToggleImportant,
  syncFailed,
  onRetrySync,
  styles,
  colors,
}: {
  note: NoteSummary;
  onPress: () => void;
  onToggleUrgent: () => void;
  onToggleImportant: () => void;
  syncFailed?: boolean;
  onRetrySync?: () => void;
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
                accessibilityLabel={
                  note.is_urgent ? 'Mark not urgent' : 'Mark urgent'
                }
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
      <Text style={styles.cardDate}>
        {formatNoteDate(note.note_date)}
        {syncFailed ? (
          <Text
            style={{ color: colors.destructive }}
            onPress={onRetrySync}
          >
            {'  '}
            Sync failed · Retry
          </Text>
        ) : null}
      </Text>
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
  openNoteId = null,
  onOpenNoteConsumed,
  onAddLink,
  onSaveToMemory,
}: {
  notesRefreshToken?: number;
  isVisible?: boolean;
  openNoteId?: string | null;
  onOpenNoteConsumed?: () => void;
  onAddLink?: () => void;
  onSaveToMemory?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [localNotes, setLocalNotes] = useState<NoteSummary[]>([]);

  const feedQuery = useNotesFeed(activeTag);
  const tagsQuery = useNotesTags();
  const createMutation = useCreateNoteMutation();
  const updateMutation = useUpdateNoteMutation();
  const failedMutations = useFailedNoteMutations();
  const retryFailed = useRetryFailedNoteMutation();

  const serverNotes = useMemo(
    () => feedQuery.data?.pages.flatMap(page => page.items) ?? [],
    [feedQuery.data],
  );

  const notes = useMemo(() => {
    if (activeTag) {
      return serverNotes;
    }
    const serverIds = new Set(serverNotes.map(n => n.id));
    const locals = localNotes.filter(n => !serverIds.has(n.id));
    return [...locals, ...serverNotes].sort(
      (a, b) =>
        new Date(b.note_date).getTime() - new Date(a.note_date).getTime(),
    );
  }, [activeTag, localNotes, serverNotes]);

  const tags = useMemo(() => {
    const fromFacets = feedQuery.data?.pages[0]?.facets;
    if (fromFacets?.length) {
      return fromFacets;
    }
    return tagsQuery.data ?? [];
  }, [feedQuery.data, tagsQuery.data]);

  const failedByNoteId = useMemo(() => {
    const map = new Map<string, (typeof failedMutations)[number]>();
    for (const failure of failedMutations) {
      map.set(failure.noteId, failure);
    }
    return map;
  }, [failedMutations]);

  const showInitialSpinner =
    feedQuery.isLoading && !feedQuery.isPlaceholderData && notes.length === 0;

  const refreshLocals = useCallback(async () => {
    try {
      const localSummaries = await listLocalDeviceNoteSummaries();
      setLocalNotes(localSummaries);
    } catch {
      setLocalNotes([]);
    }
  }, []);

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    void refreshLocals();
    void feedQuery.refetch();
    void tagsQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token/visibility driven refresh
  }, [isVisible, notesRefreshToken, refreshLocals]);

  useEffect(() => {
    if (!openNoteId) {
      return;
    }
    setSelectedNoteId(openNoteId);
    onOpenNoteConsumed?.();
  }, [openNoteId, onOpenNoteConsumed]);

  const toggleFlag = async (
    note: NoteSummary,
    field: 'is_urgent' | 'is_important',
  ) => {
    if (isLocalDeviceNoteId(note.id)) return;
    setActionError(null);
    try {
      await updateMutation.mutateAsync({
        id: note.id,
        patch: { [field]: !note[field] },
      });
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to update note');
    }
  };

  const openNote = (note: NoteSummary) => {
    setSelectedNoteId(note.id);
  };

  if (selectedNoteId) {
    return (
      <NoteDetailScreen
        noteId={selectedNoteId}
        onClose={() => setSelectedNoteId(null)}
        onUpdated={() => {
          void feedQuery.refetch();
        }}
        onDeleted={() => {
          void feedQuery.refetch();
          void tagsQuery.refetch();
        }}
      />
    );
  }

  const handleCreateNote = async () => {
    const trimmed = draft.trim();
    if (!trimmed || createMutation.isPending) {
      return;
    }

    setActionError(null);
    try {
      await createMutation.mutateAsync({ content: trimmed, id: newNoteId() });
      setDraft('');
      if (activeTag) {
        setActiveTag(null);
      }
      void tagsQuery.refetch();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to save note');
    }
  };

  const error =
    actionError ??
    (feedQuery.error instanceof Error ? feedQuery.error.message : null);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Notes</Text>
        <View style={styles.headerActions}>
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
        </View>
      </View>

      <View style={styles.composeRow}>
        <TextInput
          style={styles.composeInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Jot down a note…"
          placeholderTextColor={colors.muted}
          multiline
          editable={!createMutation.isPending}
          returnKeyType="default"
          blurOnSubmit={false}
        />
        <Pressable
          style={({ pressed }) => [
            styles.composeSend,
            draft.trim().length > 0 &&
              !createMutation.isPending &&
              styles.composeSendActive,
            pressed && styles.composeSendPressed,
          ]}
          onPress={() => void handleCreateNote()}
          disabled={!draft.trim() || createMutation.isPending}
          accessibilityRole="button"
          accessibilityLabel="Save note"
        >
          {createMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <ArrowUpIcon
              size={18}
              color={draft.trim() ? colors.white : colors.muted}
            />
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
            onPress={() => setActiveTag(null)}
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
              style={[
                styles.filterChip,
                activeTag === t.tag && styles.filterChipActive,
              ]}
              onPress={() => setActiveTag(t.tag)}
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

      {failedMutations.length > 0 ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>
            {failedMutations.length} sync{' '}
            {failedMutations.length === 1 ? 'change' : 'changes'} failed
          </Text>
          {failedMutations.slice(0, 3).map(failure => (
            <Pressable
              key={failure.id}
              onPress={() => {
                void retryFailed(failure).catch((err: unknown) => {
                  setActionError(
                    err instanceof Error ? err.message : 'Retry failed',
                  );
                });
              }}
            >
              <Text style={[styles.errorText, { marginTop: 6 }]}>
                Retry: {failure.message}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {showInitialSpinner ? (
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
                  Jot a note above, or save links and documents for Donna to turn
                  into notes.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const failure = failedByNoteId.get(item.id);
            return (
              <NoteCard
                note={item}
                onPress={() => openNote(item)}
                onToggleUrgent={() => void toggleFlag(item, 'is_urgent')}
                onToggleImportant={() => void toggleFlag(item, 'is_important')}
                syncFailed={Boolean(failure)}
                onRetrySync={
                  failure
                    ? () => {
                        void retryFailed(failure).catch((err: unknown) => {
                          setActionError(
                            err instanceof Error ? err.message : 'Retry failed',
                          );
                        });
                      }
                    : undefined
                }
                styles={styles}
                colors={colors}
              />
            );
          }}
          ListFooterComponent={
            feedQuery.hasNextPage && notes.length > 0 ? (
              <Pressable
                style={({ pressed }) => [
                  styles.loadMore,
                  pressed && styles.loadMorePressed,
                ]}
                onPress={() => void feedQuery.fetchNextPage()}
                disabled={feedQuery.isFetchingNextPage}
              >
                {feedQuery.isFetchingNextPage ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.loadMoreText}>Load more</Text>
                )}
              </Pressable>
            ) : null
          }
        />
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
