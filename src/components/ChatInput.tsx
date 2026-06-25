import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../theme/colors';

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
      <View style={styles.bar}>
        {onMemoryPress ? (
          <Pressable
            style={styles.memoryButton}
            onPress={onMemoryPress}
            accessibilityRole="button"
            accessibilityLabel="Open memory"
          >
            <Text style={styles.memoryIcon}>🗃</Text>
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
        />
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
          <Text style={styles.sendIcon}>↑</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: colors.background,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.background,
    paddingLeft: 4,
    paddingRight: 4,
    paddingVertical: 4,
    minHeight: 48,
  },
  memoryButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  memoryIcon: {
    fontSize: 18,
    opacity: 0.7,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendIcon: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
});
