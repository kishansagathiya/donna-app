import type { NoteSummary } from '../services/notesApi';

export function sourceLabel(sourceType: string | undefined): string | null {
  switch (sourceType) {
    case 'manual':
      return null;
    case 'integration':
      return 'Granola';
    case 'document':
      return 'Document';
    case 'voice_turn':
      return 'Voice';
    case 'conversation_excerpt':
      return 'Chat';
    default:
      return sourceType ? sourceType.replace(/_/g, ' ') : null;
  }
}

export function enrichmentLabel(
  status: string | undefined,
): { label: string; tone: 'muted' | 'warn' | 'ok' | 'error' } | null {
  switch (status) {
    case 'queued':
    case 'pending':
      return { label: 'Queued', tone: 'muted' };
    case 'running':
      return { label: 'Organizing…', tone: 'warn' };
    case 'succeeded':
    case 'idle':
    case undefined:
    case '':
      return null;
    case 'failed':
      return { label: 'Organize failed', tone: 'error' };
    default:
      return { label: status, tone: 'muted' };
  }
}

export function noteTagList(note: NoteSummary): string[] {
  if (note.tags?.length) return note.tags;
  return [];
}
