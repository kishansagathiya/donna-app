import { getAccessToken, signOut } from './auth';
import { revokeAiDataConsent } from './privacyConsent';
import { API_BASE_URL } from '../config';

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

export async function deleteAccount(): Promise<void> {
  const res = await authorizedFetch('/account', { method: 'DELETE' });
  const body = (await res.json()) as { error?: string; message?: string };

  if (!res.ok) {
    throw new Error(body.message ?? body.error ?? `Delete failed (${res.status})`);
  }

  await revokeAiDataConsent();
  await signOut();
}
