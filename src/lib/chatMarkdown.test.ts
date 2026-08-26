import {
  isDisplayableImageSrc,
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

  it('parses markdown images', () => {
    expect(parseInlineMarkdown('![cat](https://example.com/cat.png)')).toEqual([
      {
        text: 'cat',
        marks: {},
        image: { alt: 'cat', src: 'https://example.com/cat.png' },
      },
    ]);
  });
});

describe('isDisplayableImageSrc', () => {
  it('allows http(s) and rejects other schemes', () => {
    expect(isDisplayableImageSrc('https://example.com/a.png')).toBe(true);
    expect(isDisplayableImageSrc('http://example.com/a.png')).toBe(true);
    expect(isDisplayableImageSrc('javascript:alert(1)')).toBe(false);
    expect(isDisplayableImageSrc('data:image/png;base64,aaa')).toBe(false);
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

  it('parses GFM tables with bold cells and alignment', () => {
    const blocks = parseMarkdownBlocks(
      [
        'By Use Case',
        '',
        '| Use case | Model | Notes |',
        '| ---: | :---: | --- |',
        '| **Coding** | Claude Fable 5 | Fast |',
        '| *Writing* | GPT-5.4 | Clear |',
      ].join('\n'),
    );

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: 'paragraph' });
    expect(blocks[1]).toMatchObject({ type: 'table' });
    if (blocks[1].type !== 'table') {
      throw new Error('expected table block');
    }
    expect(blocks[1].header).toHaveLength(3);
    expect(blocks[1].header[0].align).toBe('right');
    expect(blocks[1].header[1].align).toBe('center');
    expect(blocks[1].header[2].align).toBeNull();
    expect(blocks[1].rows).toHaveLength(2);
    expect(blocks[1].rows[0][0].children).toEqual([
      { text: 'Coding', marks: { bold: true } },
    ]);
    expect(blocks[1].rows[1][0].children).toEqual([
      { text: 'Writing', marks: { italic: true } },
    ]);
    expect(blocks[1].rows[0][1].children[0].text).toBe('Claude Fable 5');
  });

  it('parses markdown images as blocks', () => {
    const blocks = parseMarkdownBlocks(
      [
        'Here is the bridge:',
        '',
        '![Golden Gate Bridge](https://example.com/ggb.jpg)',
      ].join('\n'),
    );

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: 'paragraph' });
    expect(blocks[1]).toEqual({
      type: 'image',
      alt: 'Golden Gate Bridge',
      src: 'https://example.com/ggb.jpg',
    });
  });

  it('splits inline images out of paragraphs', () => {
    const blocks = parseMarkdownBlocks(
      'Before ![cat](https://example.com/cat.png) after',
    );
    expect(blocks).toEqual([
      {
        type: 'paragraph',
        children: [{ text: 'Before ', marks: {} }],
      },
      {
        type: 'image',
        alt: 'cat',
        src: 'https://example.com/cat.png',
      },
      {
        type: 'paragraph',
        children: [{ text: ' after', marks: {} }],
      },
    ]);
  });
});
