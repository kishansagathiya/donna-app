export type InlineMark = {
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strike?: boolean;
  linkHref?: string;
};

export type InlineNode = {
  text: string;
  marks: InlineMark;
};

export type BlockNode =
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'heading'; level: 1 | 2 | 3; children: InlineNode[] }
  | { type: 'list'; ordered: boolean; items: InlineNode[][] }
  | { type: 'blockquote'; children: InlineNode[] }
  | { type: 'code'; text: string }
  | { type: 'hr' };

const INLINE_TOKEN =
  /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*\n]+\*|__[^_]+__|_[^_\n]+_|~~[^~]+~~|`[^`\n]+`|\[[^\]]+\]\([^)]+\))/g;

/** Split common chat markdown inline tokens (bold, italic, code, links). */
export function parseInlineMarkdown(input: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let lastIndex = 0;
  const re = new RegExp(INLINE_TOKEN.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = re.exec(input)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({
        text: input.slice(lastIndex, match.index),
        marks: {},
      });
    }

    const token = match[0];
    if (token.startsWith('***') && token.endsWith('***')) {
      nodes.push({
        text: token.slice(3, -3),
        marks: { bold: true, italic: true },
      });
    } else if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push({ text: token.slice(2, -2), marks: { bold: true } });
    } else if (token.startsWith('__') && token.endsWith('__')) {
      nodes.push({ text: token.slice(2, -2), marks: { bold: true } });
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push({ text: token.slice(1, -1), marks: { italic: true } });
    } else if (token.startsWith('_') && token.endsWith('_')) {
      nodes.push({ text: token.slice(1, -1), marks: { italic: true } });
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      nodes.push({ text: token.slice(2, -2), marks: { strike: true } });
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push({ text: token.slice(1, -1), marks: { code: true } });
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        nodes.push({
          text: linkMatch[1],
          marks: { linkHref: linkMatch[2], bold: true },
        });
      } else {
        nodes.push({ text: token, marks: {} });
      }
    } else {
      nodes.push({ text: token, marks: {} });
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < input.length) {
    nodes.push({ text: input.slice(lastIndex), marks: {} });
  }

  return nodes.length > 0 ? nodes : [{ text: input, marks: {} }];
}

function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

function parseListItemText(line: string): string | null {
  const unordered = /^\s*[-*+]\s+(.+)$/.exec(line);
  if (unordered) {
    return unordered[1];
  }
  const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
  if (ordered) {
    return ordered[1];
  }
  return null;
}

function isOrderedListLine(line: string): boolean {
  return /^\s*\d+[.)]\s+/.test(line);
}

/** Parse assistant chat markdown into simple block nodes for native rendering. */
export function parseMarkdownBlocks(markdown: string): BlockNode[] {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const blocks: BlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) {
      i += 1;
      continue;
    }

    if (/^\s*---+\s*$/.test(line) || /^\s*\*\*\*+\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    const fence = /^```/.exec(line);
    if (fence) {
      i += 1;
      const codeLines: string[] = [];
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) {
        i += 1;
      }
      blocks.push({ type: 'code', text: codeLines.join('\n') });
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        children: parseInlineMarkdown(heading[2].trim()),
      });
      i += 1;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      blocks.push({
        type: 'blockquote',
        children: parseInlineMarkdown(quoteLines.join(' ')),
      });
      continue;
    }

    if (parseListItemText(line) !== null) {
      const ordered = isOrderedListLine(line);
      const items: InlineNode[][] = [];
      while (i < lines.length) {
        const itemText = parseListItemText(lines[i]);
        if (itemText === null || isOrderedListLine(lines[i]) !== ordered) {
          break;
        }
        items.push(parseInlineMarkdown(itemText));
        i += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length && !isBlank(lines[i])) {
      const peek = lines[i];
      if (
        /^```/.test(peek) ||
        /^(#{1,3})\s+/.test(peek) ||
        /^\s*>/.test(peek) ||
        parseListItemText(peek) !== null ||
        /^\s*---+\s*$/.test(peek)
      ) {
        break;
      }
      paraLines.push(peek);
      i += 1;
    }
    blocks.push({
      type: 'paragraph',
      children: parseInlineMarkdown(paraLines.join('\n')),
    });
  }

  return blocks;
}
