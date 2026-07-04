import { getAccessToken } from './auth';
import { API_BASE_URL } from '../config';

const DONNA_CLIENT_HEADER = 'X-Donna-Client';

export async function authorizedFetch(
  path: string,
  init: RequestInit = {},
  options?: { webClient?: boolean },
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not signed in');
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };

  if (options?.webClient) {
    headers[DONNA_CLIENT_HEADER] = 'web';
  }

  const url = `${API_BASE_URL}${path}`;

  try {
    return await fetch(url, {
      ...init,
      headers,
    });
  } catch (err) {
    const detail =
      err instanceof Error ? err.message : 'Could not reach Donna server';
    throw new Error(
      `${detail} (${API_BASE_URL}). Check your connection and try again.`,
    );
  }
}

export async function parseJSON<T>(res: Response): Promise<T> {
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
    throw new Error(
      body?.message ?? body?.error ?? `Request failed (${res.status})`,
    );
  }

  return body as T;
}
