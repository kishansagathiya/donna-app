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
import {
  getAccountPreferences,
  updateExperimentalFeatures,
  type ExperimentalFeatures,
} from '../services/accountApi';
import type { ThemeColors } from '../theme/colors';

type FeatureKey = keyof ExperimentalFeatures;

const FEATURES: {
  key: FeatureKey;
  title: string;
  description: string;
}[] = [
  {
    key: 'notesFeed',
    title: 'Notes V2 feed',
    description: 'Use the faster Notes feed with richer metadata.',
  },
  {
    key: 'smartTagging',
    title: 'Smart tagging',
    description: 'Automatically suggest tags when notes are saved.',
  },
  {
    key: 'memoryExtraction',
    title: 'Memory extraction',
    description: 'Extract durable facts from notes and conversations.',
  },
  {
    key: 'memoryRetrieval',
    title: 'Memory retrieval',
    description: 'Recall extracted memories when chatting with Donna.',
  },
];

const DEFAULT_FEATURES: ExperimentalFeatures = {
  notesFeed: false,
  smartTagging: false,
  memoryExtraction: false,
  memoryRetrieval: false,
};

export function ExperimentalSection() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [uiEnabled, setUiEnabled] = useState(false);
  const [features, setFeatures] =
    useState<ExperimentalFeatures>(DEFAULT_FEATURES);
  const [loadingUi, setLoadingUi] = useState(true);
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const [savingKey, setSavingKey] = useState<FeatureKey | null>(null);

  useEffect(() => {
    void getExperimentalUiEnabled()
      .then(setUiEnabled)
      .finally(() => setLoadingUi(false));
  }, []);

  useEffect(() => {
    if (!uiEnabled) {
      return;
    }
    setLoadingFeatures(true);
    void getAccountPreferences()
      .then(preferences => {
        setFeatures(preferences.experimental ?? DEFAULT_FEATURES);
      })
      .catch(error => {
        Alert.alert(
          'Could Not Load Experimental Features',
          error instanceof Error ? error.message : 'Please try again.',
        );
      })
      .finally(() => setLoadingFeatures(false));
  }, [uiEnabled]);

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

  async function handleFeatureToggle(key: FeatureKey, next: boolean) {
    if (savingKey) {
      return;
    }
    const previous = features;
    setFeatures({ ...features, [key]: next });
    setSavingKey(key);
    try {
      const saved = await updateExperimentalFeatures({ [key]: next });
      setFeatures(saved);
    } catch (error) {
      setFeatures(previous);
      Alert.alert(
        'Could Not Save Feature',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSavingKey(null);
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
          {loadingFeatures ? (
            <ActivityIndicator
              color={colors.primary}
              style={styles.featureLoader}
            />
          ) : (
            FEATURES.map(feature => {
              const enabled = features[feature.key];
              const saving = savingKey === feature.key;
              return (
                <View key={feature.key} style={styles.featureCard}>
                  <View style={styles.featureHeader}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    {saving ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Switch
                        value={enabled}
                        onValueChange={value =>
                          void handleFeatureToggle(feature.key, value)
                        }
                        disabled={savingKey !== null}
                        trackColor={{
                          false: colors.border,
                          true: colors.primaryLight,
                        }}
                        thumbColor={enabled ? colors.primary : colors.muted}
                        accessibilityLabel={feature.title}
                      />
                    )}
                  </View>
                  <Text style={styles.featureDescription}>
                    {feature.description}
                  </Text>
                </View>
              );
            })
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
    featureLoader: {
      marginVertical: 12,
    },
    featureCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    featureHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 4,
    },
    featureTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    featureDescription: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.muted,
    },
  });
}
