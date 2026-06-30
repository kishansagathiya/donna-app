import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import {
  formatConversationDate,
  getConversation,
  listConversations,
  turnsToChatTurns,
  type ConversationSummary,
} from '../services/conversationsApi';
import type { ThemeColors } from '../theme/colors';
import type { ChatTurn } from './ChatMessages';
import { HistoryIcon, MessageSquareIcon, MicIcon } from './icons';

const VOICE_ICON_BG = '#FAF5FF';
const VOICE_ICON_COLOR = '#9333EA';

type Props = {
  visible: boolean;
  onClose: () => void;
  onResume: (sessionId: string | undefined, messages: ChatTurn[]) => void;
};

export function ChatHistorySheet({ visible, onClose, onResume }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [loading, setLoading] = useState(false);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setConversations(await listConversations());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      void load();
    }
  }, [visible, load]);

  async function handleSelect(conversation: ConversationSummary) {
    setResumingId(conversation.id);
    setError(null);
    try {
      const detail = await getConversation(conversation.id);
      const turns: ChatTurn[] = turnsToChatTurns(detail.turns).map(
        (turn, index) => ({
          id: `history-${conversation.id}-${index}`,
          user: turn.user,
          assistant: turn.assistant,
        }),
      );
      const sessionId =
        detail.channel === 'text' ? detail.client_session_id : undefined;
      onResume(sessionId, turns);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to open conversation',
      );
    } finally {
      setResumingId(null);
    }
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
            <Text style={styles.title}>Chat history</Text>
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
            ) : conversations.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIconWrap}>
                  <HistoryIcon size={24} color={colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>No conversations yet</Text>
                <Text style={styles.emptyDescription}>
                  Your past chats will appear here once you start talking with
                  Donna.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {conversations.map(conversation => {
                  const isVoice = conversation.channel === 'voice';
                  const busy = resumingId === conversation.id;

                  return (
                    <Pressable
                      key={conversation.id}
                      style={({ pressed }) => [
                        styles.item,
                        pressed && styles.itemPressed,
                        (busy || resumingId !== null) && styles.itemDisabled,
                      ]}
                      disabled={busy || resumingId !== null}
                      onPress={() => void handleSelect(conversation)}
                      accessibilityRole="button"
                    >
                      <View
                        style={[
                          styles.itemIcon,
                          isVoice ? styles.itemIconVoice : styles.itemIconText,
                        ]}
                      >
                        {isVoice ? (
                          <MicIcon size={16} color={VOICE_ICON_COLOR} />
                        ) : (
                          <MessageSquareIcon size={16} color={colors.primary} />
                        )}
                      </View>
                      <View style={styles.itemBody}>
                        <Text style={styles.itemTitle} numberOfLines={1}>
                          {conversation.title}
                        </Text>
                        {conversation.preview ? (
                          <Text style={styles.itemPreview} numberOfLines={1}>
                            {conversation.preview}
                          </Text>
                        ) : null}
                        <Text style={styles.itemMeta}>
                          {formatConversationDate(conversation.updated_at)}
                          {conversation.turn_count > 0
                            ? ` · ${conversation.turn_count} turn${conversation.turn_count === 1 ? '' : 's'}`
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
                  );
                })}
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Pressable>
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
      maxHeight: '85%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
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
    item: {
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
      backgroundColor: VOICE_ICON_BG,
    },
    itemBody: {
      flex: 1,
      minWidth: 0,
    },
    itemTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    itemPreview: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    itemMeta: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    itemSpinner: {
      marginTop: 8,
    },
  });
}
