import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '../components/ThemedText';
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
import { ArrowUpIcon, PaperclipIcon } from '../components/icons';
import { MicButton } from '../components/MicButton';
import { NoteDetailScreen } from './NoteDetailScreen';
import { TagTaxonomyPanel } from '../components/TagTaxonomyPanel';
import {
  useCreateNoteMutation,
  useFailedNoteMutations,
  useNotesFeed,
  useNotesTags,
  useRetryFailedNoteMutation,
  useUpdateNoteMutation,
} from '../hooks/useNotes';
import { useVoiceSession } from '../hooks/useVoiceSession';
import {
  enrichmentLabel,
  noteTagList,
  noteThumbUrl,
  sourceLabel,
} from '../lib/noteDisplay';
import {
  MAX_CHAT_ATTACHMENTS,
  pickPhotoForChat,
  type PendingAttachment,
} from '../lib/chatAttachments';

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
  const source = sourceLabel(note.source_type);
  const enrichment = enrichmentLabel(note.enrichment_status);
  const tagsForNote = noteTagList(note);
  const statusPill = enrichment ?? (source
    ? { label: source, tone: 'muted' as const }
    : null);
  const body = note.preview?.trim() || note.title;
  const thumb = noteThumbUrl(note);
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.cardThumb} />
      ) : null}
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardBodyText} numberOfLines={5}>
            {body}
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
        {tagsForNote.length > 0 ? (
          <View style={styles.tagRow}>
            {tagsForNote.slice(0, 4).map(tag => (
              <Text key={tag} style={styles.metaTag}>
                #{tag}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.cardDate}>{formatNoteDate(note.note_date)}</Text>
        <View style={styles.cardFooterRight}>
          {syncFailed ? (
            <Text style={{ color: colors.destructive }} onPress={onRetrySync}>
              Sync failed
            </Text>
          ) : null}
          {statusPill ? (
            <Text
              style={[
                styles.statusPill,
                statusPill.tone === 'error' && {
                  borderColor: colors.destructive,
                  color: colors.destructive,
                },
                statusPill.tone === 'warn' && {
                  borderColor: colors.primary,
                  color: colors.primary,
                },
              ]}
            >
              {statusPill.label}
            </Text>
          ) : null}
        </View>
      </View>
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
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [localNotes, setLocalNotes] = useState<NoteSummary[]>([]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 200);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const feedQuery = useNotesFeed({ tag: activeTag, q: debouncedSearch });
  const tagsQuery = useNotesTags();
  const createMutation = useCreateNoteMutation();
  const updateMutation = useUpdateNoteMutation();
  const failedMutations = useFailedNoteMutations();
  const retryFailed = useRetryFailedNoteMutation();

  const {
    state: micState,
    toggleTalk,
    sessionLabel,
    errorMsg: voiceError,
    disabled: micDisabled,
  } = useVoiceSession({
    mode: 'notes',
    onNoteCreated: () => {
      setActionError(null);
      if (activeTag) {
        setActiveTag(null);
      }
      void feedQuery.refetch();
      void tagsQuery.refetch();
    },
  });

  useEffect(() => {
    if (voiceError) {
      setActionError(voiceError);
    }
  }, [voiceError]);

  const voiceBusy =
    micState === 'listening' ||
    micState === 'processing' ||
    micState === 'requesting';
  const showMic = draft.trim().length === 0 && pendingAttachments.length === 0;

  const serverNotes = useMemo(
    () => feedQuery.data?.pages.flatMap(page => page.items) ?? [],
    [feedQuery.data],
  );

  const notes = useMemo(() => {
    if (activeTag || debouncedSearch) {
      return serverNotes;
    }
    // Local device placeholders use `device:…` ids; server notes use UUIDs.
    // listLocalDeviceNoteSummaries already drops uploaded captures, so this
    // only needs to avoid colliding ids if one ever appears in both lists.
    const serverIds = new Set(serverNotes.map(n => n.id));
    const locals = localNotes.filter(n => !serverIds.has(n.id));
    return [...locals, ...serverNotes].sort(
      (a, b) =>
        new Date(b.note_date).getTime() - new Date(a.note_date).getTime(),
    );
  }, [activeTag, debouncedSearch, localNotes, serverNotes]);

  const tags = useMemo(() => {
    const fromFacets = feedQuery.data?.pages[0]?.facets;
    const base = fromFacets?.length
      ? fromFacets
      : (tagsQuery.data ?? []).map(t => ({
          tag: t.tag,
          count: t.count,
          pinned: false as boolean | undefined,
        }));
    return [...base].sort((a, b) => {
      const ap = a.pinned ? 1 : 0;
      const bp = b.pinned ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return b.count - a.count;
    });
  }, [feedQuery.data, tagsQuery.data]);

  const visibleTags = pinnedOnly ? tags.filter(t => t.pinned) : tags;

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
    const photos = pendingAttachments;
    if ((!trimmed && photos.length === 0) || createMutation.isPending) {
      return;
    }

    setActionError(null);
    try {
      await createMutation.mutateAsync({
        content: trimmed,
        id: newNoteId(),
        attachments: photos.length ? photos.map(att => att.payload) : undefined,
      });
      setDraft('');
      setPendingAttachments([]);
      if (activeTag) {
        setActiveTag(null);
      }
      void tagsQuery.refetch();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to save note');
    }
  };

  const handleAttach = async () => {
    if (createMutation.isPending || voiceBusy) {
      return;
    }
    setActionError(null);
    try {
      const next = await pickPhotoForChat(
        MAX_CHAT_ATTACHMENTS - pendingAttachments.length,
      );
      if (next.length > 0) {
        setPendingAttachments(prev => [...prev, ...next]);
      }
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Could not attach photo',
      );
    }
  };

  const error =
    actionError ??
    (feedQuery.error instanceof Error ? feedQuery.error.message : null);

  const listHeader = (
    <View>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search notes…"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      <TagTaxonomyPanel
        onChanged={() => {
          void feedQuery.refetch();
          void tagsQuery.refetch();
        }}
      />

      <View style={styles.composeWrap}>
        <View style={styles.composeBox}>
          {pendingAttachments.length > 0 ? (
            <View style={styles.attachmentRow}>
              {pendingAttachments.map(att => (
                <View key={att.id} style={styles.attachmentChip}>
                  {att.previewUri ? (
                    <Image
                      source={{ uri: att.previewUri }}
                      style={styles.thumb}
                    />
                  ) : null}
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {att.filename}
                  </Text>
                  <Pressable
                    onPress={() =>
                      setPendingAttachments(prev =>
                        prev.filter(item => item.id !== att.id),
                      )
                    }
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${att.filename}`}
                  >
                    <Text style={styles.attachmentRemove}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          <TextInput
            style={styles.composeInput}
            value={draft}
            onChangeText={setDraft}
            placeholder={
              voiceBusy ? 'Listening…' : 'Jot down a note… or add a photo'
            }
            placeholderTextColor={colors.muted}
            multiline
            editable={!createMutation.isPending && !voiceBusy}
            returnKeyType="default"
            blurOnSubmit={false}
          />
          {sessionLabel && micState !== 'error' ? (
            <Text style={styles.composeSessionLabel}>{sessionLabel}</Text>
          ) : null}
          <View style={styles.composeToolbar}>
            {onAddLink || onSaveToMemory ? (
              <View style={styles.ingestActions}>
                {onAddLink ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.ingestButton,
                      (pressed || voiceBusy) && styles.ingestButtonPressed,
                    ]}
                    onPress={onAddLink}
                    disabled={voiceBusy}
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
                      (pressed || voiceBusy) && styles.ingestButtonPressed,
                    ]}
                    onPress={onSaveToMemory}
                    disabled={voiceBusy}
                    accessibilityRole="button"
                    accessibilityLabel="Save to memory"
                  >
                    <Text style={styles.ingestButtonText}>Save to memory</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View style={styles.ingestActions} />
            )}
            <View style={styles.composeTrailing}>
              <Pressable
                style={({ pressed }) => [
                  styles.composeAttach,
                  (pressed || voiceBusy) && styles.composeSendPressed,
                ]}
                onPress={() => void handleAttach()}
                disabled={createMutation.isPending || voiceBusy}
                accessibilityRole="button"
                accessibilityLabel="Attach to note"
              >
                <PaperclipIcon size={20} color={colors.muted} />
              </Pressable>
              {showMic ? (
                <MicButton
                  variant="inline"
                  state={micState}
                  onPress={() => {
                    setActionError(null);
                    void toggleTalk();
                  }}
                  disabled={micDisabled || createMutation.isPending}
                />
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.composeSend,
                    (draft.trim().length > 0 ||
                      pendingAttachments.length > 0) &&
                      !createMutation.isPending &&
                      !voiceBusy &&
                      styles.composeSendActive,
                    pressed && styles.composeSendPressed,
                  ]}
                  onPress={() => void handleCreateNote()}
                  disabled={
                    (!draft.trim() && pendingAttachments.length === 0) ||
                    createMutation.isPending ||
                    voiceBusy
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Save note"
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <ArrowUpIcon
                      size={18}
                      color={
                        draft.trim() || pendingAttachments.length > 0
                          ? colors.primary
                          : colors.muted
                      }
                    />
                  )}
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </View>

      {visibleTags.length > 0 || pinnedOnly ? (
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagFilterRow}
        >
          <Pressable
            style={[
              styles.filterChip,
              activeTag === null && styles.filterChipActive,
            ]}
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
          {visibleTags.map(t => (
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
                {t.pinned ? '* ' : ''}#{t.tag} {t.count}
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
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notes</Text>
        <Pressable
          style={({ pressed }) => [
            styles.pinToggle,
            pinnedOnly && styles.pinToggleActive,
            pressed && styles.iconButtonPressed,
          ]}
          onPress={() => setPinnedOnly(prev => !prev)}
          accessibilityRole="button"
          accessibilityLabel="Show pinned tags"
        >
          <Text
            style={[
              styles.pinToggleText,
              pinnedOnly && styles.pinToggleTextActive,
            ]}
          >
            Pinned
          </Text>
        </Pressable>
      </View>

      <FlatList
        style={styles.list}
        data={showInitialSpinner ? [] : notes}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={listHeader}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
            void feedQuery.fetchNextPage();
          }
        }}
        ListEmptyComponent={
          showInitialSpinner ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : !error ? (
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
          feedQuery.isFetchingNextPage ? (
            <ActivityIndicator
              style={{ marginVertical: 12 }}
              size="small"
              color={colors.primary}
            />
          ) : null
        }
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
    list: {
      flex: 1,
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
    pinToggle: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.surface,
    },
    pinToggleActive: {
      borderColor: colors.primary,
      backgroundColor: colors.background,
    },
    pinToggleText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
    },
    pinToggleTextActive: {
      color: colors.primary,
    },
    iconButtonPressed: {
      backgroundColor: colors.surface,
    },
    searchWrap: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    searchInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.background,
    },
    composeWrap: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    composeBox: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    composeInput: {
      minHeight: 120,
      maxHeight: 240,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      lineHeight: 22,
      color: colors.text,
      backgroundColor: 'transparent',
    },
    composeSessionLabel: {
      paddingHorizontal: 14,
      paddingBottom: 8,
      fontSize: 13,
      color: colors.muted,
    },
    composeToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    composeTrailing: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    composeAttach: {
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    composeSend: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    composeSendActive: {
      backgroundColor: colors.surface,
    },
    composeSendPressed: {
      opacity: 0.85,
    },
    ingestActions: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    ingestButton: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    ingestButtonPressed: {
      opacity: 0.85,
    },
    ingestButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    attachmentRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 10,
      paddingTop: 10,
    },
    attachmentChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: 176,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 6,
      backgroundColor: colors.surface,
    },
    thumb: {
      width: 28,
      height: 28,
      borderRadius: 6,
    },
    attachmentName: {
      flexShrink: 1,
      fontSize: 12,
      fontWeight: '500',
      color: colors.text,
    },
    attachmentRemove: {
      fontSize: 12,
      color: colors.muted,
      paddingHorizontal: 2,
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
      minHeight: 160,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      flexGrow: 1,
      paddingBottom: 24,
      gap: 12,
    },
    card: {
      width: 'auto',
      marginHorizontal: 16,
      minHeight: 140,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 16,
    },
    cardPressed: {
      opacity: 0.92,
    },
    cardThumb: {
      width: '100%',
      height: 112,
      borderRadius: 8,
      marginBottom: 10,
      backgroundColor: colors.background,
    },
    cardBody: {
      flexGrow: 1,
      gap: 8,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
    },
    cardBodyText: {
      flex: 1,
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
    },
    flagActions: {
      flexDirection: 'row',
      gap: 4,
    },
    flagButton: {
      fontSize: 16,
      color: colors.muted,
      paddingHorizontal: 4,
      opacity: 0.55,
    },
    cardFooter: {
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    cardFooterRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    cardDate: {
      fontSize: 12,
      color: colors.muted,
    },
    statusPill: {
      fontSize: 11,
      color: colors.muted,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      overflow: 'hidden',
      textTransform: 'capitalize',
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    metaTag: {
      fontSize: 11,
      color: colors.muted,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
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
