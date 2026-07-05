import { sendChatMessage } from './chatApi';
import { authorizedFetch, parseJSON } from './http';

export type NoteSummary = {
  id: string;
  title: string;
  preview: string;
  note_date: string;
  is_important: boolean;
  is_urgent: boolean;
  source_type: string;
  keywords: string[] | null;
  category: string | null;
  has_audio: boolean;
};

export type Note = NoteSummary & {
  user_id: string;
  source_id: string | null;
  content: string;
  user_last_modified: string | null;
  created_at: string;
  updated_at: string;
  audio_url?: string;
};

export type NoteTags = {
  note_id: string;
  tags: string[];
};

export type NoteSearchResult = NoteSummary;

export type DailyTask = {
  note_id: string;
  title: string;
  preview: string;
  priority: string;
  reason: string;
  is_urgent: boolean;
  is_important: boolean;
};

export type OutdatedNote = {
  note_id: string;
  title: string;
  preview: string;
  reason: string;
};

export type DailyBriefing = {
  date: string;
  summary: string;
  tasks: DailyTask[];
  outdated: OutdatedNote[];
};

export type TagCount = {
  tag: string;
  count: number;
};

export async function checkDailyNotes(): Promise<DailyBriefing> {
  const res = await authorizedFetch('/notes/daily-check', { method: 'POST' });
  return parseJSON(res);
}

export async function listRecentNotes(
  limit = 50,
  offset = 0,
): Promise<NoteSummary[]> {
  const res = await authorizedFetch(
    `/notes/recent?limit=${limit}&offset=${offset}`,
  );
  return parseJSON(res);
}

export async function listTags(limit = 30): Promise<TagCount[]> {
  const res = await authorizedFetch(`/notes/tags?limit=${limit}`);
  return parseJSON(res);
}

export async function listNotesForTag(
  tag: string,
  limit = 50,
): Promise<NoteSummary[]> {
  const res = await authorizedFetch(
    `/notes/tags/${encodeURIComponent(tag.trim().toLowerCase())}?limit=${limit}`,
  );
  return parseJSON(res);
}

export async function getNote(id: string): Promise<Note> {
  const res = await authorizedFetch(`/notes/${id}`, {}, { webClient: true });
  return parseJSON(res);
}

export async function updateNote(
  id: string,
  patch: {
    content?: string;
    note_date?: string;
    is_important?: boolean;
    is_urgent?: boolean;
  },
): Promise<Note> {
  const res = await authorizedFetch(`/notes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return parseJSON(res);
}

export async function deleteNote(id: string): Promise<void> {
  const res = await authorizedFetch(
    `/notes/${id}`,
    { method: 'DELETE' },
    { webClient: true },
  );
  await parseJSON(res);
}

export async function getNoteTags(id: string): Promise<NoteTags> {
  const res = await authorizedFetch(`/notes/${id}/tags`, {}, { webClient: true });
  return parseJSON(res);
}

export async function setNoteTags(id: string, tags: string[]): Promise<NoteTags> {
  const res = await authorizedFetch(
    `/notes/${id}/tags`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    },
    { webClient: true },
  );
  return parseJSON(res);
}

export function extractHashtags(text: string): string[] {
  const matches =
    text.match(/(?:^|\s)#([A-Za-z0-9][A-Za-z0-9_-]{0,40})/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    const tag = m.replace(/(?:^|\s)#/, '').trim().toLowerCase();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  }
  return out;
}

export async function searchNotes(query: string): Promise<NoteSearchResult[]> {
  const res = await authorizedFetch(
    `/notes/search?q=${encodeURIComponent(query.trim())}`,
  );
  return parseJSON(res);
}

export function formatNoteDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function noteSummaryFromContent(content: string): NoteSummary {
  const trimmed = content.trim();
  const firstLine = trimmed.split('\n').find(line => line.trim())?.trim() ?? '';
  const title = firstLine.slice(0, 80) || 'Untitled';
  const previewStart = trimmed.indexOf(firstLine) + firstLine.length;
  const preview = trimmed.slice(previewStart).trim().slice(0, 200);

  return {
    id: `pending-${Date.now()}`,
    title,
    preview,
    note_date: new Date().toISOString(),
    is_important: false,
    is_urgent: false,
    source_type: 'manual',
    keywords: null,
    category: null,
    has_audio: false,
  };
}

export async function createNote(content: string): Promise<NoteSummary> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Note cannot be empty');
  }

  await sendChatMessage({ message: trimmed, mode: 'notes' });
  return noteSummaryFromContent(trimmed);
}
