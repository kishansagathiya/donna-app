import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '../components/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import {
  acceptMemoryItem,
  acceptMemorySuggestion,
  createMemoryFact,
  deleteMemoryItem,
  formatFactDate,
  isSuggestionItem,
  listMemoryGrouped,
  listMemoryItems,
  markMemoryOutdated,
  rejectMemoryItem,
  rejectMemorySuggestion,
  resolveMemoryItem,
  resolveMemorySuggestion,
  suggestionIdOf,
  updateMemoryItem,
  type MemoryGroup,
  type MemoryItem,
  type MemoryListStatus,
} from '../services/memoryApi';
import type { ThemeColors } from '../theme/colors';

type TabId = 'grouped' | MemoryListStatus;

const TABS: { id: TabId; label: string }[] = [
  { id: 'grouped', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'sensitive', label: 'Sensitive' },
  { id: 'conflicting', label: 'Conflicts' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'outdated', label: 'Outdated' },
];

type FactModalProps = {
  visible: boolean;
  title: string;
  text: string;
  placeholder?: string;
  saving: boolean;
  saveLabel: string;
  savingLabel: string;
  onChangeText: (text: string) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
};

function FactModal({
  visible,
  title,
  text,
  placeholder,
  saving,
  saveLabel,
  savingLabel,
  onChangeText,
  onClose,
  onSave,
  onDelete,
}: FactModalProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalAvoiding}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose}>
          <Pressable
            style={[
              styles.modalCard,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
            onPress={e => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.modalCloseText}>Cancel</Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <TextInput
                style={[styles.input, styles.textArea, styles.modalTextArea]}
                value={text}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.muted}
                multiline
                autoFocus
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.primaryButton, saving && styles.buttonDisabled]}
                onPress={onSave}
                disabled={saving || !text.trim()}
              >
                <Text style={styles.primaryButtonText}>
                  {saving ? savingLabel : saveLabel}
                </Text>
              </Pressable>
              {onDelete ? (
                <Pressable style={styles.destructiveButton} onPress={onDelete}>
                  <Text style={styles.destructiveButtonText}>Delete</Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type Props = {
  onOpenNote?: (noteId: string) => void;
};

export function MemoryScreen({ onOpenNote }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [tab, setTab] = useState<TabId>('grouped');
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<MemoryGroup[]>([]);
  const [inbox, setInbox] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MemoryItem | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newFactText, setNewFactText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'grouped') {
        setGroups(await listMemoryGrouped(query));
        setInbox([]);
      } else {
        setInbox(await listMemoryItems({ status: tab, q: query }));
        setGroups([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load memory');
      setGroups([]);
      setInbox([]);
    } finally {
      setLoading(false);
    }
  }, [query, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleGroups = useMemo(
    () => groups.filter(g => g.items.length > 0),
    [groups],
  );

  const runAction = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await load();
      setSelected(null);
      setEditText('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!selected || !editText.trim()) return;
    setSaving(true);
    try {
      const sid = suggestionIdOf(selected);
      if (sid) {
        await resolveMemorySuggestion(sid, 'accept_new', editText.trim());
      } else {
        await updateMemoryItem(selected.id, { fact: editText.trim() });
      }
      await load();
      setSelected(null);
      setEditText('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!selected) return;
    Alert.alert('Delete memory', 'Remove this from Donna’s memory?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const sid = suggestionIdOf(selected);
            if (sid) {
              await runAction(selected.id, () => rejectMemorySuggestion(sid));
              return;
            }
            await runAction(selected.id, () => deleteMemoryItem(selected.id));
          })();
        },
      },
    ]);
  };

  const handleAdd = async () => {
    if (!newFactText.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createMemoryFact({ fact: newFactText.trim() });
      setNewFactText('');
      setShowAdd(false);
      setTab('grouped');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add memory');
    } finally {
      setSaving(false);
    }
  };

  const renderActions = (item: MemoryItem) => {
    const busy = busyId === item.id;
    return (
      <View style={styles.actionRow}>
        {(tab === 'pending' ||
          tab === 'sensitive' ||
          tab === 'conflicting' ||
          item.review_status === 'pending_review') && (
          <>
            <Pressable
              style={[styles.chipButton, busy && styles.buttonDisabled]}
              disabled={busy}
              onPress={() => {
                const sid = suggestionIdOf(item);
                void runAction(item.id, () =>
                  sid
                    ? acceptMemorySuggestion(sid)
                    : acceptMemoryItem(item.id),
                );
              }}
            >
              <Text style={styles.chipButtonText}>Accept</Text>
            </Pressable>
            <Pressable
              style={[styles.chipButtonSecondary, busy && styles.buttonDisabled]}
              disabled={busy}
              onPress={() => {
                const sid = suggestionIdOf(item);
                void runAction(item.id, () =>
                  sid
                    ? rejectMemorySuggestion(sid)
                    : rejectMemoryItem(item.id),
                );
              }}
            >
              <Text style={styles.chipButtonSecondaryText}>Reject</Text>
            </Pressable>
          </>
        )}
        {(item.conflicting || tab === 'conflicting') && (
          <>
            <Pressable
              style={[styles.chipButtonSecondary, busy && styles.buttonDisabled]}
              disabled={busy}
              onPress={() => {
                const sid = suggestionIdOf(item);
                void runAction(item.id, () =>
                  sid
                    ? resolveMemorySuggestion(sid, 'accept_new')
                    : resolveMemoryItem(item.id, 'accept_new'),
                );
              }}
            >
              <Text style={styles.chipButtonSecondaryText}>Use new</Text>
            </Pressable>
            <Pressable
              style={[styles.chipButtonSecondary, busy && styles.buttonDisabled]}
              disabled={busy}
              onPress={() => {
                const sid = suggestionIdOf(item);
                void runAction(item.id, () =>
                  sid
                    ? resolveMemorySuggestion(sid, 'keep_existing')
                    : resolveMemoryItem(item.id, 'keep_existing'),
                );
              }}
            >
              <Text style={styles.chipButtonSecondaryText}>Keep existing</Text>
            </Pressable>
          </>
        )}
        {!isSuggestionItem(item) ? (
          <Pressable
            style={[styles.chipButtonSecondary, busy && styles.buttonDisabled]}
            disabled={busy}
            onPress={() =>
              void runAction(item.id, () => markMemoryOutdated(item.id))
            }
          >
            <Text style={styles.chipButtonSecondaryText}>Outdated</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderItem = (item: MemoryItem) => {
    const evidence = item.evidence ?? [];
    const showEvidenceToggle =
      evidence.length > 0 || !isSuggestionItem(item);
    const evidenceOpen = expandedEvidence === item.id;

    return (
      <View key={item.id} style={styles.factCard}>
        <Pressable
          onPress={() => {
            setSelected(item);
            setEditText(item.fact);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Edit memory: ${item.fact}`}
        >
          <View style={styles.badgeRow}>
            {item.memory_kind ? (
              <Text style={styles.badge}>{item.memory_kind}</Text>
            ) : null}
            {item.sensitivity && item.sensitivity !== 'normal' ? (
              <Text style={[styles.badge, styles.badgeWarn]}>
                {item.sensitivity}
              </Text>
            ) : null}
            {item.conflicting ? (
              <Text style={[styles.badge, styles.badgeDanger]}>conflict</Text>
            ) : null}
            {item.review_status && item.review_status !== 'active' ? (
              <Text style={styles.badge}>
                {item.review_status.replace('_', ' ')}
              </Text>
            ) : null}
          </View>
          <Text style={styles.factText}>{item.fact}</Text>
          {item.created_at ? (
            <Text style={styles.factDate}>
              {formatFactDate(item.created_at)}
            </Text>
          ) : null}
        </Pressable>

        {showEvidenceToggle ? (
          <Pressable
            onPress={() =>
              setExpandedEvidence(cur => (cur === item.id ? null : item.id))
            }
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={
              evidenceOpen ? 'Hide source evidence' : 'Show source evidence'
            }
          >
            <Text style={styles.evidenceToggle}>
              {evidenceOpen ? 'Hide source' : 'Show source'}
            </Text>
          </Pressable>
        ) : null}

        {evidenceOpen ? (
          <View style={styles.evidenceBox}>
            {evidence.length === 0 ? (
              <Text style={styles.evidenceEmpty}>No linked evidence yet.</Text>
            ) : (
              evidence.map((ev, i) => (
                <View key={ev.id ?? `${item.id}-${i}`} style={styles.evidenceItem}>
                  <Text style={styles.evidenceKind}>{ev.source_kind}</Text>
                  {ev.source_id && ev.source_kind === 'note' && onOpenNote ? (
                    <Pressable
                      onPress={() => onOpenNote(ev.source_id!)}
                      accessibilityRole="link"
                      accessibilityLabel="Open source note"
                    >
                      <Text style={styles.evidenceLink}>Open note</Text>
                    </Pressable>
                  ) : null}
                  {ev.excerpt ? (
                    <Text style={styles.evidenceExcerpt}>{ev.excerpt}</Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        ) : null}

        {renderActions(item)}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Memory</Text>
          <Text style={styles.subtitle}>
            Review, edit, and trace what Donna knows
          </Text>
        </View>
        <Pressable
          style={styles.addButton}
          onPress={() => setShowAdd(true)}
          accessibilityRole="button"
          accessibilityLabel="Add memory"
        >
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
      </View>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
        contentContainerStyle={styles.tabsContent}
      >
        {TABS.map(t => (
          <Pressable
            key={t.id}
            style={[styles.tab, tab === t.id && styles.tabActive]}
            onPress={() => setTab(t.id)}
          >
            <Text
              style={[styles.tabText, tab === t.id && styles.tabTextActive]}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, styles.searchInput]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search memory…"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            onSubmitEditing={() => void load()}
          />
          <Pressable style={styles.searchButton} onPress={() => void load()}>
            <Text style={styles.searchButtonText}>
              {loading ? '…' : 'Search'}
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.factsLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : null}

        {!loading && tab === 'grouped' && visibleGroups.length === 0 ? (
          <Text style={styles.hint}>
            Donna learns from notes and chats, or add memories with +.
          </Text>
        ) : null}

        {!loading && tab !== 'grouped' && inbox.length === 0 ? (
          <Text style={styles.hint}>No {tab} memories.</Text>
        ) : null}

        {tab === 'grouped'
          ? visibleGroups.map(group => (
              <View key={group.kind}>
                <Text style={styles.sectionTitle}>
                  {group.label} ({group.items.length})
                </Text>
                {group.items.map(renderItem)}
              </View>
            ))
          : inbox.map(renderItem)}
      </ScrollView>

      <FactModal
        visible={selected !== null}
        title="Edit memory"
        text={editText}
        saving={saving}
        saveLabel="Save"
        savingLabel="Saving…"
        onChangeText={setEditText}
        onClose={() => {
          setSelected(null);
          setEditText('');
        }}
        onSave={() => void handleSaveEdit()}
        onDelete={handleDelete}
      />

      <FactModal
        visible={showAdd}
        title="New memory"
        text={newFactText}
        placeholder="Something Donna should remember…"
        saving={saving}
        saveLabel="Add"
        savingLabel="Adding…"
        onChangeText={setNewFactText}
        onClose={() => {
          setShowAdd(false);
          setNewFactText('');
        }}
        onSave={() => void handleAdd()}
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
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    subtitle: {
      marginTop: 2,
      fontSize: 14,
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    addButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonText: {
      fontSize: 22,
      lineHeight: 24,
      color: colors.primary,
      fontWeight: '500',
    },
    error: {
      color: colors.destructive,
      paddingHorizontal: 20,
      paddingTop: 8,
      fontSize: 14,
      fontFamily: colors.fontFamily,
    },
    tabs: {
      maxHeight: 48,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tabsContent: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 6,
      alignItems: 'center',
    },
    tab: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      marginHorizontal: 2,
    },
    tabActive: {
      backgroundColor: colors.surface,
    },
    tabText: {
      fontSize: 13,
      color: colors.muted,
      fontWeight: '500',
      fontFamily: colors.fontFamily,
    },
    tabTextActive: {
      color: colors.text,
    },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 32,
    },
    sectionTitle: {
      marginTop: 16,
      marginBottom: 8,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    factsLoading: {
      alignItems: 'center',
      paddingVertical: 24,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surface,
      fontFamily: colors.fontFamily,
    },
    textArea: {
      minHeight: 88,
      textAlignVertical: 'top',
    },
    primaryButton: {
      marginTop: 10,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: colors.white,
      fontWeight: '600',
      fontSize: 15,
      fontFamily: colors.fontFamily,
    },
    buttonDisabled: { opacity: 0.6 },
    searchRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 16,
      marginBottom: 8,
    },
    searchInput: { flex: 1 },
    searchButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 16,
      justifyContent: 'center',
      minWidth: 72,
      alignItems: 'center',
    },
    searchButtonText: {
      color: colors.white,
      fontWeight: '600',
      fontSize: 15,
      fontFamily: colors.fontFamily,
    },
    hint: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.muted,
      marginBottom: 8,
      fontFamily: colors.fontFamily,
    },
    factCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      backgroundColor: colors.background,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 6,
    },
    badge: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.muted,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      textTransform: 'uppercase',
      fontFamily: colors.fontFamily,
    },
    badgeWarn: {
      color: '#92400e',
      backgroundColor: '#fffbeb',
    },
    badgeDanger: {
      color: '#9f1239',
      backgroundColor: '#fff1f2',
    },
    factText: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    factDate: {
      marginTop: 8,
      fontSize: 12,
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    evidenceToggle: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
      fontFamily: colors.fontFamily,
      textDecorationLine: 'underline',
    },
    evidenceBox: {
      marginTop: 8,
      borderRadius: 10,
      backgroundColor: colors.surface,
      padding: 10,
      gap: 8,
    },
    evidenceEmpty: {
      fontSize: 12,
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    evidenceItem: {
      gap: 4,
    },
    evidenceKind: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
      fontFamily: colors.fontFamily,
      textTransform: 'capitalize',
    },
    evidenceLink: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
      fontFamily: colors.fontFamily,
      textDecorationLine: 'underline',
    },
    evidenceExcerpt: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.text,
      opacity: 0.85,
      fontFamily: colors.fontFamily,
    },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10,
    },
    chipButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    chipButtonText: {
      color: colors.white,
      fontSize: 12,
      fontWeight: '600',
      fontFamily: colors.fontFamily,
    },
    chipButtonSecondary: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.surface,
    },
    chipButtonSecondaryText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '500',
      fontFamily: colors.fontFamily,
    },
    modalAvoiding: { flex: 1 },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    modalCloseText: {
      color: colors.primary,
      fontSize: 16,
      fontFamily: colors.fontFamily,
    },
    modalScroll: { maxHeight: 220 },
    modalTextArea: { minHeight: 120 },
    modalActions: { marginTop: 8, gap: 8 },
    destructiveButton: {
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.destructive,
    },
    destructiveButtonText: {
      color: colors.destructive,
      fontWeight: '600',
      fontSize: 15,
      fontFamily: colors.fontFamily,
    },
  });
}
