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
import {
  BrainIcon,
  CalendarCheckIcon,
  GlobeIcon,
  StickyNoteIcon,
} from './icons';
import { postMemoryFeedback } from '../services/memoryApi';

type Props = {
  citations: MemoryCitation[];
  onOpenNote?: (noteId: string) => void;
};

export function MemoryCitations({ citations, onOpenNote }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [expanded, setExpanded] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState<string | null>(null);
  const [feedbackDone, setFeedbackDone] = useState<Record<string, string>>({});
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  if (!citations.length) {
    return null;
  }

  const webCount = citations.filter(c => c.source === 'web').length;
  const noteCount = citations.filter(c => c.source === 'note').length;
  const granolaCount = citations.filter(c => c.source === 'granola').length;
  const factCount = citations.length - noteCount - webCount - granolaCount;
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
  if (granolaCount > 0) {
    labelParts.push(
      `${granolaCount} Granola source${granolaCount === 1 ? '' : 's'}`,
    );
  }
  const chipLabel = `Used ${labelParts.join(' · ')}`;

  const sendFeedback = async (
    citation: MemoryCitation,
    action: 'not_relevant' | 'outdated',
  ) => {
    if (
      !citation.id ||
      citation.source === 'web' ||
      citation.source === 'note' ||
      citation.source === 'granola'
    ) {
      return;
    }
    const key = `${citation.id}:${action}`;
    setFeedbackBusy(key);
    setFeedbackError(null);
    try {
      await postMemoryFeedback({ fact_id: citation.id, action });
      setFeedbackDone(prev => ({ ...prev, [citation.id!]: action }));
    } catch (err: unknown) {
      setFeedbackError(
        err instanceof Error ? err.message : 'Feedback failed',
      );
    } finally {
      setFeedbackBusy(null);
    }
  };

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
          {feedbackError ? (
            <Text style={styles.feedbackError}>{feedbackError}</Text>
          ) : null}
          {citations.map((citation, index) => {
            const key = `${citation.source}-${citation.id ?? index}`;
            const isNote = citation.source === 'note' && citation.id;
            const isWeb = citation.source === 'web' && citation.url;
            const isGranola = citation.source === 'granola';
            const isMemoryFact =
              Boolean(citation.id) && !isNote && !isWeb && !isGranola;
            const Icon = isWeb
              ? GlobeIcon
              : isNote
                ? StickyNoteIcon
                : isGranola
                  ? CalendarCheckIcon
                  : BrainIcon;
            const label = citation.title?.trim() || citation.text;

            const body = (
              <View style={styles.itemRow}>
                <View style={styles.iconSlot}>
                  <Icon size={14} color={colors.primary} />
                </View>
                <View style={styles.textWrap}>
                  {isGranola ? (
                    <Text style={styles.sourceLabel}>Granola</Text>
                  ) : null}
                  <Text style={styles.text}>{label}</Text>
                </View>
              </View>
            );

            return (
              <View key={key}>
                {isNote && citation.id ? (
                  <Pressable
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
                ) : isWeb && citation.url ? (
                  <Pressable
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
                ) : (
                  <View style={styles.item}>{body}</View>
                )}
                {isMemoryFact && citation.id ? (
                  <View style={styles.feedbackRow}>
                    {feedbackDone[citation.id] ? (
                      <Text style={styles.feedbackDone}>
                        Marked {feedbackDone[citation.id].replace('_', ' ')}
                      </Text>
                    ) : (
                      <>
                        <Pressable
                          disabled={feedbackBusy !== null}
                          onPress={() =>
                            void sendFeedback(citation, 'not_relevant')
                          }
                        >
                          <Text style={styles.feedbackAction}>Not relevant</Text>
                        </Pressable>
                        <Pressable
                          disabled={feedbackBusy !== null}
                          onPress={() =>
                            void sendFeedback(citation, 'outdated')
                          }
                        >
                          <Text style={styles.feedbackAction}>Outdated</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                ) : null}
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
      alignSelf: 'stretch',
      maxWidth: '90%',
      gap: 6,
    },
    chip: {
      alignSelf: 'flex-start',
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
      alignSelf: 'stretch',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 10,
      gap: 4,
    },
    item: {
      alignSelf: 'stretch',
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
      width: '100%',
    },
    iconSlot: {
      width: 14,
      height: 14,
      marginTop: 1.5,
    },
    textWrap: {
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    sourceLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      marginBottom: 2,
      fontFamily: colors.fontFamily,
    },
    text: {
      color: colors.text,
      fontSize: 12,
      lineHeight: 17,
      fontFamily: colors.fontFamily,
    },
    feedbackRow: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 6,
      paddingBottom: 4,
    },
    feedbackAction: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '600',
      textDecorationLine: 'underline',
      fontFamily: colors.fontFamily,
    },
    feedbackDone: {
      color: colors.muted,
      fontSize: 11,
      fontFamily: colors.fontFamily,
    },
    feedbackError: {
      color: colors.destructive,
      fontSize: 11,
      paddingHorizontal: 6,
      fontFamily: colors.fontFamily,
    },
  });
}
