import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from './ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import {
  createConversationShare,
  deleteConversation,
  formatConversationDate,
  getConversation,
  listConversationTags,
  listConversations,
  patchConversation,
  turnsToChatTurns,
  type ConversationSummary,
} from '../services/conversationsApi';
import { listAgentRuns, type AgentRun } from '../services/agentsApi';
import {
  agentStatusLabel,
  historyKindLabel,
  matchesHistoryQuery,
  mergeHistoryItems,
} from '../lib/unifiedHistory';
import type { ThemeColors } from '../theme/colors';
import type { ChatTurn } from './ChatMessages';
import {
  BotIcon,
  HistoryIcon,
  MessageSquareIcon,
  MicIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PinIcon,
  SearchIcon,
  TagIcon,
} from './icons';

type Props = {
  visible: boolean;
  onClose: () => void;
  selectedChatId?: string | null;
  selectedAgentId?: string | null;
  onResume: (
    conversationId: string,
    sessionId: string | undefined,
    messages: ChatTurn[],
  ) => void;
  onSelectAgent: (run: AgentRun) => void;
};

type FilterMode = 'active' | 'archived';
type EditMode = 'rename' | 'tags' | null;

export function ChatHistorySheet({
  visible,
  onClose,
  selectedChatId = null,
  selectedAgentId = null,
  onResume,
  onSelectAgent,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [loading, setLoading] = useState(false);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>(
    [],
  );
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('active');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<ConversationSummary | null>(
    null,
  );
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const includeAgents = filterMode === 'active' && !tagFilter;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [items, tags, agentRuns] = await Promise.all([
        listConversations({
          q: debouncedQuery || undefined,
          tag: tagFilter || undefined,
          archivedOnly: filterMode === 'archived',
          includeArchived: filterMode === 'archived',
          limit: 50,
        }),
        listConversationTags().catch(() => [] as string[]),
        includeAgents
          ? listAgentRuns().catch(() => [] as AgentRun[])
          : Promise.resolve([] as AgentRun[]),
      ]);
      setConversations(items);
      setAvailableTags(tags);
      setRuns(agentRuns);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
      setConversations([]);
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, filterMode, includeAgents, tagFilter]);

  const items = useMemo(() => {
    const agentRuns = includeAgents
      ? runs.filter(run =>
          matchesHistoryQuery(
            {
              kind: 'agent',
              id: run.id,
              updatedAt: run.updated_at,
              pinned: false,
              run,
            },
            debouncedQuery,
          ),
        )
      : [];
    return mergeHistoryItems(conversations, agentRuns);
  }, [conversations, debouncedQuery, includeAgents, runs]);

  useEffect(() => {
    if (visible) {
      void load();
    }
  }, [visible, load]);

  const emptyTitle = useMemo(() => {
    if (debouncedQuery) return 'No matching history';
    if (filterMode === 'archived') return 'No archived chats';
    if (tagFilter) return 'No chats with this tag';
    return 'No history yet';
  }, [debouncedQuery, filterMode, tagFilter]);

  async function handleSelectAgent(run: AgentRun) {
    onSelectAgent(run);
    onClose();
  }

  async function handleSelect(conversation: ConversationSummary) {
    setResumingId(conversation.id);
    setError(null);
    try {
      const detail = await getConversation(conversation.id);
      const turns: ChatTurn[] = turnsToChatTurns(detail.turns).map(
        (turn, index) => ({
          id: `history-${conversation.id}-${index}`,
          user: turn.user,
          historyUser: turn.historyUser,
          assistant: turn.assistant,
          attachments: turn.attachments,
        }),
      );
      const sessionId =
        detail.channel === 'text' ? detail.client_session_id : undefined;
      onResume(conversation.id, sessionId, turns);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to open conversation',
      );
    } finally {
      setResumingId(null);
    }
  }

  async function runAction(
    id: string,
    action: () => Promise<unknown>,
  ): Promise<void> {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  async function handleShare(conversation: ConversationSummary) {
    setBusyId(conversation.id);
    setError(null);
    try {
      const share = await createConversationShare(conversation.id);
      await Share.share({
        url: share.url,
        message: share.url,
        title: conversation.title,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share chat');
    } finally {
      setBusyId(null);
    }
  }

  function openActions(conversation: ConversationSummary) {
    const pinned = Boolean(conversation.pinned_at);
    const archived = Boolean(conversation.archived_at);
    Alert.alert(conversation.title, undefined, [
      {
        text: 'Rename',
        onPress: () => {
          setEditTarget(conversation);
          setEditMode('rename');
          setEditValue(conversation.title);
        },
      },
      {
        text: pinned ? 'Unpin' : 'Pin',
        onPress: () =>
          void runAction(conversation.id, () =>
            patchConversation(conversation.id, { pinned: !pinned }),
          ),
      },
      {
        text: archived ? 'Unarchive' : 'Archive',
        onPress: () =>
          void runAction(conversation.id, () =>
            patchConversation(conversation.id, { archived: !archived }),
          ),
      },
      {
        text: 'Tags…',
        onPress: () => {
          setEditTarget(conversation);
          setEditMode('tags');
          setEditValue((conversation.tags ?? []).join(', '));
        },
      },
      {
        text: 'Share…',
        onPress: () => void handleShare(conversation),
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Delete conversation?',
            'This permanently removes the chat. This cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () =>
                  void runAction(conversation.id, () =>
                    deleteConversation(conversation.id),
                  ),
              },
            ],
          );
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function submitEdit() {
    if (!editTarget || !editMode) return;
    if (editMode === 'rename') {
      const title = editValue.trim();
      if (!title || title === editTarget.title) {
        setEditMode(null);
        setEditTarget(null);
        return;
      }
      await runAction(editTarget.id, () =>
        patchConversation(editTarget.id, { title }),
      );
    } else {
      const tags = editValue
        .split(',')
        .map(t => t.trim().toLowerCase().replace(/^#/, ''))
        .filter(Boolean);
      await runAction(editTarget.id, () =>
        patchConversation(editTarget.id, { tags }),
      );
    }
    setEditMode(null);
    setEditTarget(null);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
          onPress={e => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={styles.title}>History</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              disabled={resumingId !== null}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.closeText}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.body}>
            <View style={styles.searchWrap}>
              <SearchIcon size={16} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search history…"
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </View>

            <View style={styles.filterRow}>
              <Pressable
                onPress={() => setFilterMode('active')}
                style={[
                  styles.filterChip,
                  filterMode === 'active' && styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filterMode === 'active' && styles.filterChipTextActive,
                  ]}
                >
                  Active
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setFilterMode('archived')}
                style={[
                  styles.filterChip,
                  filterMode === 'archived' && styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filterMode === 'archived' && styles.filterChipTextActive,
                  ]}
                >
                  Archived
                </Text>
              </Pressable>
              {availableTags.slice(0, 8).map(tag => (
                <Pressable
                  key={tag}
                  onPress={() =>
                    setTagFilter(prev => (prev === tag ? null : tag))
                  }
                  style={[
                    styles.tagChip,
                    tagFilter === tag && styles.tagChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tagChipText,
                      tagFilter === tag && styles.tagChipTextActive,
                    ]}
                  >
                    #{tag}
                  </Text>
                </Pressable>
              ))}
            </View>

            {error ? (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Text style={styles.errorText}>{error}</Text>
                <Pressable
                  onPress={() => setError(null)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss error"
                >
                  <Text style={styles.errorDismiss}>Dismiss</Text>
                </Pressable>
              </View>
            ) : null}

            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : items.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIconWrap}>
                  <HistoryIcon size={24} color={colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>{emptyTitle}</Text>
                <Text style={styles.emptyDescription}>
                  {debouncedQuery
                    ? 'Try a different keyword or clear filters.'
                    : 'Your past chats and agent runs will appear here.'}
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {items.map(item => {
                  if (item.kind === 'agent') {
                    const run = runs.find(r => r.id === item.run.id);
                    if (!run) return null;
                    const busy = busyId === run.id;
                    const selected = selectedAgentId === run.id;
                    return (
                      <View key={`agent:${run.id}`} style={styles.itemRow}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.item,
                            selected && styles.itemSelected,
                            pressed && styles.itemPressed,
                            busy && styles.itemDisabled,
                          ]}
                          disabled={busy || resumingId !== null || busyId !== null}
                          onPress={() => handleSelectAgent(run)}
                          accessibilityRole="button"
                          accessibilityLabel={`Agent: ${run.goal}`}
                        >
                          <View style={[styles.itemIcon, styles.itemIconAgent]}>
                            <BotIcon
                              size={16}
                              color={
                                colors.shadowEnabled ? '#0369A1' : colors.primary
                              }
                            />
                          </View>
                          <View style={styles.itemBody}>
                            <View style={styles.itemTitleRow}>
                              <Text style={styles.itemTitle} numberOfLines={2}>
                                {run.goal}
                              </Text>
                            </View>
                            <View style={styles.itemMetaRow}>
                              <Text style={styles.itemMeta}>
                                {formatConversationDate(run.updated_at)}
                                {` · ${historyKindLabel(item)}`}
                              </Text>
                              <View
                                style={[
                                  styles.statusBadge,
                                  run.status === 'succeeded' &&
                                    styles.statusBadgeOk,
                                  (run.status === 'failed' ||
                                    run.status === 'cancelled') &&
                                    styles.statusBadgeBad,
                                  run.status === 'waiting_for_user' &&
                                    styles.statusBadgeWait,
                                  (run.status === 'running' ||
                                    run.status === 'queued') &&
                                    styles.statusBadgeActive,
                                ]}
                              >
                                <Text style={styles.statusBadgeText}>
                                  {agentStatusLabel(run.status)}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </Pressable>
                      </View>
                    );
                  }

                  const conversation = conversations.find(
                    c => c.id === item.conversation.id,
                  );
                  if (!conversation) return null;
                  const isVoice = conversation.channel === 'voice';
                  const busy =
                    resumingId === conversation.id ||
                    busyId === conversation.id;
                  const pinned = Boolean(conversation.pinned_at);
                  const selected =
                    selectedChatId === conversation.id ||
                    resumingId === conversation.id;

                  return (
                    <View key={`chat:${conversation.id}`} style={styles.itemRow}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.item,
                          selected && styles.itemSelected,
                          pressed && styles.itemPressed,
                          (busy ||
                            resumingId !== null ||
                            busyId !== null) &&
                            styles.itemDisabled,
                        ]}
                        disabled={busy || resumingId !== null || busyId !== null}
                        onPress={() => void handleSelect(conversation)}
                        onLongPress={() => openActions(conversation)}
                        accessibilityRole="button"
                      >
                        <View
                          style={[
                            styles.itemIcon,
                            isVoice
                              ? styles.itemIconVoice
                              : styles.itemIconText,
                          ]}
                        >
                          {isVoice ? (
                            <MicIcon
                              size={16}
                              color={
                                colors.shadowEnabled ? '#9333EA' : colors.primary
                              }
                            />
                          ) : (
                            <MessageSquareIcon
                              size={16}
                              color={colors.primary}
                            />
                          )}
                        </View>
                        <View style={styles.itemBody}>
                          <View style={styles.itemTitleRow}>
                            {pinned ? (
                              <PinIcon size={12} color={colors.primary} />
                            ) : null}
                            <Text style={styles.itemTitle} numberOfLines={1}>
                              {conversation.title}
                            </Text>
                          </View>
                          {conversation.preview ? (
                            <Text style={styles.itemPreview} numberOfLines={1}>
                              {conversation.preview}
                            </Text>
                          ) : null}
                          <Text style={styles.itemMeta}>
                            {formatConversationDate(conversation.updated_at)}
                            {` · ${historyKindLabel(item)}`}
                            {conversation.tags && conversation.tags.length > 0
                              ? ` · ${conversation.tags
                                  .map(t => `#${t}`)
                                  .join(' ')}`
                              : ''}
                          </Text>
                        </View>
                        {busy ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.primary}
                            style={styles.itemSpinner}
                          />
                        ) : null}
                      </Pressable>
                      <Pressable
                        onPress={() => openActions(conversation)}
                        hitSlop={8}
                        style={styles.moreButton}
                        accessibilityRole="button"
                        accessibilityLabel="Conversation actions"
                        disabled={busy || busyId !== null}
                      >
                        <MoreHorizontalIcon size={18} color={colors.muted} />
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Pressable>

      <Modal
        visible={editMode !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setEditMode(null);
          setEditTarget(null);
        }}
      >
        <Pressable
          style={styles.editBackdrop}
          onPress={() => {
            setEditMode(null);
            setEditTarget(null);
          }}
        >
          <Pressable
            style={styles.editCard}
            onPress={e => e.stopPropagation()}
          >
            <Text style={styles.editTitle}>
              {editMode === 'rename' ? 'Rename chat' : 'Edit tags'}
            </Text>
            <Text style={styles.editHint}>
              {editMode === 'tags'
                ? 'Comma-separated tags, e.g. work, personal'
                : 'Choose a short title'}
            </Text>
            <TextInput
              value={editValue}
              onChangeText={setEditValue}
              autoFocus
              style={styles.editInput}
              placeholderTextColor={colors.muted}
              placeholder={editMode === 'tags' ? 'work, personal' : 'Title'}
            />
            <View style={styles.editActions}>
              <Pressable
                onPress={() => {
                  setEditMode(null);
                  setEditTarget(null);
                }}
                style={styles.editCancel}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void submitEdit()}
                style={styles.editSave}
              >
                <Text style={styles.editSaveText}>Save</Text>
              </Pressable>
            </View>
            {editMode === 'rename' ? (
              <View style={styles.editIconHint}>
                <PencilIcon size={14} color={colors.muted} />
              </View>
            ) : (
              <View style={styles.editIconHint}>
                <TagIcon size={14} color={colors.muted} />
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: '90%',
      ...(colors.shadowEnabled
        ? {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 8,
          }
        : {
            borderWidth: 1,
            borderColor: colors.border,
          }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    closeText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.muted,
      paddingHorizontal: 8,
      minHeight: 44,
      lineHeight: 44,
    },
    body: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12,
      backgroundColor: colors.surface,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      padding: 0,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    filterChip: {
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.surface,
    },
    filterChipActive: {
      backgroundColor: colors.primaryLight,
    },
    filterChipText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.muted,
    },
    filterChipTextActive: {
      color: colors.primary,
    },
    tagChip: {
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 5,
      backgroundColor: colors.surface,
    },
    tagChipActive: {
      backgroundColor: colors.primary,
    },
    tagChipText: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.muted,
    },
    tagChipTextActive: {
      color: '#fff',
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      borderWidth: 1,
      borderColor: `${colors.destructive}33`,
      backgroundColor: `${colors.destructive}1A`,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 16,
    },
    errorText: {
      flex: 1,
      color: colors.destructive,
      fontSize: 14,
      lineHeight: 20,
    },
    errorDismiss: {
      color: colors.destructive,
      fontSize: 14,
      fontWeight: '600',
    },
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    empty: {
      alignItems: 'center',
      paddingVertical: 24,
      paddingHorizontal: 24,
    },
    emptyIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    emptyDescription: {
      fontSize: 14,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 22,
      marginTop: 8,
      maxWidth: 288,
    },
    list: {
      maxHeight: 448,
    },
    listContent: {
      gap: 8,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 4,
    },
    item: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    itemPressed: {
      backgroundColor: colors.surface,
      borderColor: `${colors.primary}4D`,
    },
    itemSelected: {
      borderColor: `${colors.primary}66`,
      backgroundColor: colors.primaryLight,
    },
    itemDisabled: {
      opacity: 0.6,
    },
    itemIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    itemIconText: {
      backgroundColor: colors.primaryLight,
    },
    itemIconVoice: {
      backgroundColor: colors.shadowEnabled ? '#FAF5FF' : colors.primaryLight,
    },
    itemIconAgent: {
      backgroundColor: colors.shadowEnabled ? '#F0F9FF' : colors.primaryLight,
    },
    itemBody: {
      flex: 1,
      minWidth: 0,
    },
    itemTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    itemTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    itemPreview: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    itemMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
      marginTop: 2,
    },
    itemMeta: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    statusBadge: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 999,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    statusBadgeOk: {
      borderColor: '#A7F3D0',
      backgroundColor: '#ECFDF5',
    },
    statusBadgeBad: {
      borderColor: '#FECDD3',
      backgroundColor: '#FFF1F2',
    },
    statusBadgeWait: {
      borderColor: '#FDE68A',
      backgroundColor: '#FFFBEB',
    },
    statusBadgeActive: {
      borderColor: '#BAE6FD',
      backgroundColor: '#F0F9FF',
    },
    statusBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.text,
      textTransform: 'uppercase',
    },
    itemSpinner: {
      marginTop: 8,
    },
    moreButton: {
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    editBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    editCard: {
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    editTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    editHint: {
      fontSize: 13,
      color: colors.muted,
      marginTop: 6,
      marginBottom: 12,
    },
    editInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    editActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 16,
    },
    editCancel: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    editCancelText: {
      color: colors.muted,
      fontSize: 15,
      fontWeight: '500',
    },
    editSave: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    editSaveText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600',
    },
    editIconHint: {
      position: 'absolute',
      top: 20,
      right: 20,
      opacity: 0.5,
    },
  });
}
