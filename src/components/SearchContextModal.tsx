import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import {
  formatNoteDate,
  searchNotes,
  type NoteSearchResult,
} from '../services/notesApi';
import type { ThemeColors } from '../theme/colors';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (noteId: string) => void;
};

export function SearchNotesModal({ visible, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NoteSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    setSearching(true);
    setSearched(true);
    setError(null);
    try {
      setResults(await searchNotes(trimmed));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleClose = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    setError(null);
    onClose();
  };

  function handleSelect(id: string) {
    handleClose();
    onSelect(id);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Search notes</Text>
          <Pressable
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.close}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search notes…"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            onSubmitEditing={() => void handleSearch()}
            autoFocus
          />
          <Pressable
            style={[
              styles.searchButton,
              (searching || !query.trim()) && styles.searchButtonDisabled,
            ]}
            onPress={() => void handleSearch()}
            disabled={searching || !query.trim()}
            accessibilityRole="button"
          >
            {searching ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </Pressable>
        </View>

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        {searched && results.length === 0 && !error ? (
          <Text style={styles.empty}>No matches found</Text>
        ) : null}

        <FlatList
          data={results}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.resultCard,
                pressed && styles.resultCardPressed,
              ]}
              onPress={() => handleSelect(item.id)}
              accessibilityRole="button"
            >
              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={styles.flags}>
                  {item.is_urgent ? (
                    <Text style={{ color: colors.destructive }}>!</Text>
                  ) : null}
                  {item.is_important ? (
                    <Text style={{ color: colors.primary }}>*</Text>
                  ) : null}
                </View>
              </View>
              {item.preview ? (
                <Text style={styles.resultPreview} numberOfLines={3}>
                  {item.preview}
                </Text>
              ) : null}
              <Text style={styles.resultDate}>
                {formatNoteDate(item.note_date)}
              </Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

/** @deprecated Prefer SearchNotesModal */
export const SearchContextModal = SearchNotesModal;

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    close: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      minHeight: 44,
      lineHeight: 44,
      paddingHorizontal: 4,
    },
    searchRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    searchButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 16,
      justifyContent: 'center',
      minWidth: 72,
      alignItems: 'center',
    },
    searchButtonDisabled: {
      opacity: 0.6,
    },
    searchButtonText: {
      color: colors.white,
      fontWeight: '600',
      fontSize: 15,
    },
    error: {
      color: colors.destructive,
      paddingHorizontal: 20,
      marginBottom: 8,
      fontSize: 14,
    },
    empty: {
      paddingHorizontal: 20,
      fontSize: 15,
      color: colors.muted,
    },
    list: {
      paddingHorizontal: 20,
      paddingBottom: 32,
      gap: 12,
    },
    resultCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      backgroundColor: colors.background,
    },
    resultCardPressed: {
      backgroundColor: colors.surface,
    },
    resultHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 8,
    },
    resultTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    flags: {
      flexDirection: 'row',
      gap: 4,
    },
    resultPreview: {
      marginTop: 6,
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
    },
    resultDate: {
      marginTop: 8,
      fontSize: 12,
      color: colors.muted,
    },
  });
}
