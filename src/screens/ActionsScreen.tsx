import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../components/ThemedText';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useTheme } from '../hooks/useTheme';
import {
  cancelActionRun,
  confirmActionRun,
  dismissIntent,
  listIntents,
  type Intent,
} from '../services/intentsApi';
import type { ThemeColors } from '../theme/colors';

function kindLabel(kind: string) {
  return kind.replace(/_/g, ' ');
}

function riskMeta(risk?: string | null): { label: string; tone: 'internal' | 'external' | 'default' } | null {
  if (!risk) {
    return null;
  }
  if (risk === 'internal') {
    return { label: 'Internal', tone: 'internal' };
  }
  if (risk === 'external') {
    return { label: 'Needs confirm', tone: 'external' };
  }
  return { label: risk, tone: 'default' };
}

function IntentCard({
  intent,
  busy,
  onConfirm,
  onDismiss,
  onCancel,
  styles,
  colors,
}: {
  intent: Intent;
  busy: boolean;
  onConfirm: (runId: string) => void;
  onDismiss: (intentId: string) => void;
  onCancel: (runId: string) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  const risk = riskMeta(intent.run?.action_risk);
  const actionName =
    intent.run?.action_name ?? intent.run?.action_slug ?? 'Proposed action';

  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{kindLabel(intent.kind)}</Text>
        </View>
        {risk ? (
          <View
            style={[
              styles.badge,
              risk.tone === 'internal' && styles.badgeInternal,
              risk.tone === 'external' && styles.badgeExternal,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                risk.tone === 'internal' && { color: colors.primary },
                risk.tone === 'external' && { color: colors.destructive },
              ]}
            >
              {risk.label}
            </Text>
          </View>
        ) : null}
        <Text style={styles.sourceText}>
          from {intent.source_type === 'note' ? 'note' : 'chat'}
        </Text>
      </View>

      <Text style={styles.cardTitle}>{intent.summary}</Text>
      {intent.run ? (
        <Text style={styles.cardMeta}>
          {actionName}
          {intent.run.status !== 'proposed' ? ` · ${intent.run.status}` : ''}
        </Text>
      ) : (
        <Text style={styles.cardMeta}>No matching action yet</Text>
      )}

      <View style={styles.actionRow}>
        {intent.run && intent.run.status === 'proposed' ? (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                (busy || pressed) && styles.buttonPressed,
              ]}
              disabled={busy}
              onPress={() => onConfirm(intent.run!.id)}
            >
              <Text style={styles.primaryButtonText}>Confirm</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                (busy || pressed) && styles.buttonPressed,
              ]}
              disabled={busy}
              onPress={() => onCancel(intent.run!.id)}
            >
              <Text style={styles.secondaryButtonText}>Cancel run</Text>
            </Pressable>
          </>
        ) : null}
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            (busy || pressed) && styles.buttonPressed,
          ]}
          disabled={busy}
          onPress={() => onDismiss(intent.id)}
        >
          <Text style={styles.secondaryButtonText}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ActionsScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (isPull = false) => {
    if (isPull) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const rows = await listIntents('open');
      setIntents(rows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load intents');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  const handleConfirm = async (runId: string) => {
    setBusyId(runId);
    setError(null);
    try {
      await confirmActionRun(runId);
      await refresh(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Confirm failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleDismiss = async (intentId: string) => {
    setBusyId(intentId);
    setError(null);
    try {
      await dismissIntent(intentId);
      setIntents(prev => prev.filter(item => item.id !== intentId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Dismiss failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (runId: string) => {
    setBusyId(runId);
    setError(null);
    try {
      await cancelActionRun(runId);
      await refresh(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Actions</Text>
          <Text style={styles.subtitle}>
            Intents Donna extracted from your notes and chats
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => void refresh(true)}
          disabled={loading || refreshing}
        >
          {loading || refreshing ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.refreshButtonText}>Refresh</Text>
          )}
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && intents.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={intents}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.listContent,
            intents.length === 0 && styles.listEmptyContent,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh(true)}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Inbox clear</Text>
              <Text style={styles.emptyBody}>
                When you write an actionable note or chat, proposals show up
                here to confirm or dismiss.
              </Text>
            </View>
          }
          ListHeaderComponent={
            intents.length > 0 ? (
              <Text style={styles.sectionLabel}>Open ({intents.length})</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <IntentCard
              intent={item}
              busy={busyId !== null}
              onConfirm={id => void handleConfirm(id)}
              onDismiss={id => void handleDismiss(id)}
              onCancel={id => void handleCancel(id)}
              styles={styles}
              colors={colors}
            />
          )}
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerText: {
      flex: 1,
      gap: 4,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    subtitle: {
      fontSize: 14,
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    refreshButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minWidth: 84,
      alignItems: 'center',
      justifyContent: 'center',
    },
    refreshButtonText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '600',
      fontFamily: colors.fontFamily,
    },
    errorBanner: {
      marginHorizontal: 20,
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.destructive,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 14,
      fontFamily: colors.fontFamily,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 12,
    },
    listEmptyContent: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.muted,
      marginBottom: 4,
      fontFamily: colors.fontFamily,
    },
    emptyState: {
      alignItems: 'center',
      paddingHorizontal: 24,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    emptyBody: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.background,
      padding: 14,
      gap: 10,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    badge: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    badgeInternal: {
      borderColor: colors.primaryLight,
      backgroundColor: colors.primaryLight,
    },
    badgeExternal: {
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    sourceText: {
      fontSize: 12,
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    cardMeta: {
      fontSize: 14,
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 2,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    primaryButtonText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '600',
      fontFamily: colors.fontFamily,
    },
    secondaryButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      fontFamily: colors.fontFamily,
    },
    buttonPressed: {
      opacity: 0.7,
    },
  });
}
