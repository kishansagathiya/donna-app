import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '../components/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { NoteAudioPlayer } from '../components/NoteAudioPlayer';
import { useTheme } from '../hooks/useTheme';
import {
  extractHashtags,
  formatNoteDate,
  getNote,
  getNoteTags,
  type Note,
  type NoteSummary,
} from '../services/notesApi';
import {
  deleteLocalDeviceCapture,
  getLocalDeviceCapture,
  isLocalDeviceNoteId,
  localCaptureToDetail,
  parseLocalDeviceNoteId,
} from '../services/localDeviceCaptures';
import {
  useDeleteNoteMutation,
  useFailedNoteMutations,
  useRetryFailedNoteMutation,
  useSetNoteTagsMutation,
  useUpdateNoteMutation,
} from '../hooks/useNotes';
import type { ThemeColors } from '../theme/colors';

type Props = {
  noteId: string;
  onClose: () => void;
  onUpdated?: (note: NoteSummary) => void;
  onDeleted?: (noteId: string) => void;
};

function toSummary(note: Note): NoteSummary {
  return {
    id: note.id,
    title: note.title,
    preview: note.preview,
    note_date: note.note_date,
    is_important: note.is_important,
    is_urgent: note.is_urgent,
    source_type: note.source_type,
    keywords: note.keywords,
    category: note.category,
    has_audio: note.has_audio,
  };
}

