import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Text } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { GranolaOAuthResult } from '../hooks/useGranolaOAuthReturn';
import {
  authorizeGranola,
  deleteGranolaImports,
  disconnectGranola,
  listIntegrations,
  patchGranola,
  syncGranola,
  type IntegrationStatus,
} from '../services/integrationsApi';
import type { ThemeColors } from '../theme/colors';

type Props = {
  refreshToken?: number;
  oauthResult?: GranolaOAuthResult | null;
  onOauthResultConsumed?: () => void;
};

function formatSyncTime(iso?: string): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function statusLabel(status: string): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting…';
    case 'syncing':
      return 'Syncing…';
    case 'reauth_required':
      return 'Reconnect required';
    case 'partial':
      return 'Partially synced';
    case 'error':
      return 'Error';
    case 'disconnected':
    default:
      return 'Not connected';
  }
}

function initialSyncLabel(status: string): string | null {
  switch (status) {
    case 'pending':
      return 'Initial import pending';
    case 'running':
      return 'Importing meetings…';
    case 'completed':
      return 'Initial import complete';
    case 'partial':
      return 'Initial import partially complete';
    case 'failed':
      return 'Initial import failed';
    default:
      return null;
  }
}

function isActiveConnection(status: string): boolean {
  return (
    status === 'connected' ||
    status === 'syncing' ||
    status === 'partial' ||
    status === 'error'
  );
}

function shouldPoll(granola: IntegrationStatus | null): boolean {
  if (!granola) {
    return false;
  }
  return (
    granola.status === 'connecting' ||
    granola.status === 'syncing' ||
    granola.initial_sync_status === 'pending' ||
    granola.initial_sync_status === 'running'
  );
}

