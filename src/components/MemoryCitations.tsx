import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from './ThemedText';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { MemoryCitation } from '../types/citations';
import type { ThemeColors } from '../theme/colors';

type Props = {
  citations: MemoryCitation[];
};

export function MemoryCitations({ citations }: Props) {
  const styles = useThemedStyles(createStyles);
  const [expanded, setExpanded] = useState(false);

  if (!citations.length) {
    return null;
  }

  const noteCount = citations.filter(c => c.source === 'note').length;
  const factCount = citations.length - noteCount;
  const labelParts: string[] = [];
  if (factCount > 0) {
    labelParts.push(`${factCount} memor${factCount === 1 ? 'y' : 'ies'}`);
  }
  if (noteCount > 0) {
    labelParts.push(`${noteCount} note${noteCount === 1 ? '' : 's'}`);
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(v => !v)}
        style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
      >
        <Text style={styles.chipText}>Used {labelParts.join(' · ')}</Text>
        <Text style={styles.chevron}>{expanded ? '▴' : '▾'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.panel}>
          {citations.map((citation, index) => (
            <View
              key={`${citation.source}-${citation.id ?? index}`}
              style={styles.item}
            >
              <Text style={styles.source}>
                {citation.source === 'note' ? 'Note' : 'Memory'}
              </Text>
              <Text style={styles.text}>{citation.text}</Text>
            </View>
          ))}
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
      backgroundColor: colors.background,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    chipPressed: {
      opacity: 0.8,
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
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 10,
      gap: 8,
    },
    item: {
      gap: 2,
    },
    source: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '600',
      fontFamily: colors.fontFamily,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    text: {
      color: colors.text,
      fontSize: 12,
      lineHeight: 17,
      fontFamily: colors.fontFamily,
    },
  });
}
