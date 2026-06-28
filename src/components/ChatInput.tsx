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
import type { ThemeColors } from '../theme/colors';
import { ArrowUpIcon, DatabaseIcon } from './icons';

const INPUT_ACCESSORY_ID = 'chat-input-accessory';

type Props = {
  onSend?: (text: string) => void;
  onMemoryPress?: () => void;
  disabled?: boolean;
  placeholder?: string;
};

export function ChatInput({
  onSend,
  onMemoryPress,
  disabled,
  placeholder = 'Message Donna...',
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [text, setText] = useState('');

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
      <View style={styles.row}>
        <View style={styles.bar}>
          {onMemoryPress ? (
            <Pressable
              style={styles.memoryButton}
              onPress={onMemoryPress}
              accessibilityRole="button"
              accessibilityLabel="Open memory"
            >
              <DatabaseIcon size={20} color={colors.muted} />
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
        <Pressable
          style={[
            styles.sendButton,
            (!text.trim() || disabled) && styles.sendButtonDisabled,
          ]}
          onPress={submit}
          disabled={!text.trim() || disabled}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <ArrowUpIcon size={18} color={colors.white} />
        </Pressable>
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
    memoryButton: {
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
