import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '../components/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { ThemeColors } from '../theme/colors';
import {
  createSkill,
  deleteSkill,
  listSkills,
  type Skill,
} from '../services/skillsApi';

type Props = {
  visible: boolean;
  onClose: () => void;
  onUseInAgent?: (name: string) => void;
};

const sourceLabels: Record<Skill['source'], string> = {
  system: 'Bundled',
  user: 'Yours',
  agent: 'Agent',
};

export function SkillsScreen({ visible, onClose, onUseInAgent }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');

  const refresh = useCallback(async () => {
    try {
      setSkills(await listSkills());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setLoading(true);
    void refresh();
  }, [visible, refresh]);

  const save = async () => {
    const n = name.trim();
    const body = content.trim();
    if (!n || !body || saving) {
      return;
    }
    setSaving(true);
    try {
      await createSkill({
        name: n,
        description: description.trim(),
        content: body,
      });
      setName('');
      setDescription('');
      setContent('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save skill');
    } finally {
      setSaving(false);
    }
  };

  const remove = (skill: Skill) => {
    if (!skill.id || skill.source === 'system') {
      return;
    }
    Alert.alert('Delete skill', `Delete “${skill.name}”?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteSkill(skill.id!);
              await refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not delete');
            }
          })();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View
        style={[
          styles.screen,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Skills</Text>
          <Pressable onPress={onClose} accessibilityRole="button">
            <Text style={styles.close}>Done</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          Reusable procedures Donna follows for repeatable agent work.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body}>
            {skills.map(skill => (
              <View key={skill.id ?? skill.name} style={styles.card}>
                <View style={styles.badgeRow}>
                  <Text style={styles.badge}>
                    {sourceLabels[skill.source] ?? skill.source}
                  </Text>
                </View>
                <Text style={styles.cardTitle}>{skill.name}</Text>
                {skill.description ? (
                  <Text style={styles.cardMeta}>{skill.description}</Text>
                ) : null}
                <View style={styles.actionRow}>
                  {onUseInAgent ? (
                    <Pressable
                      style={styles.primaryButton}
                      onPress={() => onUseInAgent(skill.name)}
                    >
                      <Text style={styles.primaryButtonText}>Use in Agent</Text>
                    </Pressable>
                  ) : null}
                  {skill.source !== 'system' ? (
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => remove(skill)}
                    >
                      <Text style={styles.secondaryButtonText}>Delete</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}

            <Text style={styles.sectionTitle}>New skill</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Name (kebab-case)"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="When this skill applies"
            />
            <TextInput
              style={[styles.input, styles.multiline]}
              value={content}
              onChangeText={setContent}
              placeholder="Markdown procedure"
              multiline
            />
            <Pressable
              style={[
                styles.primaryButton,
                saving && styles.buttonDisabled,
              ]}
              disabled={saving}
              onPress={() => void save()}
            >
              <Text style={styles.primaryButtonText}>
                {saving ? 'Saving…' : 'Save skill'}
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    close: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      fontFamily: colors.fontFamily,
    },
    subtitle: {
      paddingHorizontal: 20,
      paddingBottom: 8,
      fontSize: 14,
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    error: {
      paddingHorizontal: 20,
      color: colors.destructive,
      fontSize: 14,
      fontFamily: colors.fontFamily,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      paddingHorizontal: 20,
      paddingBottom: 32,
      gap: 12,
    },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      gap: 8,
      backgroundColor: colors.surface,
    },
    badgeRow: {
      flexDirection: 'row',
    },
    badge: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
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
      fontSize: 13,
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    sectionTitle: {
      marginTop: 8,
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.surface,
      fontFamily: colors.fontFamily,
    },
    multiline: {
      minHeight: 96,
      textAlignVertical: 'top',
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '600',
      fontFamily: colors.fontFamily,
    },
    secondaryButton: {
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
    buttonDisabled: {
      opacity: 0.5,
    },
  });
}
