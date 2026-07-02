import { getAccessToken } from './auth';
import { API_BASE_URL } from '../config';
import { sendChatMessage } from './chatApi';

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

async function authorizedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not signed in');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });
}

async function parseJSON<T>(res: Response): Promise<T> {
  const body = (await res.json()) as T & { error?: string; message?: string };
  if (!res.ok) {
    throw new Error(body.message ?? body.error ?? `Request failed (${res.status})`);
  }
  return body;
}

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

export async function updateNote(
  id: string,
  patch: {
    content?: string;
    note_date?: string;
    is_important?: boolean;
    is_urgent?: boolean;
  },
): Promise<NoteSummary> {
  const res = await authorizedFetch(`/notes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return parseJSON(res);
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
