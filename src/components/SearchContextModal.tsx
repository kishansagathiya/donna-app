import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import {
  formatNoteDate,
  searchNotes,
  type NoteSearchResult,
} from '../services/notesApi';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function SearchContextModal({ visible, onClose }: Props) {
  const isDarkMode = useColorScheme() === 'dark';
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

  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a';
  const secondaryColor = isDarkMode ? '#aaaaaa' : '#666666';
  const surfaceColor = isDarkMode ? '#1a1a1a' : '#ffffff';
  const borderColor = isDarkMode ? '#333333' : '#e0d8c4';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: surfaceColor }]}>
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <Text style={[styles.title, { color: '#9A7B2F' }]}>Search context</Text>
          <Pressable onPress={handleClose} accessibilityRole="button">
            <Text style={[styles.close, { color: secondaryColor }]}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={[
              styles.input,
              { color: textColor, borderColor, backgroundColor: isDarkMode ? '#000' : '#f2efe6' },
            ]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search context…"
            placeholderTextColor={secondaryColor}
            returnKeyType="search"
            onSubmitEditing={() => void handleSearch()}
            autoFocus
          />
          <Pressable
            style={[styles.searchButton, searching && styles.searchButtonDisabled]}
            onPress={() => void handleSearch()}
            disabled={searching || !query.trim()}
            accessibilityRole="button"
          >
            {searching ? (
              <ActivityIndicator size="small" color="#ffffff" />
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
          <Text style={[styles.empty, { color: secondaryColor }]}>No matches found</Text>
        ) : null}

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={[styles.resultCard, { borderColor }]}>
              <View style={styles.resultHeader}>
                <Text style={[styles.resultTitle, { color: textColor }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={styles.flags}>
                  {item.is_urgent ? <Text>🔥</Text> : null}
                  {item.is_important ? <Text>⭐</Text> : null}
                </View>
              </View>
              {item.preview ? (
                <Text style={[styles.resultPreview, { color: secondaryColor }]} numberOfLines={3}>
                  {item.preview}
                </Text>
              ) : null}
              <Text style={[styles.resultDate, { color: secondaryColor }]}>
                {formatNoteDate(item.note_date)}
              </Text>
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  close: {
    fontSize: 16,
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
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#9A7B2F',
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
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  error: {
    color: '#b42318',
    paddingHorizontal: 20,
    marginBottom: 8,
    fontSize: 14,
  },
  empty: {
    paddingHorizontal: 20,
    fontSize: 15,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  resultCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
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
  },
  flags: {
    flexDirection: 'row',
    gap: 4,
  },
  resultPreview: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },
  resultDate: {
    marginTop: 8,
    fontSize: 12,
  },
});
