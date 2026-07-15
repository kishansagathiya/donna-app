import { API_BASE_URL } from '../config';
import { getAccessToken } from './auth';

export type ConversationSummary = {
  id: string;
  channel: 'text' | 'voice';
  title: string;
  title_source?: 'auto' | 'llm' | 'user';
  client_session_id?: string;
  voice_session_id?: string;
  preview: string;
  turn_count: number;
  created_at: string;
  updated_at: string;
  ended_at?: string;
  archived_at?: string;
  pinned_at?: string;
  tags?: string[];
};

export type ConversationTurn = {
  turn_index: number;
  user_transcript: string;
  assistant_transcript: string;
  created_at: string;
};

export type ConversationDetail = {
  id: string;
  channel: 'text' | 'voice';
  title: string;
  title_source?: 'auto' | 'llm' | 'user';
  client_session_id?: string;
  voice_session_id?: string;
  created_at: string;
  ended_at?: string;
  archived_at?: string;
  pinned_at?: string;
  tags?: string[];
  turns: ConversationTurn[];
};

export type ListConversationsOptions = {
  limit?: number;
  q?: string;
  tag?: string;
  includeArchived?: boolean;
  archivedOnly?: boolean;
};

export type PatchConversationInput = {
  title?: string;
  archived?: boolean;
  pinned?: boolean;
  tags?: string[];
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
    throw new Error(
      body.message ?? body.error ?? `Request failed (${res.status})`,
    );
  }
  return body;
}

export async function listConversations(
  options: ListConversationsOptions | number = 50,
): Promise<ConversationSummary[]> {
  const opts: ListConversationsOptions =
    typeof options === 'number' ? { limit: options } : options;
  const params = new URLSearchParams();
  params.set('limit', String(opts.limit ?? 50));
  if (opts.q?.trim()) params.set('q', opts.q.trim());
  if (opts.tag?.trim()) params.set('tag', opts.tag.trim());
  if (opts.includeArchived) params.set('include_archived', 'true');
  if (opts.archivedOnly) params.set('archived_only', 'true');

  const res = await authorizedFetch(`/conversations?${params.toString()}`);
  const body = await parseJSON<{ conversations: ConversationSummary[] }>(res);
  return body.conversations ?? [];
}

export async function listConversationTags(limit = 50): Promise<string[]> {
  const res = await authorizedFetch(`/conversations/tags?limit=${limit}`);
  const body = await parseJSON<{ tags: string[] }>(res);
  return body.tags ?? [];
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  const res = await authorizedFetch(`/conversations/${id}`);
  return parseJSON(res);
}

export async function patchConversation(
  id: string,
  input: PatchConversationInput,
): Promise<ConversationSummary> {
  const res = await authorizedFetch(
    `/conversations/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  return parseJSON(res);
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await authorizedFetch(
    `/conversations/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
  await parseJSON<{ ok: boolean }>(res);
}

export async function truncateConversationTurns(
  clientSessionId: string,
  fromIndex: number,
): Promise<void> {
  const sessionId = encodeURIComponent(clientSessionId);
  const res = await authorizedFetch(
    `/conversations/session/${sessionId}/turns?from_index=${fromIndex}`,
    { method: 'DELETE' },
  );
  await parseJSON<{ ok: boolean }>(res);
}

export async function submitTurnFeedback(
  clientSessionId: string,
  turnIndex: number,
  rating: 'up' | 'down',
  comment = '',
): Promise<void> {
  const sessionId = encodeURIComponent(clientSessionId);
  const res = await authorizedFetch(
    `/conversations/session/${sessionId}/turns/${turnIndex}/feedback`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, comment }),
    },
  );
  await parseJSON<{ ok: boolean }>(res);
}

export function formatConversationDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function turnsToChatTurns(
  turns: ConversationTurn[],
): { user: string; assistant: string | null }[] {
  const result: { user: string; assistant: string | null }[] = [];

  for (const turn of turns) {
    const user = turn.user_transcript.trim();
    const assistant = turn.assistant_transcript.trim();
    if (user || assistant) {
      result.push({
        user,
        assistant: assistant || null,
      });
    }
  }

  return result;
}
