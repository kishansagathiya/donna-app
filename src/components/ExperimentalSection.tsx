import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Text } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import {
  getExperimentalUiEnabled,
  setExperimentalUiEnabled,
} from '../services/experimentalSettings';
import type { ThemeColors } from '../theme/colors';

/** Features shown only while Experimental is on. Empty until something ships. */
const FEATURES: {
  key: string;
  title: string;
  description: string;
}[] = [];

export function ExperimentalSection() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [uiEnabled, setUiEnabled] = useState(false);
  const [loadingUi, setLoadingUi] = useState(true);

  useEffect(() => {
    void getExperimentalUiEnabled()
      .then(setUiEnabled)
      .finally(() => setLoadingUi(false));
  }, []);

  async function handleUiToggle(next: boolean) {
    setUiEnabled(next);
    try {
      await setExperimentalUiEnabled(next);
    } catch {
      setUiEnabled(!next);
      Alert.alert(
        'Could Not Save',
        'Experimental preference could not be saved on this device.',
      );
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Experimental</Text>
      <Text style={styles.description}>
        Early features that may change or be removed. Turn this on to see and
        manage them.
      </Text>
      <View style={styles.row}>
        <Text style={styles.label}>
          {uiEnabled ? 'Experimental on' : 'Experimental off'}
        </Text>
        {loadingUi ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Switch
            value={uiEnabled}
            onValueChange={value => void handleUiToggle(value)}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={uiEnabled ? colors.primary : colors.muted}
            accessibilityLabel="Experimental features"
          />
        )}
      </View>

      {uiEnabled ? (
        <View style={styles.featureList}>
          {FEATURES.length === 0 ? (
            <Text style={styles.emptyText}>
              No experimental features right now.
            </Text>
          ) : (
            FEATURES.map(feature => (
              <View key={feature.key} style={styles.featureCard}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>
                  {feature.description}
                </Text>
              </View>
            ))
          )}
        </View>
      ) : null}
    </View>
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
    featureList: {
      marginTop: 12,
      gap: 8,
    },
    emptyText: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
      paddingVertical: 4,
    },
    featureCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    featureTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    featureDescription: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.muted,
    },
  });
}
