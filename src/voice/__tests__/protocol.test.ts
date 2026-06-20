import { parseServerMessage, type ServerMessage } from '../protocol';

describe('parseServerMessage', () => {
  it('parses session.ready', () => {
    const msg = parseServerMessage(
      JSON.stringify({
        type: 'session.ready',
        sessionId: 'sess-1',
        userId: 'user-1',
      }),
    );
    expect(msg.type).toBe('session.ready');
    expect((msg as Extract<ServerMessage, { type: 'session.ready' }>).sessionId).toBe(
      'sess-1',
    );
  });

  it('parses turn.phase', () => {
    const msg = parseServerMessage(
      JSON.stringify({ type: 'turn.phase', phase: 'generating' }),
    );
    expect(msg.type).toBe('turn.phase');
    expect((msg as Extract<ServerMessage, { type: 'turn.phase' }>).phase).toBe(
      'generating',
    );
  });

  it('parses error messages', () => {
    const msg = parseServerMessage(
      JSON.stringify({ type: 'error', code: 'turn_failed', message: 'boom' }),
    );
    expect(msg.type).toBe('error');
    expect((msg as Extract<ServerMessage, { type: 'error' }>).code).toBe(
      'turn_failed',
    );
  });

  it('throws on malformed JSON', () => {
    expect(() => parseServerMessage('not-json')).toThrow();
  });
});
