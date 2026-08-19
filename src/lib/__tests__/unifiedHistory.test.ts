import {
  historyKindLabel,
  matchesHistoryQuery,
  mergeHistoryItems,
  type HistoryAgentRun,
  type HistoryConversation,
} from '../unifiedHistory';

function chat(
  partial: Partial<HistoryConversation> & Pick<HistoryConversation, 'id'>,
): HistoryConversation {
  return {
    title: partial.title ?? partial.id,
    preview: partial.preview ?? '',
    updated_at: partial.updated_at ?? '2026-08-20T12:00:00.000Z',
    pinned_at: partial.pinned_at,
    tags: partial.tags,
    channel: partial.channel ?? 'text',
    ...partial,
  };
}

function run(
  partial: Partial<HistoryAgentRun> & Pick<HistoryAgentRun, 'id'>,
): HistoryAgentRun {
  return {
    goal: partial.goal ?? partial.id,
    status: partial.status ?? 'succeeded',
    updated_at: partial.updated_at ?? '2026-08-20T12:00:00.000Z',
    step_count: partial.step_count ?? 1,
    ...partial,
  };
}

describe('mergeHistoryItems', () => {
  it('sorts by updated_at descending and keeps pinned chats first', () => {
    const items = mergeHistoryItems(
      [
        chat({
          id: 'c-old',
          title: 'Old chat',
          updated_at: '2026-08-01T00:00:00.000Z',
        }),
        chat({
          id: 'c-pin',
          title: 'Pinned',
          updated_at: '2026-08-01T00:00:00.000Z',
          pinned_at: '2026-08-01T00:00:00.000Z',
        }),
      ],
      [
        run({
          id: 'a-new',
          goal: 'Book flights',
          updated_at: '2026-08-20T00:00:00.000Z',
        }),
      ],
    );

    expect(items.map(item => item.id)).toEqual(['c-pin', 'a-new', 'c-old']);
    expect(items[0]?.kind).toBe('chat');
    expect(items[1]?.kind).toBe('agent');
  });

  it('drops pending agent runs', () => {
    const items = mergeHistoryItems(
      [],
      [run({ id: '__pending__', goal: 'Starting…' }), run({ id: 'a-1' })],
    );
    expect(items.map(item => item.id)).toEqual(['a-1']);
  });
});

describe('matchesHistoryQuery', () => {
  it('matches chat title, preview, and tags', () => {
    const item = mergeHistoryItems(
      [
        chat({
          id: 'c1',
          title: 'Q2 planning',
          preview: 'budget notes',
          tags: ['work'],
        }),
      ],
      [],
    )[0]!;
    expect(matchesHistoryQuery(item, 'planning')).toBe(true);
    expect(matchesHistoryQuery(item, 'budget')).toBe(true);
    expect(matchesHistoryQuery(item, 'work')).toBe(true);
    expect(matchesHistoryQuery(item, 'flights')).toBe(false);
  });

  it('matches agent goal and status aliases', () => {
    const item = mergeHistoryItems(
      [],
      [run({ id: 'a1', goal: 'File taxes', status: 'waiting_for_user' })],
    )[0]!;
    expect(matchesHistoryQuery(item, 'taxes')).toBe(true);
    expect(matchesHistoryQuery(item, 'needs reply')).toBe(true);
    expect(matchesHistoryQuery(item, 'chat')).toBe(false);
  });
});

describe('historyKindLabel', () => {
  it('labels chat, voice, and agent items', () => {
    const [voice, text, agent] = mergeHistoryItems(
      [
        chat({ id: 'v', channel: 'voice', updated_at: '2026-08-20T12:00:00.000Z' }),
        chat({ id: 't', channel: 'text', updated_at: '2026-08-20T11:00:00.000Z' }),
      ],
      [run({ id: 'a', updated_at: '2026-08-20T10:00:00.000Z' })],
    );
    expect(historyKindLabel(voice!)).toBe('Voice');
    expect(historyKindLabel(text!)).toBe('Chat');
    expect(historyKindLabel(agent!)).toBe('Agent');
  });
});
