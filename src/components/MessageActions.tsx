import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { ThemeColors } from '../theme/colors';
import type { ChatTurn } from './ChatMessages';
import {
  CheckIcon,
  CopyIcon,
  PencilIcon,
  RefreshIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from './icons';

type Props = {
  turn: ChatTurn;
  /** Which message's actions to render — keeps copy/edit under the user prompt. */
  target: 'user' | 'assistant';
  isLatest: boolean;
  busy: boolean;
  onCopy: (content: string) => void;
  onRegenerate?: () => void;
  onEdit?: (turnId: string, nextText: string) => void;
  onFeedback?: (turnId: string, rating: 'up' | 'down') => void;
  onRetry?: () => void;
};

export function MessageActions({
  turn,
  target,
  isLatest,
  busy,
  onCopy,
  onRegenerate,
  onEdit,
  onFeedback,
  onRetry,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(turn.user);

  if (target === 'user') {
    if (!turn.user) {
      return null;
    }

    if (editing) {
      return (
        <View style={styles.editBox}>
          <TextInput
            style={styles.editInput}
            value={draft}
            onChangeText={setDraft}
            multiline
            accessibilityLabel="Edit message"
          />
          <View style={styles.editActions}>
            <Pressable
              onPress={() => {
                setDraft(turn.user);
                setEditing(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Cancel edit"
            >
              <Text style={styles.editCancel}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={busy || !draft.trim()}
              onPress={() => {
                onEdit?.(turn.id, draft);
                setEditing(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Save and send"
            >
              <Text
                style={[
                  styles.editSave,
                  (busy || !draft.trim()) && styles.disabledText,
                ]}
              >
                Save & send
              </Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.row, styles.userRow]}>
        <Pressable
          style={styles.btn}
          accessibilityRole="button"
          accessibilityLabel={copied ? 'Copied' : 'Copy message'}
          onPress={() => {
            onCopy(turn.user);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? (
            <CheckIcon size={14} color={colors.muted} />
          ) : (
            <CopyIcon size={14} color={colors.muted} />
          )}
        </Pressable>
        {onEdit ? (
          <Pressable
            style={styles.btn}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Edit message"
            onPress={() => {
              setDraft(turn.user);
              setEditing(true);
            }}
          >
            <PencilIcon size={14} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (!turn.assistant) {
    return null;
  }

  return (
    <View style={[styles.row, styles.assistantRow]}>
      <Pressable
        style={styles.btn}
        accessibilityRole="button"
        accessibilityLabel={copied ? 'Copied' : 'Copy message'}
        onPress={() => {
          onCopy(turn.assistant ?? '');
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? (
          <CheckIcon size={14} color={colors.muted} />
        ) : (
          <CopyIcon size={14} color={colors.muted} />
        )}
      </Pressable>
      {isLatest && onRegenerate ? (
        <Pressable
          style={styles.btn}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Regenerate reply"
          onPress={onRegenerate}
        >
          <RefreshIcon size={14} color={colors.muted} />
        </Pressable>
      ) : null}
      {onFeedback ? (
        <>
          <Pressable
            style={styles.btn}
            accessibilityRole="button"
            accessibilityLabel="Thumbs up"
            accessibilityState={{ selected: turn.feedback === 'up' }}
            onPress={() => onFeedback(turn.id, 'up')}
          >
            <ThumbsUpIcon
              size={14}
              color={
                turn.feedback === 'up' ? colors.primary : colors.muted
              }
            />
          </Pressable>
          <Pressable
            style={styles.btn}
            accessibilityRole="button"
            accessibilityLabel="Thumbs down"
            accessibilityState={{ selected: turn.feedback === 'down' }}
            onPress={() => onFeedback(turn.id, 'down')}
          >
            <ThumbsDownIcon
              size={14}
              color={
                turn.feedback === 'down' ? colors.primary : colors.muted
              }
            />
          </Pressable>
        </>
      ) : null}
      {turn.error && isLatest && onRetry ? (
        <Pressable
          style={styles.retry}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          onPress={onRetry}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    userRow: {
      justifyContent: 'flex-end',
    },
    assistantRow: {
      justifyContent: 'flex-start',
    },
    btn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
    },
    retry: {
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    retryText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
      fontFamily: colors.fontFamily,
    },
    editBox: {
      gap: 8,
      marginTop: 4,
      alignSelf: 'stretch',
    },
    editInput: {
      minHeight: 72,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.background,
      fontFamily: colors.fontFamily,
    },
    editActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 16,
    },
    editCancel: {
      fontSize: 14,
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    editSave: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
      fontFamily: colors.fontFamily,
    },
    disabledText: {
      opacity: 0.4,
    },
  });
}
