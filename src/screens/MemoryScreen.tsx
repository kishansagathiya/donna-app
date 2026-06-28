import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import {
  createMemoryFact,
  deleteMemoryFact,
  formatFactDate,
  getMemoryProfile,
  listMemoryFacts,
  updateMemoryFact,
  updateMemoryProfile,
  type MemoryFact,
} from '../services/memoryApi';
import type { ThemeColors } from '../theme/colors';

type Props = {
  onAddSourcePress: () => void;
};

type FactModalProps = {
  visible: boolean;
  title: string;
  text: string;
  placeholder?: string;
  saving: boolean;
  saveLabel: string;
  savingLabel: string;
  onChangeText: (text: string) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
};

function FactModal({
  visible,
  title,
  text,
  placeholder,
  saving,
  saveLabel,
  savingLabel,
  onChangeText,
  onClose,
  onSave,
  onDelete,
}: FactModalProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalAvoiding}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose}>
          <Pressable
            style={[
              styles.modalCard,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
            onPress={e => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.modalCloseText}>Cancel</Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <TextInput
                style={[styles.input, styles.textArea, styles.modalTextArea]}
                value={text}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.muted}
                multiline
                autoFocus
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.primaryButton, saving && styles.buttonDisabled]}
                onPress={onSave}
                disabled={saving || !text.trim()}
              >
                <Text style={styles.primaryButtonText}>
                  {saving ? savingLabel : saveLabel}
                </Text>
              </Pressable>
              {onDelete ? (
                <Pressable style={styles.destructiveButton} onPress={onDelete}>
                  <Text style={styles.destructiveButtonText}>Delete</Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function MemoryScreen({ onAddSourcePress }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState('');
  const [identityFactsText, setIdentityFactsText] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [query, setQuery] = useState('');
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFact, setSelectedFact] = useState<MemoryFact | null>(null);
  const [editText, setEditText] = useState('');
  const [savingFact, setSavingFact] = useState(false);
  const [showAddFact, setShowAddFact] = useState(false);
  const [newFactText, setNewFactText] = useState('');

  const loadFacts = useCallback(async (searchQuery = '') => {
    setSearching(true);
    setError(null);
    try {
      setFacts(await listMemoryFacts(searchQuery));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load facts');
      setFacts([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const profile = await getMemoryProfile();
        setSummary(profile.summary);
        setIdentityFactsText(profile.identity_facts.join('\n'));
        await loadFacts();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load memory');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadFacts]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setError(null);
    try {
      const identity_facts = identityFactsText
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
      const updated = await updateMemoryProfile({ summary, identity_facts });
      setSummary(updated.summary);
      setIdentityFactsText(updated.identity_facts.join('\n'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const openFact = (fact: MemoryFact) => {
    setSelectedFact(fact);
    setEditText(fact.fact);
  };

  const handleSaveFact = async () => {
    if (!selectedFact || !editText.trim()) {
      return;
    }
    setSavingFact(true);
    setError(null);
    try {
      const updated = await updateMemoryFact(selectedFact.id, {
        fact: editText.trim(),
      });
      setFacts(prev =>
        prev.map(f => (f.id === selectedFact.id ? updated : f)),
      );
      setSelectedFact(null);
      setEditText('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save fact');
    } finally {
      setSavingFact(false);
    }
  };

  const handleDeleteFact = () => {
    if (!selectedFact) {
      return;
    }
    Alert.alert(
      'Delete fact',
      'Remove this fact from Donna\'s memory?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setError(null);
              try {
                await deleteMemoryFact(selectedFact.id);
                setFacts(prev => prev.filter(f => f.id !== selectedFact.id));
                setSelectedFact(null);
                setEditText('');
              } catch (err: unknown) {
                setError(
                  err instanceof Error ? err.message : 'Failed to delete fact',
                );
              }
            })();
          },
        },
      ],
    );
  };

  const handleAddFact = async () => {
    if (!newFactText.trim()) {
      return;
    }
    setSavingFact(true);
    setError(null);
    try {
      const created = await createMemoryFact({ fact: newFactText.trim() });
      setFacts(prev => [created, ...prev]);
      setNewFactText('');
      setShowAddFact(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add fact');
    } finally {
      setSavingFact(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Memory</Text>
          <Text style={styles.subtitle}>What Donna knows about you</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.addButton}
            onPress={() => setShowAddFact(true)}
            accessibilityRole="button"
            accessibilityLabel="Add fact"
          >
            <Text style={styles.addButtonText}>+</Text>
          </Pressable>
        </View>
      </View>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>Profile</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={summary}
          onChangeText={setSummary}
          placeholder="Summary about you…"
          placeholderTextColor={colors.muted}
          multiline
        />
        <Text style={styles.fieldLabel}>Identity facts (one per line)</Text>
        <TextInput
          style={[styles.input, styles.textAreaSmall]}
          value={identityFactsText}
          onChangeText={setIdentityFactsText}
          placeholder={"User's name is …"}
          placeholderTextColor={colors.muted}
          multiline
        />
        <Pressable
          style={[styles.primaryButton, savingProfile && styles.buttonDisabled]}
          onPress={() => void handleSaveProfile()}
          disabled={savingProfile}
        >
          <Text style={styles.primaryButtonText}>
            {savingProfile ? 'Saving…' : 'Save profile'}
          </Text>
        </Pressable>

        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, styles.searchInput]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search facts…"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            onSubmitEditing={() => void loadFacts(query)}
          />
          <Pressable
            style={[styles.searchButton, searching && styles.buttonDisabled]}
            onPress={() => void loadFacts(query)}
            disabled={searching}
          >
            {searching ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Facts</Text>
        {facts.length === 0 && !searching ? (
          <Text style={styles.hint}>
            Donna learns from conversations, or add facts with +.
          </Text>
        ) : null}

        <FlatList
          data={facts}
          keyExtractor={item => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Pressable style={styles.factCard} onPress={() => openFact(item)}>
              <Text style={styles.factText}>{item.fact}</Text>
              {item.created_at ? (
                <Text style={styles.factDate}>
                  {formatFactDate(item.created_at)}
                </Text>
              ) : null}
            </Pressable>
          )}
        />

        <Pressable style={styles.linkButton} onPress={onAddSourcePress}>
          <Text style={styles.linkButtonText}>Add source material (link/file)</Text>
        </Pressable>
      </ScrollView>

      <FactModal
        visible={selectedFact !== null}
        title="Edit fact"
        text={editText}
        saving={savingFact}
        saveLabel="Save"
        savingLabel="Saving…"
        onChangeText={setEditText}
        onClose={() => {
          setSelectedFact(null);
          setEditText('');
        }}
        onSave={() => void handleSaveFact()}
        onDelete={handleDeleteFact}
      />

      <FactModal
        visible={showAddFact}
        title="New fact"
        text={newFactText}
        placeholder="Something Donna should remember…"
        saving={savingFact}
        saveLabel="Add"
        savingLabel="Adding…"
        onChangeText={setNewFactText}
        onClose={() => {
          setShowAddFact(false);
          setNewFactText('');
        }}
        onSave={() => void handleAddFact()}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      marginTop: 2,
      fontSize: 14,
      color: colors.muted,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 8,
    },
    addButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonText: {
      fontSize: 22,
      lineHeight: 24,
      color: colors.primary,
      fontWeight: '500',
    },
    error: {
      color: colors.destructive,
      paddingHorizontal: 20,
      paddingTop: 8,
      fontSize: 14,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 32,
    },
    sectionTitle: {
      marginTop: 16,
      marginBottom: 8,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    fieldLabel: {
      marginTop: 8,
      fontSize: 12,
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
      minHeight: 88,
      textAlignVertical: 'top',
    },
    textAreaSmall: {
      minHeight: 64,
      textAlignVertical: 'top',
    },
    primaryButton: {
      marginTop: 10,
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
    buttonDisabled: {
      opacity: 0.6,
    },
    searchRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 20,
    },
    searchInput: {
      flex: 1,
    },
    searchButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 16,
      justifyContent: 'center',
      minWidth: 72,
      alignItems: 'center',
    },
    searchButtonText: {
      color: colors.white,
      fontWeight: '600',
      fontSize: 15,
    },
    hint: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.muted,
      marginBottom: 8,
    },
    factCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      backgroundColor: colors.background,
    },
    factText: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
    },
    factDate: {
      marginTop: 8,
      fontSize: 12,
      color: colors.muted,
    },
    linkButton: {
      marginTop: 16,
      paddingVertical: 8,
    },
    linkButtonText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '500',
    },
    modalAvoiding: {
      flex: 1,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingHorizontal: 20,
      paddingTop: 20,
      maxHeight: '85%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    modalCloseText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    modalScroll: {
      flexGrow: 0,
      flexShrink: 1,
    },
    modalTextArea: {
      minHeight: 120,
      maxHeight: 200,
    },
    modalActions: {
      marginTop: 12,
      gap: 8,
    },
    destructiveButton: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.destructive,
      paddingVertical: 12,
      alignItems: 'center',
    },
    destructiveButtonText: {
      color: colors.destructive,
      fontWeight: '600',
      fontSize: 15,
    },
  });
}
