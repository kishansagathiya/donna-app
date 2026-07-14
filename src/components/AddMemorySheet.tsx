import React, { useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { ThemeColors } from '../theme/colors';

const INPUT_ACCESSORY_ID = 'add-memory-link-accessory';

type Props = {
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onAddLink: (url: string) => void;
  onPickDocument: () => void;
  onPickPhoto: () => void;
};

export function AddMemorySheet({
  visible,
  busy,
  onClose,
  onAddLink,
  onPickDocument,
  onPickPhoto,
}: Props) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const [url, setUrl] = useState('');

  const handleAddLink = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onAddLink(trimmed);
    setUrl('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.avoiding}
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
              <Text style={styles.title}>Add to memory</Text>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelHeaderText}>Cancel</Text>
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.subtitle}>
                Links, documents, and photos you add are sent to our servers and
                third-party AI services so Donna can recall them later.
              </Text>

              <Text style={styles.label}>Paste a link</Text>
              <TextInput
                style={styles.input}
                value={url}
                onChangeText={setUrl}
                placeholder="https://…"
                placeholderTextColor={styles.placeholder.color}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!busy}
                inputAccessoryViewID={
                  Platform.OS === 'ios' ? INPUT_ACCESSORY_ID : undefined
                }
              />
              <Pressable
                style={[styles.primaryButton, busy && styles.buttonDisabled]}
                onPress={handleAddLink}
                disabled={busy || !url.trim()}
              >
                <Text style={styles.primaryButtonText}>Save link</Text>
              </Pressable>

              <View style={styles.divider} />

              <Pressable
                style={[styles.secondaryButton, busy && styles.buttonDisabled]}
                onPress={() => {
                  onPickDocument();
                  onClose();
                }}
                disabled={busy}
              >
                <Text style={styles.secondaryButtonText}>Choose file</Text>
              </Pressable>

              <Pressable
                style={[styles.secondaryButton, busy && styles.buttonDisabled]}
                onPress={() => {
                  onPickPhoto();
                  onClose();
                }}
                disabled={busy}
              >
                <Text style={styles.secondaryButtonText}>Choose photo</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    avoiding: {
      flex: 1,
    },
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 20,
      maxHeight: '90%',
      ...(colors.shadowEnabled
        ? {}
        : {
            borderWidth: 1,
            borderColor: colors.border,
          }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    cancelHeaderText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      fontFamily: colors.fontFamily,
    },
    subtitle: {
      fontSize: 14,
      color: colors.muted,
      lineHeight: 20,
      marginBottom: 20,
      fontFamily: colors.fontFamily,
    },
    label: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.muted,
      marginBottom: 8,
      fontFamily: colors.fontFamily,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: colors.text,
      marginBottom: 12,
      fontFamily: colors.fontFamily,
      backgroundColor: colors.background,
    },
    placeholder: {
      color: colors.muted,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      marginBottom: 8,
    },
    primaryButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
      fontFamily: colors.fontFamily,
    },
    secondaryButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      marginBottom: 10,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '500',
      fontFamily: colors.fontFamily,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 16,
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
  });
}
