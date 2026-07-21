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
  content_version?: number;
  enrichment_status?: string;
  enrichment_version?: number;
  tags?: string[];
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
  items?: NoteTagDetail[];
};

export type NoteTagDetail = {
  tag: string;
  origin: string;
  locked: boolean;
};

export type TaxonomyTag = {
  name: string;
  count: number;
  normalized_name?: string;
  alias_of?: string | null;
  pinned: boolean;
};

export type TagSuggestion = {
  id: string;
  suggestion_kind: string;
  status: string;
  target_note_id?: string | null;
  payload: { tag?: string };
  confidence?: number | null;
};

export type NoteSearchResult = NoteSummary;

export type TagFacet = {
  tag: string;
  canonical: string;
  count: number;
  pinned: boolean;
  alias_of?: string | null;
};

export type NotesFeed = {
  items: NoteSummary[];
  next_cursor?: string;
  facets: { tags: TagFacet[] };
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

export type TagCount = {
  tag: string;
  count: number;
};

export class NotesApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'NotesApiError';
    this.status = status;
    this.code = code;
  }
}

async function parseNotesJSON<T>(res: Response): Promise<T> {
  let body: (T & { error?: string; message?: string }) | null = null;
  try {
    body = (await res.json()) as T & { error?: string; message?: string };
  } catch {
    throw new Error(
      res.ok
        ? 'Invalid response from Donna server'
        : `Request failed (${res.status})`,
    );
  }
  if (!res.ok) {
    throw new NotesApiError(
      res.status,
      body?.error ?? 'request_failed',
      body?.message ?? body?.error ?? `Request failed (${res.status})`,
    );
  }
  return body as T;
}

export async function checkDailyNotes(): Promise<DailyBriefing> {
  const res = await authorizedFetch('/notes/daily-check', { method: 'POST' });
  return parseJSON(res);
}

export async function listNotesFeed(params: {
  limit?: number;
  cursor?: string;
  q?: string;
  tag?: string;
  curated?: boolean;
} = {}): Promise<NotesFeed> {
  const qs = new URLSearchParams();
  qs.set('limit', String(params.limit ?? 50));
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.q?.trim()) qs.set('q', params.q.trim());
  if (params.tag?.trim()) qs.set('tag', params.tag.trim());
  if (params.curated !== undefined) qs.set('curated', String(params.curated));
  const res = await authorizedFetch(`/notes/feed?${qs.toString()}`);
  return parseNotesJSON(res);
}

/** Prefers the V2 feed; falls back to /notes/recent when the feed flag is off. */
export async function listNotesPage(params: {
  limit?: number;
  cursor?: string;
  offset?: number;
  tag?: string;
  q?: string;
  curated?: boolean;
} = {}): Promise<{ items: NoteSummary[]; nextCursor?: string; facets?: TagFacet[] }> {
  try {
    const feed = await listNotesFeed({
      limit: params.limit,
      cursor: params.cursor,
      tag: params.tag,
      q: params.q,
      curated: params.curated ?? true,
    });
    return {
      items: feed.items,
      nextCursor: feed.next_cursor,
      facets: feed.facets.tags,
    };
  } catch (err) {
    if (
      err instanceof NotesApiError &&
      (err.status === 404 || err.code === 'notes_feed_disabled')
    ) {
      const batch = await listRecentNotes(params.limit ?? 50, params.offset ?? 0);
      return {
        items: batch,
        nextCursor: batch.length === (params.limit ?? 50) ? 'offset' : undefined,
      };
    }
    throw err;
  }
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
  const res = await authorizedFetch(`/notes/${id}`);
  return parseJSON(res);
}

export async function updateNote(
  id: string,
  patch: {
    content?: string;
    note_date?: string;
    is_important?: boolean;
    is_urgent?: boolean;
    content_version?: number;
  },
): Promise<Note> {
  const res = await authorizedFetch(`/notes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return parseNotesJSON(res);
}

export async function deleteNote(id: string): Promise<void> {
  const res = await authorizedFetch(`/notes/${id}`, { method: 'DELETE' });
  await parseJSON(res);
}

export async function getNoteTags(id: string): Promise<NoteTags> {
  const res = await authorizedFetch(`/notes/${id}/tags`);
  return parseJSON(res);
}

export async function setNoteTags(id: string, tags: string[]): Promise<NoteTags> {
  const res = await authorizedFetch(`/notes/${id}/tags`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags }),
  });
  return parseJSON(res);
}

export async function listTaxonomy(limit = 100): Promise<TaxonomyTag[]> {
  const res = await authorizedFetch(`/notes/taxonomy?limit=${limit}`);
  return parseJSON(res);
}

export async function pinTag(tag: string, pinned: boolean): Promise<void> {
  const res = await authorizedFetch(`/notes/tags/pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag, pinned }),
  });
  await parseJSON(res);
}

export async function aliasTag(source: string, canonical: string): Promise<void> {
  const res = await authorizedFetch(`/notes/tags/alias`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, canonical }),
  });
  await parseJSON(res);
}

export async function renameTag(from: string, to: string): Promise<void> {
  const res = await authorizedFetch(`/notes/tags/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to }),
  });
  await parseJSON(res);
}

export async function mergeTags(source: string, canonical: string): Promise<void> {
  const res = await authorizedFetch(`/notes/tags/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, canonical }),
  });
  await parseJSON(res);
}

export async function listTagSuggestions(noteId?: string): Promise<TagSuggestion[]> {
  const qs = noteId ? `?note_id=${encodeURIComponent(noteId)}` : '';
  const res = await authorizedFetch(`/notes/tag-suggestions${qs}`);
  return parseJSON(res);
}

export async function resolveTagSuggestion(
  id: string,
  status: 'accepted' | 'rejected',
): Promise<void> {
  const res = await authorizedFetch(`/notes/tag-suggestions/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  await parseJSON(res);
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

/** Local datetime string for editable note dates (YYYY-MM-DDTHH:mm). */
export function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('invalid_note_date');
  }
  return date.toISOString();
}

export function tryFromDatetimeLocalValue(value: string): string | undefined {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}

export function newNoteId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0').slice(-12)}`;
}

export async function createNote(
  content: string,
  opts?: { noteDate?: string; id?: string },
): Promise<Note> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Note cannot be empty');
  }

  const res = await authorizedFetch('/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: opts?.id ?? newNoteId(),
      content: trimmed,
      note_date: opts?.noteDate,
    }),
  });
  return parseNotesJSON(res);
}
