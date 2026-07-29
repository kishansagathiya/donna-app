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

/** Soft grey shades so each note card reads as its own tile. */
const NOTE_CARD_GREYS = [
  '#F3F3F3',
  '#EBEBEB',
  '#E4E4E4',
  '#F0F0F0',
  '#E8E8E8',
  '#DEDEDE',
  '#F6F6F6',
  '#E1E1E1',
] as const;

/** Stable grey background for a note card, derived from its id. */
export function noteCardGrey(noteId: string): string {
  let hash = 0;
  for (let i = 0; i < noteId.length; i++) {
    hash = (hash * 31 + noteId.charCodeAt(i)) >>> 0;
  }
  return NOTE_CARD_GREYS[hash % NOTE_CARD_GREYS.length];
}
