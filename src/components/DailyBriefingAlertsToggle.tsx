import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Text } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import {
  disableDailyBriefingNotifications,
  enableDailyBriefingNotifications,
  getDailyBriefingNotificationsEnabled,
} from '../services/dailyBriefingNotifications';
import type { ThemeColors } from '../theme/colors';

type Props = {
  onEnabledChange?: (enabled: boolean) => void;
};

export function DailyBriefingAlertsToggle({ onEnabledChange }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getDailyBriefingNotificationsEnabled()
      .then(value => {
        setEnabled(value);
        onEnabledChange?.(value);
      })
      .finally(() => setLoading(false));
  }, [onEnabledChange]);

  async function handleToggle(next: boolean) {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      if (next) {
        const ok = await enableDailyBriefingNotifications();
        setEnabled(ok);
        onEnabledChange?.(ok);
        if (!ok) {
          Alert.alert(
            'Notifications disabled',
            'Allow notifications for Donna in Settings to get daily briefing alerts.',
          );
        }
      } else {
        await disableDailyBriefingNotifications();
        setEnabled(false);
        onEnabledChange?.(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Daily briefing alerts</Text>
      <Text style={styles.description}>
        Get a local notification with today's focus when you refresh the Today
        briefing.
      </Text>
      <View style={styles.row}>
        <Text style={styles.label}>
          {enabled ? 'Alerts on' : 'Alerts off'}
        </Text>
        {loading || saving ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Switch
            value={enabled}
            onValueChange={value => void handleToggle(value)}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={enabled ? colors.primary : colors.muted}
            accessibilityLabel="Daily briefing alerts"
          />
        )}
      </View>
    </View>
  );
}

/** Compact enable button for Today (matches web "Enable alerts"). */
export function EnableBriefingAlertsButton({
  onEnabled,
}: {
  onEnabled: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [busy, setBusy] = useState(false);

  async function handlePress() {
    setBusy(true);
    try {
      const ok = await enableDailyBriefingNotifications();
      if (ok) {
        onEnabled();
      } else {
        Alert.alert(
          'Notifications disabled',
          'Allow notifications for Donna in Settings to get daily briefing alerts.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.enableButton,
        pressed && styles.enableButtonPressed,
        busy && styles.enableButtonDisabled,
      ]}
      onPress={() => void handlePress()}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Enable briefing alerts"
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Text style={styles.enableButtonText}>Enable alerts</Text>
      )}
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: 24,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    description: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    label: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    enableButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.surface,
    },
    enableButtonPressed: {
      opacity: 0.85,
    },
    enableButtonDisabled: {
      opacity: 0.6,
    },
    enableButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
  });
}
