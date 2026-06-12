import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteAccount } from '../services/accountApi';
import { signOut } from '../services/auth';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function AccountScreen({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const busy = signingOut || deleting;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not sign out.';
      Alert.alert('Sign Out Failed', message);
    } finally {
      setSigningOut(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account, voice history, and saved memories. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => void handleDelete(),
        },
      ],
    );
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteAccount();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not delete account.';
      Alert.alert('Delete Failed', message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
          <Pressable
            onPress={onClose}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Close account settings"
            hitSlop={8}
          >
            <Text style={styles.closeText}>Done</Text>
          </Pressable>
        </View>

        <Text style={styles.description}>
          Manage your Donna account. Deleting your account permanently removes
          your conversations, memories, and sign-in from our servers.
        </Text>

        <Pressable
          style={[styles.button, styles.secondaryButton, busy && styles.buttonDisabled]}
          onPress={() => void handleSignOut()}
          disabled={busy}
          accessibilityRole="button"
        >
          {signingOut ? (
            <ActivityIndicator color="#1a1a1a" size="small" />
          ) : (
            <Text style={styles.secondaryButtonText}>Sign out</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.button, styles.destructiveButton, busy && styles.buttonDisabled]}
          onPress={confirmDelete}
          disabled={busy}
          accessibilityRole="button"
        >
          {deleting ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.destructiveButtonText}>Delete account</Text>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  closeText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#9A7B2F',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#555555',
    marginBottom: 28,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  secondaryButton: {
    backgroundColor: '#f2efe6',
    borderWidth: 1,
    borderColor: '#e0d8c4',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  destructiveButton: {
    backgroundColor: '#b42318',
  },
  destructiveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
