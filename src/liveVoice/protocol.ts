export type LiveClientMessage =
  | { type: 'session.start' }
  | { type: 'audio.chunk'; data: string }
  | { type: 'session.end' };

export type LiveServerMessage =
  | { type: 'session.ready'; sessionId?: string }
  | {
      type: 'audio.chunk';
      data: string;
      sampleRate?: number;
      channels?: number;
    }
  | {
      type: 'transcript';
      role: 'user' | 'assistant';
      text: string;
      final?: boolean;
    }
  | { type: 'interrupted' }
  | { type: 'error'; message: string }
  | { type: 'session.ended' };

export function parseLiveServerMessage(raw: string): LiveServerMessage | null {
  try {
    const msg = JSON.parse(raw) as LiveServerMessage;
    if (!msg || typeof msg !== 'object' || !('type' in msg)) return null;
    return msg;
  } catch {
    return null;
  }
}
