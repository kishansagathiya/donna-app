import React, { useMemo } from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { Text } from './ThemedText';
import { useThemedStyles } from '../hooks/useThemedStyles';
import {
  parseMarkdownBlocks,
  type InlineNode,
  type TableAlign,
  type TableCell,
} from '../lib/chatMarkdown';
import type { ThemeColors } from '../theme/colors';

type Props = {
  content: string;
  variant: 'user' | 'assistant';
  textStyle?: StyleProp<TextStyle>;
};

const MONO_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

function openLink(url: string) {
  Linking.openURL(url).catch(() => {
    // Ignore invalid / unsupported URLs from model output.
  });
}

function InlineText(
  nodes: InlineNode[],
  baseStyle: StyleProp<TextStyle>,
  styles: ReturnType<typeof createStyles>,
) {
  return nodes.map((node, index) => {
    const markStyle: TextStyle[] = [];
    if (node.marks.bold) {
      markStyle.push(styles.bold);
    }
    if (node.marks.italic) {
      markStyle.push(styles.italic);
    }
    if (node.marks.strike) {
      markStyle.push(styles.strike);
    }
    if (node.marks.code) {
      markStyle.push(styles.inlineCode);
    }
    if (node.marks.linkHref) {
      markStyle.push(styles.link);
    }

    return (
      <Text
        key={`${index}-${node.text.slice(0, 12)}`}
        style={[baseStyle, ...markStyle]}
        onPress={
          node.marks.linkHref
            ? () => openLink(node.marks.linkHref!)
            : undefined
        }
      >
        {node.text}
      </Text>
    );
  });
}

function alignStyle(align: TableAlign): TextStyle | undefined {
  if (align === 'center') {
    return { textAlign: 'center' };
  }
  if (align === 'right') {
    return { textAlign: 'right' };
  }
  if (align === 'left') {
    return { textAlign: 'left' };
  }
  return undefined;
}

function TableBlock({
  header,
  rows,
  textStyle,
  styles,
}: {
  header: TableCell[];
  rows: TableCell[][];
  textStyle?: StyleProp<TextStyle>;
  styles: ReturnType<typeof createStyles>;
}) {
  const columnCount = Math.max(
    header.length,
    ...rows.map(row => row.length),
    1,
  );

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      style={styles.tableScroll}
      contentContainerStyle={styles.tableScrollContent}
    >
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
          {Array.from({ length: columnCount }, (_, colIndex) => {
            const cell = header[colIndex] ?? {
              children: [{ text: '', marks: {} }],
              align: null,
            };
            return (
              <View key={`h-${colIndex}`} style={styles.tableCell}>
                <Text
                  style={[
                    textStyle,
                    styles.tableHeaderText,
                    alignStyle(cell.align),
                  ]}
                >
                  {InlineText(
                    cell.children,
                    [textStyle, styles.tableHeaderText],
                    styles,
                  )}
                </Text>
              </View>
            );
          })}
        </View>
        {rows.map((row, rowIndex) => (
          <View
            key={`r-${rowIndex}`}
            style={[
              styles.tableRow,
              rowIndex === rows.length - 1 ? styles.tableLastRow : null,
            ]}
          >
            {Array.from({ length: columnCount }, (_, colIndex) => {
              const cell = row[colIndex] ?? {
                children: [{ text: '', marks: {} }],
                align: null,
              };
              return (
                <View key={`c-${rowIndex}-${colIndex}`} style={styles.tableCell}>
                  <Text style={[textStyle, alignStyle(cell.align)]}>
                    {InlineText(cell.children, textStyle, styles)}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function MessageContent({ content, variant, textStyle }: Props) {
  const styles = useThemedStyles(createStyles);

  const blocks = useMemo(() => {
    if (!content || variant === 'user') {
      return null;
    }
    return parseMarkdownBlocks(content);
  }, [content, variant]);

  if (!content) {
    return null;
  }

  if (variant === 'user' || !blocks) {
    return <Text style={textStyle}>{content}</Text>;
  }

  return (
    <View style={styles.root}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        if (block.type === 'hr') {
          return <View key={key} style={styles.hr} />;
        }

        if (block.type === 'code') {
          return (
            <View key={key} style={styles.codeBlock}>
              <Text style={styles.codeBlockText}>{block.text}</Text>
            </View>
          );
        }

        if (block.type === 'list') {
          return (
            <View key={key} style={styles.list}>
              {block.items.map((item, itemIndex) => (
                <View key={`${key}-${itemIndex}`} style={styles.listItem}>
                  <Text style={[textStyle, styles.listMarker]}>
                    {block.ordered ? `${itemIndex + 1}.` : '•'}
                  </Text>
                  <Text style={[styles.listItemBody, textStyle]}>
                    {InlineText(item, textStyle, styles)}
                  </Text>
                </View>
              ))}
            </View>
          );
        }

        if (block.type === 'blockquote') {
          return (
            <View key={key} style={styles.blockquote}>
              <Text style={[textStyle, styles.blockquoteText]}>
                {InlineText(
                  block.children,
                  [textStyle, styles.blockquoteText],
                  styles,
                )}
              </Text>
            </View>
          );
        }

        if (block.type === 'heading') {
          const headingStyle =
            block.level === 1
              ? styles.h1
              : block.level === 2
                ? styles.h2
                : styles.h3;
          return (
            <Text key={key} style={[textStyle, headingStyle]}>
              {InlineText(block.children, [textStyle, headingStyle], styles)}
            </Text>
          );
        }

        if (block.type === 'table') {
          return (
            <TableBlock
              key={key}
              header={block.header}
              rows={block.rows}
              textStyle={textStyle}
              styles={styles}
            />
          );
        }

        return (
          <Text key={key} style={[styles.paragraph, textStyle]}>
            {InlineText(block.children, textStyle, styles)}
          </Text>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      gap: 8,
    },
    paragraph: {},
    bold: {
      fontWeight: '700',
    },
    italic: {
      fontStyle: 'italic',
    },
    strike: {
      textDecorationLine: 'line-through',
    },
    link: {
      color: colors.primary,
      textDecorationLine: 'underline',
      fontWeight: '600',
    },
    inlineCode: {
      fontFamily: MONO_FONT,
      fontSize: 13,
      backgroundColor: colors.primaryLight,
      color: colors.text,
    },
    codeBlock: {
      borderRadius: 10,
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    codeBlockText: {
      fontFamily: MONO_FONT,
      fontSize: 13,
      lineHeight: 18,
      color: colors.text,
    },
    list: {
      gap: 4,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    listMarker: {
      minWidth: 18,
      color: colors.text,
    },
    listItemBody: {
      flex: 1,
      flexShrink: 1,
    },
    blockquote: {
      borderLeftWidth: 2,
      borderLeftColor: colors.border,
      paddingLeft: 10,
    },
    blockquoteText: {
      color: colors.muted,
    },
    h1: {
      fontSize: 17,
      fontWeight: '700',
      lineHeight: 24,
    },
    h2: {
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 23,
    },
    h3: {
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 22,
    },
    hr: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    tableScroll: {
      marginVertical: 2,
      maxWidth: '100%',
    },
    tableScrollContent: {
      flexGrow: 1,
    },
    table: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 10,
      overflow: 'hidden',
      minWidth: '100%',
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    tableLastRow: {
      borderBottomWidth: 0,
    },
    tableHeaderRow: {
      backgroundColor: colors.primaryLight,
    },
    tableCell: {
      flexGrow: 1,
      flexShrink: 0,
      minWidth: 88,
      maxWidth: 220,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: colors.border,
    },
    tableHeaderText: {
      fontWeight: '700',
    },
  });
}