export function NoteDetailScreen({
  noteId,
  onClose,
  onUpdated,
  onDeleted,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [item, setItem] = useState<Note | null>(null);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isLocalDeviceNote = isLocalDeviceNoteId(noteId);
  const updateMutation = useUpdateNoteMutation();
  const deleteMutation = useDeleteNoteMutation();
  const tagsMutation = useSetNoteTagsMutation();
  const failedMutations = useFailedNoteMutations();
  const retryFailed = useRetryFailedNoteMutation();
  const failure = failedMutations.find(f => f.noteId === noteId);
  const saving = updateMutation.isPending;
  const savingTags = tagsMutation.isPending;

  const loadNote = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isLocalDeviceNote) {
        const localId = parseLocalDeviceNoteId(noteId);
        if (!localId) throw new Error('Note not found');
        const capture = await getLocalDeviceCapture(localId);
        if (!capture) throw new Error('Note not found');
        const loaded = localCaptureToDetail(capture);
        setItem(loaded);
        setContent(loaded.content);
        setTags([]);
        return;
      }
      const [loaded, tagRes] = await Promise.all([
        getNote(noteId),
        getNoteTags(noteId),
      ]);
      setItem(loaded);
      setContent(loaded.content);
      setTags(tagRes.tags ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Note not found');
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [isLocalDeviceNote, noteId]);

  useEffect(() => {
    void loadNote();
  }, [loadNote]);

  const handleSave = async () => {
    if (!item || isLocalDeviceNote) {
      return;
    }
    setError(null);
    try {
      const updated = await updateMutation.mutateAsync({
        id: noteId,
        patch: {
          content,
          content_version: item.content_version,
        },
      });
      setItem(updated);
      onUpdated?.(toSummary(updated));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const toggleFlag = async (field: 'is_urgent' | 'is_important') => {
    if (!item || isLocalDeviceNote) {
      return;
    }
    const next = !item[field];
    setItem({ ...item, [field]: next });
    setError(null);
    try {
      const updated = await updateMutation.mutateAsync({
        id: noteId,
        patch: { [field]: next },
      });
      setItem(updated);
      onUpdated?.(toSummary(updated));
    } catch (err: unknown) {
      setItem(item);
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete note?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              if (isLocalDeviceNote) {
                const localId = parseLocalDeviceNoteId(noteId);
                if (localId) await deleteLocalDeviceCapture(localId);
              } else {
                await deleteMutation.mutateAsync(noteId);
              }
              onDeleted?.(noteId);
              onClose();
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : 'Failed to delete');
            }
          })();
        },
      },
    ]);
  };

  const persistTags = async (next: string[]) => {
    if (isLocalDeviceNote) {
      return;
    }
    setTags(next);
    setError(null);
    try {
      const res = await tagsMutation.mutateAsync({ id: noteId, tags: next });
      setTags(res.tags ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save tags');
    }
  };

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/^#/, '');
    if (!tag || tags.includes(tag)) {
      setTagInput('');
      return;
    }
    const next = [...tags, tag];
    setTags(next);
    setTagInput('');
    void persistTags(next);
  };

  const removeTag = (tag: string) => {
    const next = tags.filter(t => t !== tag);
    setTags(next);
    void persistTags(next);
  };

  const keywordSuggestions =
    item?.keywords
      ?.filter(k => !tags.includes(k.toLowerCase()))
      .slice(0, 8) ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to notes"
        >
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {item?.title ?? 'Note'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !item ? (
        <View style={styles.centered}>
          <Text style={styles.mutedText}>{error ?? 'Note not found'}</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top + 56}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.flagRow}>
              {item.source_type === 'integration' ? (
                <View style={styles.flagChip}>
                  <Text style={styles.flagChipText}>From Granola</Text>
                </View>
              ) : null}
              {!isLocalDeviceNote ? (
                <>
              <Pressable
                style={[
                  styles.flagChip,
                  item.is_urgent && styles.flagChipUrgent,
                ]}
                onPress={() => void toggleFlag('is_urgent')}
              >
                <Text
                  style={[
                    styles.flagChipText,
                    item.is_urgent && styles.flagChipTextUrgent,
                  ]}
                >
                  {item.is_urgent ? 'Urgent' : 'Not urgent'}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.flagChip,
                  item.is_important && styles.flagChipImportant,
                ]}
                onPress={() => void toggleFlag('is_important')}
              >
                <Text
                  style={[
                    styles.flagChipText,
                    item.is_important && styles.flagChipTextImportant,
                  ]}
                >
                  {item.is_important ? 'Important' : 'Not important'}
                </Text>
              </Pressable>
                </>
              ) : null}
            </View>

            <Text style={styles.meta}>
              {formatNoteDate(item.note_date)}
              {item.source_type !== 'manual' &&
              item.source_type !== 'integration'
                ? ` · from ${item.source_type.replace('_', ' ')}`
                : ''}
            </Text>

            {item.audio_url ? (
              <NoteAudioPlayer url={item.audio_url} />
            ) : null}

            {!isLocalDeviceNote ? (
              <>
            <Text style={styles.sectionLabel}>Tags</Text>
            <View style={styles.tagRow}>
              {tags.map(tag => (
                <Pressable
                  key={tag}
                  style={styles.tagChip}
                  onPress={() => removeTag(tag)}
                  disabled={savingTags}
                  accessibilityLabel={`Remove tag ${tag}`}
                >
                  <Text style={styles.tagChipText}>#{tag} ×</Text>
                </Pressable>
              ))}
              {tags.length === 0 ? (
                <Text style={styles.mutedText}>No tags yet.</Text>
              ) : null}
            </View>
            {keywordSuggestions.length > 0 ? (
              <View style={styles.suggestionRow}>
                <Text style={styles.suggestionLabel}>Suggested:</Text>
                {keywordSuggestions.map(kw => (
                  <Pressable
                    key={kw}
                    style={styles.suggestionChip}
                    onPress={() => addTag(kw)}
                    disabled={savingTags}
                  >
                    <Text style={styles.suggestionChipText}>+{kw}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <TextInput
              style={styles.tagInput}
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={() => addTag(tagInput)}
              returnKeyType="done"
              placeholder="Add a tag…"
              placeholderTextColor={colors.muted}
              editable={!savingTags}
            />
            {extractHashtags(content).length > 0 ? (
              <Text style={styles.hashtagHint}>
                {extractHashtags(content).length} #tag(s) in note
              </Text>
            ) : null}
              </>
            ) : null}

            <TextInput
              style={styles.contentInput}
              value={content}
              onChangeText={setContent}
              placeholder="Note…"
              placeholderTextColor={colors.muted}
              multiline
              textAlignVertical="top"
              editable={!isLocalDeviceNote}
            />

            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {failure ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{failure.message}</Text>
                <Pressable
                  onPress={() => {
                    void retryFailed(failure).catch((err: unknown) => {
                      setError(
                        err instanceof Error ? err.message : 'Retry failed',
                      );
                    });
                  }}
                >
                  <Text style={[styles.errorText, { marginTop: 8 }]}>
                    Retry sync
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <Text style={styles.footerMeta}>
              Created {formatNoteDate(item.created_at)}
            </Text>
          </ScrollView>

          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <Pressable
              style={styles.deleteButton}
              onPress={handleDelete}
              accessibilityRole="button"
              accessibilityLabel="Delete note"
            >
              <Text style={styles.deleteButtonText}>Delete</Text>
            </Pressable>
            {!isLocalDeviceNote ? (
            <Pressable
              style={[styles.saveButton, saving && styles.buttonDisabled]}
              onPress={() => void handleSave()}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Save note"
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </Pressable>
            ) : null}
          </View>
        </KeyboardAvoidingView>
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
    flex: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 8,
    },
    backText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      minWidth: 48,
    },
    headerTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    headerSpacer: {
      minWidth: 48,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 24,
    },
    flagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    flagChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.surface,
    },
    flagChipUrgent: {
      borderColor: colors.destructive,
      backgroundColor: `${colors.destructive}18`,
    },
    flagChipImportant: {
      borderColor: colors.primaryRing,
      backgroundColor: colors.primaryLight,
    },
    flagChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    flagChipTextUrgent: {
      color: colors.destructive,
    },
    flagChipTextImportant: {
      color: colors.primary,
    },
    meta: {
      fontSize: 13,
      color: colors.muted,
      marginBottom: 16,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 8,
    },
    tagChip: {
      backgroundColor: colors.surface,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    tagChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    suggestionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    suggestionLabel: {
      fontSize: 12,
      color: colors.muted,
    },
    suggestionChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    suggestionChipText: {
      fontSize: 12,
      color: colors.muted,
    },
    tagInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.background,
      marginBottom: 4,
    },
    hashtagHint: {
      fontSize: 12,
      color: colors.muted,
      marginBottom: 12,
    },
    contentInput: {
      minHeight: 240,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 16,
      lineHeight: 24,
      color: colors.text,
      backgroundColor: colors.background,
      marginTop: 8,
    },
    mutedText: {
      fontSize: 13,
      color: colors.muted,
    },
    errorBanner: {
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
    footerMeta: {
      marginTop: 12,
      fontSize: 12,
      color: colors.muted,
    },
    footer: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    deleteButton: {
      borderWidth: 1,
      borderColor: `${colors.destructive}50`,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteButtonText: {
      color: colors.destructive,
      fontSize: 16,
      fontWeight: '600',
    },
    saveButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  });
}
