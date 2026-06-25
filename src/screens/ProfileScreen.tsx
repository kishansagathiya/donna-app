import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import {
  deleteAccount,
  getAccountPreferences,
  updateLLMModel,
} from '../services/accountApi';
import { signOut } from '../services/auth';
import { colors } from '../theme/colors';

export function ProfileScreen() {
  const { session } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(true);
  const [savingModel, setSavingModel] = useState(false);
  const busy = signingOut || deleting || savingModel;

  const email = session?.user.email ?? '';
  const name =
    (session?.user.user_metadata?.full_name as string | undefined) ?? email;
  const initial = (name || 'U').charAt(0).toUpperCase();

  useEffect(() => {
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
  }, []);

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

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      Alert.alert(
        'Sign Out Failed',
        error instanceof Error ? error.message : 'Could not sign out.',
      );
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
    } catch (error) {
      Alert.alert(
        'Delete Failed',
        error instanceof Error ? error.message : 'Could not delete account.',
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.pageTitle}>Profile</Text>

      <View style={styles.profileRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View>
          <Text style={styles.name}>{name}</Text>
          {email ? <Text style={styles.email}>{email}</Text> : null}
        </View>
      </View>

      <Text style={styles.sectionTitle}>AI model</Text>
      <Text style={styles.sectionDescription}>
        Choose the model Donna uses for your text and voice replies.
      </Text>
      {loadingModels ? (
        <ActivityIndicator color={colors.primary} style={styles.modelLoader} />
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

      <Pressable
        style={[styles.button, styles.secondaryButton, busy && styles.buttonDisabled]}
        onPress={() => void handleSignOut()}
        disabled={busy}
        accessibilityRole="button"
      >
        {signingOut ? (
          <ActivityIndicator color={colors.text} size="small" />
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
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text style={styles.destructiveButtonText}>Delete account</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 28,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.primary,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  email: {
    marginTop: 2,
    fontSize: 14,
    color: colors.muted,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
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
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
  },
  modelOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  modelName: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  modelCheck: {
    width: 20,
    marginLeft: 8,
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  destructiveButton: {
    backgroundColor: colors.destructive,
  },
  destructiveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
});
