import React, { useMemo, useState } from 'react';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  Linking,
  Platform,
  Pressable,
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
  /** While streaming, skip markdown parse for cheaper per-token updates. */
  streaming?: boolean;
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

function CodeBlock({
  text,
  styles,
}: {
  text: string;
  styles: ReturnType<typeof createStyles>;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    Clipboard.setString(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={styles.codeBlock}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copied ? 'Copied' : 'Copy code'}
        onPress={onCopy}
        style={({ pressed }) => [
          styles.codeCopyButton,
          pressed && styles.codeCopyPressed,
        ]}
      >
        <Text style={styles.codeCopyText}>{copied ? 'Copied' : 'Copy'}</Text>
      </Pressable>
      <Text style={styles.codeBlockText}>{text}</Text>
    </View>
  );
}

export function MessageContent({
  content,
  variant,
  streaming = false,
  textStyle,
}: Props) {
  const styles = useThemedStyles(createStyles);

  const blocks = useMemo(() => {
    if (!content || variant === 'user' || streaming) {
      return null;
    }
    return parseMarkdownBlocks(content);
  }, [content, variant, streaming]);

  if (!content) {
    return null;
  }

  if (variant === 'user' || streaming || !blocks) {
    return <Text style={textStyle}>{content}</Text>;
  }

  const lastIndex = blocks.length - 1;

  return (
    <View style={styles.root} collapsable={false}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        // Margins instead of gap: Fabric/Yoga has under-measured ScrollView
        // content when gap separates Text-heavy markdown blocks on iOS.
        const blockSpacing =
          index < lastIndex ? styles.blockSpacing : null;

        if (block.type === 'hr') {
          return <View key={key} style={[styles.hr, blockSpacing]} />;
        }

        if (block.type === 'code') {
          return (
            <View key={key} style={blockSpacing}>
              <CodeBlock text={block.text} styles={styles} />
            </View>
          );
        }

        if (block.type === 'list') {
          return (
            <View key={key} style={[styles.list, blockSpacing]} collapsable={false}>
              {block.items.map((item, itemIndex) => (
                // Keep marker + body in one Text tree. A flex row + flex:1
                // body under-measures wrapped height on iOS Fabric, which
                // clips the last lines and makes the chat ScrollView bounce.
                <View
                  key={`${key}-${itemIndex}`}
                  style={
                    itemIndex < block.items.length - 1
                      ? styles.listItemSpacing
                      : null
                  }
                  collapsable={false}
                >
                  <Text style={textStyle}>
                    <Text style={[textStyle, styles.listMarker]}>
                      {block.ordered ? `${itemIndex + 1}. ` : '• '}
                    </Text>
                    {InlineText(item, textStyle, styles)}
                  </Text>
                </View>
              ))}
            </View>
          );
        }

        if (block.type === 'blockquote') {
          return (
            <View key={key} style={[styles.blockquote, blockSpacing]}>
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
            <View key={key} style={blockSpacing} collapsable={false}>
              <Text style={[textStyle, headingStyle]}>
                {InlineText(block.children, [textStyle, headingStyle], styles)}
              </Text>
            </View>
          );
        }

        if (block.type === 'table') {
          return (
            <View key={key} style={blockSpacing} collapsable={false}>
              <TableBlock
                header={block.header}
                rows={block.rows}
                textStyle={textStyle}
                styles={styles}
              />
            </View>
          );
        }

        return (
          <View key={key} style={blockSpacing} collapsable={false}>
            <Text style={[styles.paragraph, textStyle]}>
              {InlineText(block.children, textStyle, styles)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {},
    blockSpacing: {
      marginBottom: 8,
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
      paddingTop: 28,
      position: 'relative',
    },
    codeCopyButton: {
      position: 'absolute',
      top: 6,
      right: 6,
      zIndex: 1,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    codeCopyPressed: {
      opacity: 0.75,
    },
    codeCopyText: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '600',
      fontFamily: colors.fontFamily,
    },
    codeBlockText: {
      fontFamily: MONO_FONT,
      fontSize: 13,
      lineHeight: 18,
      color: colors.text,
    },
    list: {},
    listItemSpacing: {
      marginBottom: 4,
    },
    listMarker: {
      color: colors.text,
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
