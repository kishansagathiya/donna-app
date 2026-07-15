import React, { useState } from 'react';
import {
  Image,
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { PendingAttachment } from '../lib/chatAttachments';
import { isDonnaThinkingPhase } from '../lib/thinkingPhrases';
import type { ThemeColors } from '../theme/colors';
import {
  ArrowUpIcon,
  BookOpenIcon,
  BrainIcon,
  GlobeIcon,
  HistoryIcon,
  PaperclipIcon,
  StopIcon,
} from './icons';
import { MicButton, type MicState } from './MicButton';
import { ThinkingIndicator } from './ThinkingIndicator';

const INPUT_ACCESSORY_ID = 'chat-input-accessory';

export type QuickAction = {
  label: string;
  onPress: () => void;
};

type Props = {
  onSend?: (
    text: string,
    attachments: PendingAttachment[],
    options?: { webSearch?: boolean },
  ) => void;
  onStop?: () => void;
  onAttachPress?: () => void;
  attachments?: PendingAttachment[];
  onRemoveAttachment?: (id: string) => void;
  disabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  quickActions?: QuickAction[];
  showMic?: boolean;
  micState?: MicState;
  onMicPress?: () => void;
  micDisabled?: boolean;
  sessionLabel?: string | null;
};

const quickActionIcons: Record<
  string,
  typeof BrainIcon | typeof BookOpenIcon | typeof HistoryIcon
> = {
  'What do you remember?': BrainIcon,
  'Catch me up': BookOpenIcon,
  'Continue last chat': HistoryIcon,
};

export function ChatInput({
  onSend,
  onStop,
  onAttachPress,
  attachments = [],
  onRemoveAttachment,
  disabled,
  busy = false,
  placeholder = 'Message Donna...',
  quickActions,
  showMic = false,
  micState = 'idle',
  onMicPress,
  micDisabled,
  sessionLabel,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [text, setText] = useState('');
  const [webSearch, setWebSearch] = useState(false);
  const hasText = text.trim().length > 0;
  const hasAttachments = attachments.length > 0;
  const canSend = hasText || hasAttachments;
  const showStop = busy && Boolean(onStop);
  const showInlineMic =
    showMic && !hasText && !hasAttachments && onMicPress && !showStop;

  function submit() {
    if ((!hasText && !hasAttachments) || disabled) {
      return;
    }
    const trimmed = text.trim();
    onSend?.(trimmed, attachments, { webSearch });
    setText('');
  }

  return (
    <View style={styles.container}>
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={INPUT_ACCESSORY_ID}>
          <View style={styles.accessory}>
            <Pressable
              onPress={Keyboard.dismiss}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Dismiss keyboard"
            >
              <Text style={styles.accessoryDone}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
      {isDonnaThinkingPhase(sessionLabel) ? (
        <ThinkingIndicator style={styles.sessionLabel} />
      ) : sessionLabel ? (
        <Text style={styles.sessionLabel} accessibilityRole="text">
          {sessionLabel}
        </Text>
      ) : null}

      <View style={styles.card}>
        {attachments.length > 0 ? (
          <View style={styles.attachmentRow}>
            {attachments.map(att => (
              <View key={att.id} style={styles.attachmentChip}>
                {att.previewUri ? (
                  <Image source={{ uri: att.previewUri }} style={styles.thumb} />
                ) : null}
                <Text style={styles.attachmentName} numberOfLines={1}>
                  {att.filename}
                </Text>
                <Pressable
                  onPress={() => onRemoveAttachment?.(att.id)}
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

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={colors.muted}
            editable={!disabled}
            returnKeyType="send"
            onSubmitEditing={submit}
            multiline
            maxLength={2000}
            accessibilityLabel={placeholder}
            inputAccessoryViewID={
              Platform.OS === 'ios' ? INPUT_ACCESSORY_ID : undefined
            }
          />
        </View>

        <View style={styles.toolbar}>
          <Pressable
            style={[
              styles.toolButton,
              webSearch && styles.toolButtonActive,
              disabled && styles.toolButtonDisabled,
            ]}
            onPress={() => setWebSearch(v => !v)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: webSearch }}
            accessibilityLabel={
              webSearch ? 'Web search on' : 'Web search off'
            }
          >
            <GlobeIcon
              size={20}
              color={webSearch ? colors.primary : colors.muted}
            />
          </Pressable>

          {onAttachPress ? (
            <Pressable
              style={[styles.toolButton, disabled && styles.toolButtonDisabled]}
              onPress={onAttachPress}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel="Attach to message"
            >
              <PaperclipIcon size={20} color={colors.muted} />
            </Pressable>
          ) : null}

          <View style={styles.toolbarSpacer} />

          {showInlineMic ? (
            <MicButton
              variant="inline"
              state={micState}
              onPress={onMicPress}
              disabled={micDisabled}
            />
          ) : showStop ? (
            <Pressable
              style={styles.sendButton}
              onPress={onStop}
              accessibilityRole="button"
              accessibilityLabel="Stop generating"
            >
              <StopIcon size={14} color={colors.white} />
            </Pressable>
          ) : (
            <Pressable
              style={[
                styles.sendButton,
                (!canSend || disabled) && styles.sendButtonDisabled,
              ]}
              onPress={submit}
              disabled={!canSend || disabled}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              <ArrowUpIcon size={16} color={colors.white} />
            </Pressable>
          )}
        </View>
      </View>

      {quickActions && quickActions.length > 0 ? (
        <View style={styles.quickActions}>
          {quickActions.map(action => {
            const Icon = quickActionIcons[action.label] ?? BookOpenIcon;
            return (
              <Pressable
                key={action.label}
                style={({ pressed }) => [
                  styles.quickAction,
                  pressed && styles.quickActionPressed,
                  disabled && styles.quickActionDisabled,
                ]}
                onPress={action.onPress}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <Icon size={14} color={colors.muted} />
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 8,
      backgroundColor: colors.background,
    },
    accessory: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    accessoryDone: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      fontFamily: colors.fontFamily,
    },
    sessionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.muted,
      textAlign: 'center',
      marginBottom: 8,
      lineHeight: 18,
      fontFamily: colors.fontFamily,
    },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 8,
    },
    attachmentRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 8,
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
      fontFamily: colors.fontFamily,
    },
    attachmentRemove: {
      fontSize: 12,
      color: colors.muted,
      paddingHorizontal: 2,
    },
    inputRow: {
      minHeight: 40,
    },
    input: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
      maxHeight: 128,
      paddingVertical: 8,
      paddingHorizontal: 4,
      fontFamily: colors.fontFamily,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    toolButton: {
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toolButtonActive: {
      backgroundColor: colors.primaryLight,
    },
    toolButtonDisabled: {
      opacity: 0.5,
    },
    toolbarSpacer: {
      flex: 1,
    },
    sendButton: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.4,
    },
    quickActions: {
      marginTop: 12,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 8,
    },
    quickAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.surface,
    },
    quickActionPressed: {
      borderColor: colors.primaryRing,
      backgroundColor: colors.primaryLight,
    },
    quickActionDisabled: {
      opacity: 0.5,
    },
    quickActionLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
  });
}
