import React, { useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { isDonnaThinkingPhase } from '../lib/thinkingPhrases';
import type { ThemeColors } from '../theme/colors';
import { ArrowUpIcon, PaperclipIcon } from './icons';
import { MicButton, type MicState } from './MicButton';
import { ThinkingIndicator } from './ThinkingIndicator';

const INPUT_ACCESSORY_ID = 'chat-input-accessory';

type Props = {
  onSend?: (text: string) => void;
  onAttachPress?: () => void;
  disabled?: boolean;
  placeholder?: string;
  showMic?: boolean;
  micState?: MicState;
  onMicPress?: () => void;
  micDisabled?: boolean;
  sessionLabel?: string | null;
};

export function ChatInput({
  onSend,
  onAttachPress,
  disabled,
  placeholder = 'Message Donna...',
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
  const showInlineMic = showMic && !hasText && onMicPress;

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) {
      return;
    }
    onSend?.(trimmed);
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
      <View style={styles.row}>
        <View style={styles.bar}>
          {onAttachPress ? (
            <Pressable
              style={styles.attachButton}
              onPress={onAttachPress}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel="Attach file or link"
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
        ) : (
          <Pressable
            style={[
              styles.sendButton,
              (!hasText || disabled) && styles.sendButtonDisabled,
            ]}
            onPress={submit}
            disabled={!hasText || disabled}
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
    },
    sessionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.muted,
      textAlign: 'center',
      marginBottom: 8,
      lineHeight: 18,
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
