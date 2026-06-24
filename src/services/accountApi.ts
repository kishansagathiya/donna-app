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

export type AccountPreferences = {
  llm_model: string;
  available_models: string[];
};

export async function getAccountPreferences(): Promise<AccountPreferences> {
  const res = await authorizedFetch('/account');
  const body = (await res.json()) as AccountPreferences & {
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(body.message ?? body.error ?? `Load failed (${res.status})`);
  }
  return body;
}

export async function updateLLMModel(llmModel: string): Promise<void> {
  const res = await authorizedFetch('/account', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ llm_model: llmModel }),
  });
  const body = (await res.json()) as { error?: string; message?: string };
  if (!res.ok) {
    throw new Error(body.message ?? body.error ?? `Save failed (${res.status})`);
  }
}
