import { getAccessToken, signOut } from './auth';
import { revokeAiDataConsent } from './privacyConsent';
import { API_BASE_URL } from '../config';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Platform, Share } from 'react-native';

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
  persona: string;
  persona_custom: string;
  available_personas: string[] | null;
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

export async function updatePersona(
  persona: string,
  personaCustom?: string,
): Promise<void> {
  const payload: Record<string, string> = { persona };
  if (personaCustom !== undefined) {
    payload.persona_custom = personaCustom;
  }
  const res = await authorizedFetch('/account', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as { error?: string; message?: string };
  if (!res.ok) {
    throw new Error(body.message ?? body.error ?? `Save failed (${res.status})`);
  }
}

export async function downloadAccountExport(): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not signed in');
  }

  const date = new Date().toISOString().slice(0, 10);
  const filename = `donna-export-${date}.zip`;
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}`;

  const res = await ReactNativeBlobUtil.config({
    path,
    fileCache: true,
  }).fetch('GET', `${API_BASE_URL}/account/export`, {
    Authorization: `Bearer ${token}`,
  });

  const status = res.info().status;
  if (status !== 200) {
    let message = `Export failed (${status})`;
    try {
      const body = JSON.parse(await res.text()) as {
        error?: string;
        message?: string;
      };
      message = body.message ?? body.error ?? message;
    } catch {
      // Successful exports are ZIP, not JSON.
    }
    throw new Error(message);
  }

  const fileUrl = Platform.OS === 'ios' ? path : `file://${path}`;
  await Share.share({ url: fileUrl, title: filename });
}