export function IntegrationsSection({
  refreshToken = 0,
  oauthResult = null,
  onOauthResultConsumed,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [granola, setGranola] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const integrations = await listIntegrations();
    const next =
      integrations.find(item => item.provider === 'granola') ?? null;
    setGranola(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void refresh()
      .catch(error => {
        if (!cancelled) {
          Alert.alert(
            'Could Not Load Integrations',
            error instanceof Error ? error.message : 'Please try again.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, refreshToken]);

  useEffect(() => {
    if (!oauthResult) {
      return;
    }
    if (oauthResult.ok) {
      setOauthNotice('Connected to Granola. Importing meetings…');
    } else {
      setOauthNotice(
        oauthResult.error
          ? `Granola connection failed: ${oauthResult.error}`
          : 'Granola connection failed.',
      );
    }
    void refresh().catch(error => {
      Alert.alert(
        'Could Not Refresh Integrations',
        error instanceof Error ? error.message : 'Please try again.',
      );
    });
    onOauthResultConsumed?.();
  }, [oauthResult, onOauthResultConsumed, refresh]);

  useEffect(() => {
    if (!shouldPoll(granola)) {
      return;
    }
    const id = setInterval(() => {
      void refresh().catch(() => {
        // Keep polling quietly; surface errors on user actions.
      });
    }, 4000);
    return () => clearInterval(id);
  }, [granola, refresh]);

  if (loading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Integrations</Text>
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </View>
    );
  }

  if (!granola || !granola.enabled) {
    return null;
  }

  const connected = isActiveConnection(granola.status);
  const needsReconnect = granola.status === 'reauth_required';
  const connecting = granola.status === 'connecting';
  const syncing =
    granola.status === 'syncing' || granola.initial_sync_status === 'running';
  const lastSync = formatSyncTime(granola.last_sync_at);
  const syncProgress = initialSyncLabel(granola.initial_sync_status);
  const caps = granola.capabilities;
  const hasTranscripts = caps.transcripts || caps.live_get_transcript;
  const historyDays = caps.history_days;
  const planHint = caps.plan_hint;
  const showDeleteImports =
    connected ||
    granola.imported_meeting_count > 0 ||
    granola.status === 'disconnected';

  async function handleConnect() {
    setBusy(true);
    setOauthNotice(null);
    try {
      const { authorization_url } = await authorizeGranola('mobile');
      await Linking.openURL(authorization_url);
    } catch (error) {
      Alert.alert(
        'Could Not Connect',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncNow() {
    setBusy(true);
    try {
      await syncGranola();
      await refresh();
    } catch (error) {
      Alert.alert(
        'Sync Failed',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleSync(next: boolean) {
    setBusy(true);
    try {
      const updated = await patchGranola(next);
      setGranola(updated);
    } catch (error) {
      Alert.alert(
        'Could Not Update Sync',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  function confirmDisconnect() {
    Alert.alert(
      'Disconnect Granola?',
      'Imported meeting snapshots remain in Donna until you explicitly delete them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => void handleDisconnect(),
        },
      ],
    );
  }

  async function handleDisconnect() {
    setBusy(true);
    try {
      const updated = await disconnectGranola();
      setGranola(updated);
    } catch (error) {
      Alert.alert(
        'Disconnect Failed',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  function confirmDeleteImports() {
    Alert.alert(
      'Delete imports?',
      'Permanently delete all imported Granola meeting snapshots and transcripts from Donna? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete imports',
          style: 'destructive',
          onPress: () => void handleDeleteImports(),
        },
      ],
    );
  }

  async function handleDeleteImports() {
    setBusy(true);
    try {
      await deleteGranolaImports();
      await refresh();
    } catch (error) {
      Alert.alert(
        'Delete Failed',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Integrations</Text>
      <Text style={styles.sectionDescription}>
        Connect meeting tools so Donna can recall notes and transcripts in chat.
      </Text>

      {oauthNotice ? (
        <Text style={styles.noticeText}>{oauthNotice}</Text>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardHeading}>Granola</Text>
        <Text style={styles.cardRow}>
          {statusLabel(granola.status)}
          {granola.account_label ? ` · ${granola.account_label}` : ''}
          {granola.workspace_label ? ` · ${granola.workspace_label}` : ''}
        </Text>

        {connected || needsReconnect || connecting ? (
          <View style={styles.detailBlock}>
            {connecting ? (
              <Text style={styles.cardRow}>Finishing OAuth connection…</Text>
            ) : null}
            {syncProgress ? (
              <Text style={styles.cardRow}>{syncProgress}</Text>
            ) : null}
            {granola.imported_meeting_count > 0 ||
            granola.imported_transcript_count > 0 ||
            syncing ? (
              <Text style={styles.cardRow}>
                Imported {granola.imported_meeting_count} meeting
                {granola.imported_meeting_count === 1 ? '' : 's'}
                {hasTranscripts
                  ? ` · ${granola.imported_transcript_count} transcript${
                      granola.imported_transcript_count === 1 ? '' : 's'
                    }`
                  : ''}
              </Text>
            ) : null}
            {hasTranscripts ? (
              <Text style={styles.cardRow}>
                Transcripts available for this Granola plan.
              </Text>
            ) : (
              <Text style={styles.cardRow}>
                {planHint === 'basic' || historyDays
                  ? `Basic plan: last ${historyDays ?? 30} days of meetings · no transcripts.`
                  : 'No transcript access on this Granola plan.'}
              </Text>
            )}
            {lastSync ? (
              <Text style={styles.cardRow}>Last sync: {lastSync}</Text>
            ) : null}
            {granola.status === 'partial' ||
            granola.initial_sync_status === 'partial' ? (
              <Text style={styles.cardRow}>
                Some meetings could not be imported.
              </Text>
            ) : null}
            {granola.last_error ? (
              <Text style={[styles.cardRow, { color: colors.destructive }]}>
                {granola.last_error}
              </Text>
            ) : null}
            {granola.retains_imports_on_disconnect ? (
              <Text style={styles.cardRow}>
                Imported meeting snapshots remain in Donna after disconnect until
                you delete them below.
              </Text>
            ) : null}
          </View>
        ) : null}

        {!connected && !needsReconnect && !connecting ? (
          <Pressable
            style={[
              styles.button,
              styles.secondaryButton,
              busy && styles.buttonDisabled,
            ]}
            onPress={() => void handleConnect()}
            disabled={busy}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Text style={styles.secondaryButtonText}>Connect Granola</Text>
            )}
          </Pressable>
        ) : null}

        {needsReconnect ? (
          <Pressable
            style={[
              styles.button,
              styles.secondaryButton,
              busy && styles.buttonDisabled,
            ]}
            onPress={() => void handleConnect()}
            disabled={busy}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Text style={styles.secondaryButtonText}>Reconnect</Text>
            )}
          </Pressable>
        ) : null}

        {connected ? (
          <>
            <Pressable
              style={[
                styles.button,
                styles.secondaryButton,
                (busy || syncing) && styles.buttonDisabled,
              ]}
              onPress={() => void handleSyncNow()}
              disabled={busy || syncing}
              accessibilityRole="button"
            >
              {busy || syncing ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <Text style={styles.secondaryButtonText}>Sync now</Text>
              )}
            </Pressable>

            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>Hourly sync</Text>
                <Text style={styles.toggleDescription}>
                  Automatically import new Granola meetings each hour.
                </Text>
              </View>
              {busy ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Switch
                  value={granola.sync_enabled}
                  onValueChange={value => void handleToggleSync(value)}
                  trackColor={{
                    false: colors.border,
                    true: colors.primaryLight,
                  }}
                  thumbColor={
                    granola.sync_enabled ? colors.primary : colors.muted
                  }
                  accessibilityLabel="Hourly sync"
                />
              )}
            </View>

            <Pressable
              style={[
                styles.button,
                styles.secondaryButton,
                busy && styles.buttonDisabled,
              ]}
              onPress={confirmDisconnect}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryButtonText}>Disconnect</Text>
            </Pressable>
          </>
        ) : null}

        {showDeleteImports ? (
          <View style={styles.deleteBlock}>
            <Text style={styles.deleteHint}>
              Delete imports removes meeting snapshots from Donna. This is
              separate from disconnecting.
            </Text>
            <Pressable
              style={[
                styles.button,
                styles.destructiveButton,
                (busy || granola.imported_meeting_count === 0) &&
                  styles.buttonDisabled,
              ]}
              onPress={confirmDeleteImports}
              disabled={busy || granola.imported_meeting_count === 0}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.destructiveButtonText}>Delete imports</Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: {
      marginBottom: 8,
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
    loader: {
      marginVertical: 16,
    },
    noticeText: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.text,
      marginBottom: 10,
    },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      backgroundColor: colors.surface,
    },
    cardHeading: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    cardRow: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 18,
      marginBottom: 2,
    },
    detailBlock: {
      marginTop: 8,
      marginBottom: 10,
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
      backgroundColor: colors.background,
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
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 12,
    },
    toggleCopy: {
      flex: 1,
    },
    toggleTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    toggleDescription: {
      marginTop: 2,
      fontSize: 12,
      lineHeight: 17,
      color: colors.muted,
    },
    deleteBlock: {
      marginTop: 4,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    deleteHint: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.muted,
      marginBottom: 10,
    },
  });
}
