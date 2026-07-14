import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '../components/ThemedText';
import { ThemeToggle } from '../components/ThemeToggle';
import { DailyBriefingAlertsToggle } from '../components/DailyBriefingAlertsToggle';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useAuth } from '../hooks/useAuth';
import type { DeviceSyncStatus } from '../hooks/useDeviceSync';
import {
  deleteAccount,
  downloadAccountExport,
  getAccountPreferences,
  updateLLMModel,
  updatePersona,
} from '../services/accountApi';
import { signOut } from '../services/auth';
import type { ThemeColors } from '../theme/colors';

const DEFAULT_PERSONAS = ['companion', 'boss', 'coach', 'therapist', 'custom'];

function shortenId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

type ProfileScreenProps = {
  deviceSync: DeviceSyncStatus & { forgetDevice: () => Promise<void> };
  onPairDevicePress: () => void;
  onOpenPrivacy?: () => void;
  onOpenSupport?: () => void;
};

export function ProfileScreen({
  deviceSync,
  onPairDevicePress,
  onOpenPrivacy,
  onOpenSupport,
}: ProfileScreenProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { session } = useAuth();
  const [forgetting, setForgetting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(true);
  const [savingModel, setSavingModel] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [personas, setPersonas] = useState<string[]>([]);
  const [persona, setPersona] = useState('companion');
  const [personaCustom, setPersonaCustom] = useState('');
  const [savingPersona, setSavingPersona] = useState(false);
  const busy =
    signingOut || deleting || savingModel || savingPersona || exporting;

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
        setPersonas(preferences.available_personas ?? []);
        setPersona(preferences.persona ?? 'companion');
        setPersonaCustom(preferences.persona_custom ?? '');
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

  async function handlePersonaChange(next: string) {
    if (next === persona || savingPersona) {
      return;
    }
    const previous = persona;
    setPersona(next);
    setSavingPersona(true);
    try {
      await updatePersona(next, next === 'custom' ? personaCustom : '');
    } catch (error) {
      setPersona(previous);
      Alert.alert(
        'Could Not Save Persona',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSavingPersona(false);
    }
  }

  async function handlePersonaCustomSave() {
    if (savingPersona) {
      return;
    }
    setSavingPersona(true);
    try {
      await updatePersona('custom', personaCustom);
    } catch (error) {
      Alert.alert(
        'Could Not Save Persona',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSavingPersona(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await downloadAccountExport();
    } catch (error) {
      Alert.alert(
        'Download Failed',
        error instanceof Error
          ? error.message
          : 'Could not download your data.',
      );
    } finally {
      setExporting(false);
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
                style={[
                  styles.modelOption,
                  selected && styles.modelOptionSelected,
                ]}
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

      <Text style={styles.sectionTitle}>Persona</Text>
      <Text style={styles.sectionDescription}>
        How Donna talks to you in chat and voice.
      </Text>
      <View style={styles.modelList}>
        {(personas.length > 0 ? personas : DEFAULT_PERSONAS).map(p => {
          const selected = p === persona;
          return (
            <Pressable
              key={p}
              style={[
                styles.modelOption,
                selected && styles.modelOptionSelected,
              ]}
              onPress={() => void handlePersonaChange(p)}
              disabled={busy}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
            >
              <Text style={styles.modelName}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
              <Text style={styles.modelCheck}>{selected ? '✓' : ''}</Text>
            </Pressable>
          );
        })}
      </View>
      {persona === 'custom' ? (
        <View style={styles.personaCustomWrap}>
          <Text style={styles.fieldLabel}>Custom persona instructions</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={personaCustom}
            onChangeText={setPersonaCustom}
            placeholder={
              'e.g. You are Donna, a witty senior engineer who pairs with me…'
            }
            placeholderTextColor={colors.muted}
            multiline
            maxLength={4000}
            editable={!busy}
          />
          <Pressable
            style={[styles.primaryButton, busy && styles.buttonDisabled]}
            onPress={() => void handlePersonaCustomSave()}
            disabled={busy || savingPersona}
            accessibilityRole="button"
          >
            {savingPersona ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Save persona</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      <ThemeToggle />

      <DailyBriefingAlertsToggle />

      <Text style={styles.sectionTitle}>Help & legal</Text>
      <Pressable
        style={[styles.button, styles.secondaryButton]}
        onPress={onOpenPrivacy}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryButtonText}>Privacy Policy</Text>
      </Pressable>
      <Pressable
        style={[styles.button, styles.secondaryButton]}
        onPress={onOpenSupport}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryButtonText}>Support</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Donna device</Text>
      <Text style={styles.sectionDescription}>
        Pair your Donna hardware capture device once. Press REC to record —
        notes sync automatically over Bluetooth when your phone is nearby,
        including reconnects and batches of pending notes.
      </Text>
      <View style={styles.deviceCard}>
        <Text style={styles.deviceHeading}>
          {deviceSync.pairedDeviceId ? 'Paired device' : 'No device paired'}
        </Text>
        <Text style={styles.deviceRow}>
          State: {deviceSync.connectionState}
          {deviceSync.pairedDeviceId
            ? ` · ${shortenId(deviceSync.pairedDeviceId)}`
            : ''}
        </Text>
        <Text style={styles.deviceRow}>
          Pending captures: {deviceSync.pendingCount}
        </Text>
        {deviceSync.syncProgress ? (
          <Text style={styles.deviceRow}>
            Syncing {deviceSync.syncProgress.synced}/
            {deviceSync.syncProgress.total} from Donna
            {deviceSync.syncPath !== 'idle' ? ` (${deviceSync.syncPath})` : ''}
          </Text>
        ) : null}
        {deviceSync.lastMessage ? (
          <Text style={styles.deviceRow}>
            {truncate(deviceSync.lastMessage, 80)}
          </Text>
        ) : null}
        {deviceSync.uploadState === 'failed' && !deviceSync.syncProgress ? (
          <Text style={[styles.deviceRow, { color: colors.destructive }]}>
            Sync issue — will retry automatically
          </Text>
        ) : null}
        <View style={styles.deviceButtonRow}>
          <Pressable
            style={[
              styles.button,
              styles.secondaryButton,
              forgetting && styles.buttonDisabled,
            ]}
            onPress={onPairDevicePress}
            disabled={forgetting}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>
              {deviceSync.pairedDeviceId
                ? 'Pair different device'
                : 'Pair device'}
            </Text>
          </Pressable>
          {deviceSync.pairedDeviceId ? (
            <>
              <Pressable
                style={[
                  styles.button,
                  styles.destructiveButton,
                  forgetting && styles.buttonDisabled,
                ]}
                onPress={async () => {
                  Alert.alert(
                    'Forget this device?',
                    'The device will be unpaired. You can pair it again later.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Forget',
                        style: 'destructive',
                        onPress: async () => {
                          setForgetting(true);
                          try {
                            await deviceSync.forgetDevice();
                          } catch (err) {
                            Alert.alert(
                              'Could not forget',
                              err instanceof Error
                                ? err.message
                                : 'Please try again.',
                            );
                          } finally {
                            setForgetting(false);
                          }
                        },
                      },
                    ],
                  );
                }}
                disabled={forgetting}
                accessibilityRole="button"
              >
                {forgetting ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.destructiveButtonText}>Forget</Text>
                )}
              </Pressable>
            </>
          ) : null}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Download my data</Text>
      <Text style={styles.sectionDescription}>
        Download a ZIP of your conversations, notes, and uploaded files.
      </Text>
      <Pressable
        style={[
          styles.button,
          styles.secondaryButton,
          busy && styles.buttonDisabled,
        ]}
        onPress={() => void handleExport()}
        disabled={busy}
        accessibilityRole="button"
      >
        {exporting ? (
          <ActivityIndicator color={colors.text} size="small" />
        ) : (
          <Text style={styles.secondaryButtonText}>Download my data</Text>
        )}
      </Pressable>

      <Pressable
        style={[
          styles.button,
          styles.secondaryButton,
          busy && styles.buttonDisabled,
        ]}
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
        style={[
          styles.button,
          styles.destructiveButton,
          busy && styles.buttonDisabled,
        ]}
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
    personaCustomWrap: {
      marginBottom: 16,
    },
    fieldLabel: {
      marginTop: 4,
      marginBottom: 8,
      fontSize: 13,
      color: colors.muted,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    textArea: {
      minHeight: 96,
      textAlignVertical: 'top',
    },
    primaryButton: {
      marginTop: 12,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: colors.white,
      fontWeight: '600',
      fontSize: 15,
    },
    deviceCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      backgroundColor: colors.surface,
    },
    deviceHeading: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    deviceRow: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 18,
      marginBottom: 2,
    },
    deviceButtonRow: {
      flexDirection: 'row',
      marginTop: 10,
      gap: 8,
    },
  });
}
