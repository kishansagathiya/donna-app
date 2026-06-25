import { getAccessToken } from './auth';
import { API_BASE_URL } from '../config';

export type UserProfile = {
  user_id: string;
  summary: string;
  identity_facts: string[];
  updated_at?: string;
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
};

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
