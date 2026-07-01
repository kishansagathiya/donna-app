import { getAccessToken } from './auth';
import { API_BASE_URL } from '../config';

export type NoteSearchResult = {
  id: string;
  title: string;
  preview: string;
  note_date: string;
  is_important: boolean;
  is_urgent: boolean;
  source_type: string;
};

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

export async function checkDailyNotes(): Promise<DailyBriefing> {
  const res = await authorizedFetch('/notes/daily-check', { method: 'POST' });
  const body = (await res.json()) as DailyBriefing & {
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(body.message ?? body.error ?? `Daily check failed (${res.status})`);
  }
  return body;
}

export async function searchNotes(query: string): Promise<NoteSearchResult[]> {
  const res = await authorizedFetch(
    `/notes/search?q=${encodeURIComponent(query.trim())}`,
  );
  const body = (await res.json()) as NoteSearchResult[] & {
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(body.message ?? body.error ?? `Search failed (${res.status})`);
  }
  return body;
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
