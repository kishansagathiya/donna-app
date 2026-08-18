import {
  firstHttpURL,
  normalizeIncomingShares,
  planSharedIngest,
} from '../src/lib/incomingShare';

describe('normalizeIncomingShares', () => {
  it('returns empty for missing payloads', () => {
    expect(normalizeIncomingShares(null)).toEqual([]);
    expect(normalizeIncomingShares(undefined)).toEqual([]);
    expect(normalizeIncomingShares({})).toEqual([]);
    expect(normalizeIncomingShares({ data: null })).toEqual([]);
  });

  it('accepts the Android single-item shape', () => {
    expect(
      normalizeIncomingShares({
        mimeType: 'text/plain',
        data: 'https://example.com/a',
      }),
    ).toEqual([
      { mimeType: 'text/plain', data: 'https://example.com/a', extraData: null },
    ]);
  });

  it('accepts the iOS multi-item shape', () => {
    expect(
      normalizeIncomingShares({
        data: [
          { mimeType: 'text/plain', data: 'Page title' },
          { mimeType: 'text/plain', data: 'https://example.com/a' },
        ],
      }),
    ).toEqual([
      { mimeType: 'text/plain', data: 'Page title', extraData: null },
      { mimeType: 'text/plain', data: 'https://example.com/a', extraData: null },
    ]);
  });

  it('flattens Android SEND_MULTIPLE string arrays', () => {
    expect(
      normalizeIncomingShares({
        mimeType: 'image/jpeg',
        data: ['file:///tmp/a.jpg', 'file:///tmp/b.jpg'],
      }),
    ).toEqual([
      { mimeType: 'image/jpeg', data: 'file:///tmp/a.jpg', extraData: null },
      { mimeType: 'image/jpeg', data: 'file:///tmp/b.jpg', extraData: null },
    ]);
  });
});

describe('planSharedIngest', () => {
  it('saves a bare URL as a link note', () => {
    expect(
      planSharedIngest([
        { mimeType: 'text/plain', data: 'https://example.com/article' },
      ]),
    ).toEqual([{ kind: 'url', url: 'https://example.com/article' }]);
  });

  it('treats a Safari title + URL share as one link', () => {
    expect(
      planSharedIngest([
        { mimeType: 'text/plain', data: 'Interesting article' },
        { mimeType: 'text/plain', data: 'https://example.com/article' },
      ]),
    ).toEqual([{ kind: 'url', url: 'https://example.com/article' }]);
  });

  it('keeps selected text that includes a URL as a note', () => {
    expect(
      planSharedIngest([
        {
          mimeType: 'text/plain',
          data: 'Remember this for the Lisbon trip: https://example.com/rooftop and book Friday',
        },
      ]),
    ).toEqual([
      {
        kind: 'text',
        title: 'Shared note',
        text: 'Remember this for the Lisbon trip: https://example.com/rooftop and book Friday',
      },
    ]);
  });

  it('saves plain text as a note', () => {
    expect(
      planSharedIngest([{ mimeType: 'text/plain', data: 'buy oat milk' }]),
    ).toEqual([{ kind: 'text', text: 'buy oat milk', title: 'Shared note' }]);
  });

  it('saves images as files', () => {
    expect(
      planSharedIngest([
        {
          mimeType: 'image/jpeg',
          data: 'file:///group/photo.jpg',
        },
      ]),
    ).toEqual([
      {
        kind: 'file',
        uri: 'file:///group/photo.jpg',
        name: 'photo.jpg',
        type: 'image/jpeg',
      },
    ]);
  });
});

describe('firstHttpURL', () => {
  it('strips trailing punctuation', () => {
    expect(firstHttpURL('see https://example.com/a.')).toBe(
      'https://example.com/a',
    );
  });
});
