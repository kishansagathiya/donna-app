import { getAccessToken } from './auth';
import { API_BASE_URL } from '../config';

export type UserProfile = {
  user_id: string;
  summary: string;
  identity_facts: string[];
  updated_at?: string;
};

export type MemoryEvidence = {
  id?: string;
  user_id?: string;
  fact_id?: string;
  source_kind: string;
  source_id?: string | null;
  excerpt: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
};

export type MemoryFact = {
  id: string;
  user_id: string;
  fact: string;
  entity_name: string | null;
  topic: string | null;
  source_id: string | null;
  active: boolean;
  created_at?: string;
  memory_kind?: string | null;
  predicate?: string | null;
  confidence?: number | null;
  sensitivity?: string;
  review_status?: string;
  valid_from?: string | null;
  valid_until?: string | null;
};

export type MemoryItem = MemoryFact & {
  evidence?: MemoryEvidence[];
  conflicting?: boolean;
  suggestion_id?: string | null;
};

export type MemoryGroup = {
  kind: string;
  label: string;
  items: MemoryItem[];
};

export type MemoryListStatus =
  | 'active'
  | 'pending'
  | 'sensitive'
  | 'conflicting'
  | 'rejected'
  | 'outdated';

export type CitationFeedbackAction =
  | 'not_relevant'
  | 'outdated'
  | 'confirm'
  | 'reject';

async function authorizedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not signed in');
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...((init.headers as Record<string, string> | undefined) ?? {}),
    },
  });
}

async function parseJSON<T>(res: Response): Promise<T> {
  const body = (await res.json()) as T & { error?: string; message?: string };
  if (!res.ok) {
    throw new Error(body.message ?? body.error ?? `Request failed (${res.status})`);
  }
  return body;
}

export async function getMemoryProfile(): Promise<UserProfile> {
  const res = await authorizedFetch('/memory/profile');
  return parseJSON(res);
}

export async function updateMemoryProfile(patch: {
  summary?: string;
  identity_facts?: string[];
}): Promise<UserProfile> {
  const res = await authorizedFetch('/memory/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return parseJSON(res);
}

export async function listMemoryFacts(
  query = '',
  limit = 100,
): Promise<MemoryFact[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const trimmed = query.trim();
  if (trimmed) {
    params.set('q', trimmed);
  }
  const res = await authorizedFetch(`/memory/facts?${params}`);
  return parseJSON(res);
}

export async function createMemoryFact(input: {
  fact: string;
  entity_name?: string;
  topic?: string;
}): Promise<MemoryFact> {
  const res = await authorizedFetch('/memory/facts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJSON(res);
}

export async function updateMemoryFact(
  id: string,
  patch: { fact: string; entity_name?: string; topic?: string },
): Promise<MemoryFact> {
  const res = await authorizedFetch(`/memory/facts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return parseJSON(res);
}

export async function deleteMemoryFact(id: string): Promise<void> {
  const res = await authorizedFetch(`/memory/facts/${id}`, {
    method: 'DELETE',
  });
  await parseJSON(res);
}

export async function listMemoryItems(opts: {
  status?: MemoryListStatus;
  kind?: string;
  q?: string;
  limit?: number;
} = {}): Promise<MemoryItem[]> {
  const params = new URLSearchParams();
  params.set('status', opts.status ?? 'active');
  if (opts.kind) params.set('kind', opts.kind);
  if (opts.q?.trim()) params.set('q', opts.q.trim());
  if (opts.limit) params.set('limit', String(opts.limit));
  const res = await authorizedFetch(`/memory/items?${params}`);
  return parseJSON(res);
}

export async function listMemoryGrouped(query = ''): Promise<MemoryGroup[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  const qs = params.toString();
  const res = await authorizedFetch(
    `/memory/items/grouped${qs ? `?${qs}` : ''}`,
  );
  const body = await parseJSON<{ groups: MemoryGroup[] }>(res);
  return body.groups ?? [];
}

export async function updateMemoryItem(
  id: string,
  patch: { fact?: string; memory_kind?: string },
): Promise<MemoryItem> {
  const res = await authorizedFetch(`/memory/items/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return parseJSON(res);
}

export async function acceptMemoryItem(id: string): Promise<MemoryItem> {
  const res = await authorizedFetch(`/memory/items/${id}/accept`, {
    method: 'POST',
  });
  return parseJSON(res);
}

export async function rejectMemoryItem(id: string): Promise<MemoryItem> {
  const res = await authorizedFetch(`/memory/items/${id}/reject`, {
    method: 'POST',
  });
  return parseJSON(res);
}

export async function markMemoryOutdated(id: string): Promise<MemoryItem> {
  const res = await authorizedFetch(`/memory/items/${id}/outdated`, {
    method: 'POST',
  });
  return parseJSON(res);
}

export async function resolveMemoryItem(
  id: string,
  decision: 'keep_existing' | 'accept_new',
  fact?: string,
): Promise<MemoryItem | { status: string }> {
  const res = await authorizedFetch(`/memory/items/${id}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, fact }),
  });
  return parseJSON(res);
}

export async function deleteMemoryItem(id: string): Promise<void> {
  const res = await authorizedFetch(`/memory/items/${id}`, {
    method: 'DELETE',
  });
  await parseJSON(res);
}

export async function listDerivedMemories(noteId: string): Promise<MemoryItem[]> {
  const res = await authorizedFetch(`/memory/notes/${noteId}/derived`);
  return parseJSON(res);
}

export async function acceptMemorySuggestion(id: string): Promise<MemoryItem> {
  const res = await authorizedFetch(`/memory/suggestions/${id}/accept`, {
    method: 'POST',
  });
  return parseJSON(res);
}

export async function rejectMemorySuggestion(id: string): Promise<void> {
  const res = await authorizedFetch(`/memory/suggestions/${id}/reject`, {
    method: 'POST',
  });
  await parseJSON(res);
}

export async function resolveMemorySuggestion(
  id: string,
  decision: 'keep_existing' | 'accept_new',
  fact?: string,
): Promise<MemoryItem | { status: string }> {
  const res = await authorizedFetch(`/memory/suggestions/${id}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, fact }),
  });
  return parseJSON(res);
}

export async function postMemoryFeedback(input: {
  fact_id?: string;
  suggestion_id?: string;
  action: CitationFeedbackAction;
  details?: Record<string, unknown>;
}): Promise<unknown> {
  const res = await authorizedFetch('/memory/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJSON(res);
}

export function isSuggestionItem(item: MemoryItem): boolean {
  return Boolean(item.suggestion_id) || item.id.startsWith('suggestion:');
}

export function suggestionIdOf(item: MemoryItem): string | null {
  if (item.suggestion_id) return item.suggestion_id;
  if (item.id.startsWith('suggestion:')) {
    return item.id.slice('suggestion:'.length);
  }
  return null;
}

export function formatFactDate(iso?: string): string {
  if (!iso) {
    return '';
  }
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
