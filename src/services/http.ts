import { getAccessToken } from './auth';
import { reportError } from './errorReporting';
import { API_BASE_URL } from '../config';

const DONNA_CLIENT_HEADER = 'X-Donna-Client';

function isNetworkRequestFailed(err: unknown): boolean {
  return (
    err instanceof TypeError ||
    (err instanceof Error && /network request failed/i.test(err.message))
  );
}

function canRetryWithXhr(init: RequestInit): boolean {
  const body = init.body;
  return body == null || typeof body === 'string';
}

function headerRecord(headers: RequestInit['headers']): Record<string, string> {
  if (!headers) {
    return {};
  }
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...(headers as Record<string, string>) };
}

/** XHR transport — chat SSE already uses this because RN fetch fails on some iOS builds. */
export function xhrRequest(url: string, init: RequestInit = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open((init.method ?? 'GET').toUpperCase(), url, true);

    const headers = headerRecord(init.headers);
    for (const [key, value] of Object.entries(headers)) {
      if (value != null) {
        xhr.setRequestHeader(key, String(value));
      }
    }

    xhr.onload = () => {
      resolve(
        new Response(xhr.responseText, {
          status: xhr.status || 0,
          statusText: xhr.statusText,
        }),
      );
    };
    xhr.onerror = () => {
      reject(new TypeError('Network request failed'));
    };
    xhr.ontimeout = () => {
      reject(new TypeError('Network request failed'));
    };

    const body = init.body;
    xhr.send(typeof body === 'string' ? body : null);
  });
}

async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    if (!isNetworkRequestFailed(err) || !canRetryWithXhr(init)) {
      throw err;
    }
    return await xhrRequest(url, init);
  }
}

function wrapNetworkError(err: unknown): Error {
  const detail =
    err instanceof Error ? err.message : 'Could not reach Donna server';
  return new Error(
    `${detail} (${API_BASE_URL}). Check your connection and try again.`,
  );
}

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
    ...headerRecord(init.headers),
  };

  if (options?.webClient) {
    headers[DONNA_CLIENT_HEADER] = 'web';
  }

  const url = `${API_BASE_URL}${path}`;

  try {
    return await request(url, {
      ...init,
      headers,
    });
  } catch (err) {
    reportError(err, { path });
    throw wrapNetworkError(err);
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
