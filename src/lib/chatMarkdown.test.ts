import {
  parseInlineMarkdown,
  parseMarkdownBlocks,
} from './chatMarkdown';

describe('parseInlineMarkdown', () => {
  it('renders bold, italic, and links', () => {
    const nodes = parseInlineMarkdown(
      'Read **The Hobbit** and *On Fairy-Stories* ([link](https://example.com)).',
    );

    expect(nodes).toEqual([
      { text: 'Read ', marks: {} },
      { text: 'The Hobbit', marks: { bold: true } },
      { text: ' and ', marks: {} },
      { text: 'On Fairy-Stories', marks: { italic: true } },
      { text: ' (', marks: {} },
      {
        text: 'link',
        marks: { linkHref: 'https://example.com', bold: true },
      },
      { text: ').', marks: {} },
    ]);
  });

  it('keeps plain text unchanged', () => {
    expect(parseInlineMarkdown('Hello Donna')).toEqual([
      { text: 'Hello Donna', marks: {} },
    ]);
  });
});

describe('parseMarkdownBlocks', () => {
  it('parses paragraphs, lists, and headings', () => {
    const blocks = parseMarkdownBlocks(
      [
        '## Start here',
        '',
        'Begin with **The Hobbit**.',
        '',
        '- One',
        '- Two',
      ].join('\n'),
    );

    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 2 });
    expect(blocks[1]).toMatchObject({ type: 'paragraph' });
    expect(blocks[2]).toMatchObject({
      type: 'list',
      ordered: false,
    });
    if (blocks[2].type === 'list') {
      expect(blocks[2].items).toHaveLength(2);
    }
  });
});
