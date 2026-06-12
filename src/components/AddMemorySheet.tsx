import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Add to memory</Text>
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
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!busy}
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

          <Pressable style={styles.cancelButton} onPress={onClose} disabled={busy}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#444',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#9A7B2F',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  secondaryButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '500',
  },
  cancelButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 16,
  },
});
