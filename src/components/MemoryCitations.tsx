import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { MemoryCitation } from '../types/citations';
import type { ThemeColors } from '../theme/colors';
import { BrainIcon, GlobeIcon, StickyNoteIcon } from './icons';

type Props = {
  citations: MemoryCitation[];
  onOpenNote?: (noteId: string) => void;
};

export function MemoryCitations({ citations, onOpenNote }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [expanded, setExpanded] = useState(false);

  if (!citations.length) {
    return null;
  }

  const webCount = citations.filter(c => c.source === 'web').length;
  const noteCount = citations.filter(c => c.source === 'note').length;
  const factCount = citations.length - noteCount - webCount;
  const labelParts: string[] = [];
  if (webCount > 0) {
    labelParts.push(`${webCount} web source${webCount === 1 ? '' : 's'}`);
  }
  if (factCount > 0) {
    labelParts.push(`${factCount} memor${factCount === 1 ? 'y' : 'ies'}`);
  }
  if (noteCount > 0) {
    labelParts.push(`${noteCount} note${noteCount === 1 ? '' : 's'}`);
  }
  const chipLabel = `Used ${labelParts.join(' · ')}`;

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(v => !v)}
        style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
      >
        <BrainIcon size={14} color={colors.primary} />
        <Text style={styles.chipText}>{chipLabel}</Text>
        <Text style={styles.chevron}>{expanded ? '▴' : '▾'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.panel}>
          {citations.map((citation, index) => {
            const key = `${citation.source}-${citation.id ?? index}`;
            const isNote = citation.source === 'note' && citation.id;
            const isWeb = citation.source === 'web' && citation.url;
            const Icon = isWeb
              ? GlobeIcon
              : isNote
                ? StickyNoteIcon
                : BrainIcon;
            const label = citation.title?.trim() || citation.text;

            const body = (
              <View style={styles.itemRow}>
                <Icon size={14} color={colors.primary} />
                <Text style={styles.text}>{label}</Text>
              </View>
            );

            if (isNote && citation.id) {
              return (
                <Pressable
                  key={key}
                  style={({ pressed }) => [
                    styles.item,
                    pressed && styles.itemPressed,
                  ]}
                  onPress={() => onOpenNote?.(citation.id!)}
                  accessibilityRole="link"
                  accessibilityLabel={`Open note: ${label}`}
                >
                  {body}
                </Pressable>
              );
            }

            if (isWeb && citation.url) {
              return (
                <Pressable
                  key={key}
                  style={({ pressed }) => [
                    styles.item,
                    pressed && styles.itemPressed,
                  ]}
                  onPress={() => {
                    void Linking.openURL(citation.url!);
                  }}
                  accessibilityRole="link"
                  accessibilityLabel={`Open web source: ${label}`}
                >
                  {body}
                </Pressable>
              );
            }

            return (
              <View key={key} style={styles.item}>
                {body}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      alignSelf: 'flex-start',
      maxWidth: '90%',
      gap: 6,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    chipPressed: {
      opacity: 0.8,
      borderColor: colors.primaryRing,
    },
    chipText: {
      color: colors.muted,
      fontSize: 12,
      fontFamily: colors.fontFamily,
      fontWeight: '500',
    },
    chevron: {
      color: colors.muted,
      fontSize: 11,
    },
    panel: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 10,
      gap: 4,
    },
    item: {
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 6,
    },
    itemPressed: {
      backgroundColor: colors.primaryLight,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    text: {
      flex: 1,
      color: colors.text,
      fontSize: 12,
      lineHeight: 17,
      fontFamily: colors.fontFamily,
    },
  });
}
