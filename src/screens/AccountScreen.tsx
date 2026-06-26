import { useEffect, useState } from 'react';
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
import {
  deleteAccount,
  downloadAccountExport,
  getAccountPreferences,
  updateLLMModel,
} from '../services/accountApi';
import { signOut } from '../services/auth';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function AccountScreen({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [exporting, setExporting] = useState(false);
  const busy = signingOut || deleting || savingModel || exporting;

  useEffect(() => {
    if (!visible) {
      return;
    }
    setLoadingModels(true);
    getAccountPreferences()
      .then(preferences => {
        setModels(preferences.available_models);
        setSelectedModel(preferences.llm_model);
      })
      .catch(error => {
        Alert.alert(
          'Could Not Load Models',
          error instanceof Error ? error.message : 'Please try again.',
        );
      })
      .finally(() => setLoadingModels(false));
  }, [visible]);

  async function handleModelChange(model: string) {
    if (model === selectedModel || savingModel) {
      return;
    }
    const previous = selectedModel;
    setSelectedModel(model);
    setSavingModel(true);
    try {
      await updateLLMModel(model);
    } catch (error) {
      setSelectedModel(previous);
      Alert.alert(
        'Could Not Save Model',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSavingModel(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await downloadAccountExport();
    } catch (error) {
      Alert.alert(
        'Download Failed',
        error instanceof Error ? error.message : 'Could not download your data.',
      );
    } finally {
      setExporting(false);
    }
  }

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

        <Text style={styles.sectionTitle}>AI model</Text>
        <Text style={styles.sectionDescription}>
          Choose the model Donna uses for your text and voice replies.
        </Text>
        {loadingModels ? (
          <ActivityIndicator color="#9A7B2F" style={styles.modelLoader} />
        ) : (
          <View style={styles.modelList}>
            {models.map(model => {
              const selected = model === selectedModel;
              return (
                <Pressable
                  key={model}
                  style={[styles.modelOption, selected && styles.modelOptionSelected]}
                  onPress={() => void handleModelChange(model)}
                  disabled={busy}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                >
                  <Text style={styles.modelName}>{model}</Text>
                  <Text style={styles.modelCheck}>{selected ? '✓' : ''}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={styles.sectionTitle}>Download my data</Text>
        <Text style={styles.sectionDescription}>
          Download a ZIP of your conversations, notes, and uploaded files.
        </Text>
        <Pressable
          style={[styles.button, styles.secondaryButton, busy && styles.buttonDisabled]}
          onPress={() => void handleExport()}
          disabled={busy}
          accessibilityRole="button"
        >
          {exporting ? (
            <ActivityIndicator color="#1a1a1a" size="small" />
          ) : (
            <Text style={styles.secondaryButtonText}>Download my data</Text>
          )}
        </Pressable>

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
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666666',
    marginBottom: 12,
  },
  modelLoader: {
    marginVertical: 16,
  },
  modelList: {
    marginBottom: 24,
  },
  modelOption: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#e0d8c4',
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },
  modelOptionSelected: {
    borderColor: '#9A7B2F',
    backgroundColor: '#f8f4e8',
  },
  modelName: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
  },
  modelCheck: {
    width: 20,
    marginLeft: 8,
    fontSize: 17,
    fontWeight: '700',
    color: '#9A7B2F',
    textAlign: 'right',
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
