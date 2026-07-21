import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { ThemeColors } from '../theme/colors';
import {
  aliasTag,
  listTagSuggestions,
  listTaxonomy,
  mergeTags,
  pinTag,
  renameTag,
  resolveTagSuggestion,
  type TagSuggestion,
  type TaxonomyTag,
} from '../services/notesApi';

export function TagTaxonomyPanel({ onChanged }: { onChanged?: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<TaxonomyTag[]>([]);
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [renameFrom, setRenameFrom] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const [aliasSource, setAliasSource] = useState('');
  const [aliasCanonical, setAliasCanonical] = useState('');
  const [mergeSource, setMergeSource] = useState('');
  const [mergeCanonical, setMergeCanonical] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [taxonomy, pending] = await Promise.all([
        listTaxonomy(100),
        listTagSuggestions(),
      ]);
      setTags(taxonomy);
      setSuggestions(pending);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tags');
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
      onChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen(v => !v)}>
        <Text style={styles.toggle}>
          {open ? 'Hide tag organization' : 'Organize tags'}
        </Text>
      </Pressable>
      {open ? (
        <View style={styles.body}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {suggestions.map(s => (
            <View key={s.id} style={styles.row}>
              <Text style={styles.rowText}>
                #{s.payload?.tag ?? 'tag'}
                {typeof s.confidence === 'number'
                  ? ` · ${Math.round(s.confidence * 100)}%`
                  : ''}
              </Text>
              <View style={styles.rowActions}>
                <Pressable
                  disabled={busy}
                  onPress={() =>
                    void run(() => resolveTagSuggestion(s.id, 'accepted'))
                  }
                >
                  <Text style={styles.accept}>Accept</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  onPress={() =>
                    void run(() => resolveTagSuggestion(s.id, 'rejected'))
                  }
                >
                  <Text style={styles.reject}>Reject</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <View style={styles.chipRow}>
            {tags.map(t => (
              <Pressable
                key={t.name}
                disabled={busy}
                style={[styles.chip, t.pinned && styles.chipActive]}
                onPress={() => void run(() => pinTag(t.name, !t.pinned))}
              >
                <Text
                  style={[styles.chipText, t.pinned && styles.chipTextActive]}
                >
                  {t.pinned ? '* ' : ''}#{t.name} {t.count}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Rename from"
            placeholderTextColor={colors.muted}
            value={renameFrom}
            onChangeText={setRenameFrom}
          />
          <TextInput
            style={styles.input}
            placeholder="Rename to"
            placeholderTextColor={colors.muted}
            value={renameTo}
            onChangeText={setRenameTo}
          />
          <Pressable
            style={styles.action}
            disabled={busy}
            onPress={() => {
              if (!renameFrom.trim() || !renameTo.trim()) return;
              void run(async () => {
                await renameTag(renameFrom, renameTo);
                setRenameFrom('');
                setRenameTo('');
              });
            }}
          >
            <Text style={styles.actionText}>Rename</Text>
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder="Alias source"
            placeholderTextColor={colors.muted}
            value={aliasSource}
            onChangeText={setAliasSource}
          />
          <TextInput
            style={styles.input}
            placeholder="Alias canonical"
            placeholderTextColor={colors.muted}
            value={aliasCanonical}
            onChangeText={setAliasCanonical}
          />
          <Pressable
            style={styles.action}
            disabled={busy}
            onPress={() => {
              if (!aliasSource.trim() || !aliasCanonical.trim()) return;
              void run(async () => {
                await aliasTag(aliasSource, aliasCanonical);
                setAliasSource('');
                setAliasCanonical('');
              });
            }}
          >
            <Text style={styles.actionText}>Alias</Text>
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder="Merge source"
            placeholderTextColor={colors.muted}
            value={mergeSource}
            onChangeText={setMergeSource}
          />
          <TextInput
            style={styles.input}
            placeholder="Merge canonical"
            placeholderTextColor={colors.muted}
            value={mergeCanonical}
            onChangeText={setMergeCanonical}
          />
          <Pressable
            style={styles.action}
            disabled={busy}
            onPress={() => {
              if (!mergeSource.trim() || !mergeCanonical.trim()) return;
              void run(async () => {
                await mergeTags(mergeSource, mergeCanonical);
                setMergeSource('');
                setMergeCanonical('');
              });
            }}
          >
            <Text style={styles.actionText}>Merge</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    toggle: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
    },
    body: {
      marginTop: 10,
      gap: 8,
    },
    error: {
      color: colors.destructive,
      fontSize: 12,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    rowText: {
      fontSize: 12,
      color: colors.text,
    },
    rowActions: {
      flexDirection: 'row',
      gap: 10,
    },
    accept: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '600',
    },
    reject: {
      color: colors.destructive,
      fontSize: 12,
      fontWeight: '600',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    chip: {
      borderRadius: 999,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    chipActive: {
      backgroundColor: colors.primary,
    },
    chipText: {
      fontSize: 12,
      color: colors.muted,
      fontWeight: '600',
    },
    chipTextActive: {
      color: colors.white,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 13,
      color: colors.text,
    },
    action: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    actionText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
  });
}
