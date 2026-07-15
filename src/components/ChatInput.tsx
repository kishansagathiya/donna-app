import React, { useState } from 'react';
import {
  Image,
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { PendingAttachment } from '../lib/chatAttachments';
import { isDonnaThinkingPhase } from '../lib/thinkingPhrases';
import type { ThemeColors } from '../theme/colors';
import { ArrowUpIcon, PaperclipIcon, StopIcon } from './icons';
import { MicButton, type MicState } from './MicButton';
import { ThinkingIndicator } from './ThinkingIndicator';

const INPUT_ACCESSORY_ID = 'chat-input-accessory';

export type QuickAction = {
  label: string;
  onPress: () => void;
};

type Props = {
  onSend?: (text: string, attachments: PendingAttachment[]) => void;
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
    onSend?.(trimmed, attachments);
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
      {quickActions && quickActions.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickActions}
          keyboardShouldPersistTaps="handled"
        >
          {quickActions.map(action => (
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
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {attachments.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.attachmentRow}
          keyboardShouldPersistTaps="handled"
        >
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
        </ScrollView>
      ) : null}
      <View style={styles.row}>
        <View style={styles.bar}>
          {onAttachPress ? (
            <Pressable
              style={styles.attachButton}
              onPress={onAttachPress}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel="Attach"
            >
              <PaperclipIcon size={20} color={colors.muted} />
            </Pressable>
          ) : null}
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
            <StopIcon size={16} color={colors.white} />
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
            <ArrowUpIcon size={18} color={colors.white} />
          </Pressable>
        )}
      </View>
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
    quickActions: {
      gap: 8,
      paddingBottom: 10,
      paddingRight: 8,
    },
    quickAction: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.surface,
    },
    quickActionPressed: {
      backgroundColor: colors.primaryLight,
    },
    quickActionDisabled: {
      opacity: 0.5,
    },
    quickActionLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    attachmentRow: {
      gap: 8,
      paddingBottom: 8,
    },
    attachmentChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: 180,
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
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    attachmentRemove: {
      fontSize: 12,
      color: colors.muted,
      paddingHorizontal: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
    },
    bar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 24,
      backgroundColor: colors.background,
      paddingLeft: 6,
      paddingRight: 12,
      paddingVertical: 6,
      minHeight: 48,
    },
    attachButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      maxHeight: 100,
      paddingVertical: 8,
      paddingHorizontal: 4,
      fontFamily: colors.fontFamily,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    sendButtonDisabled: {
      opacity: 0.4,
    },
  });
}
