import { getAccessToken } from './auth';
import { API_BASE_URL } from '../config';

export type IngestResult = {
  source_id: string;
  status: string;
  asset_kind: string;
  title: string | null;
};

export type IngestFile = {
  uri: string;
  name: string;
  type: string;
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

async function parseIngestResponse(res: Response): Promise<IngestResult> {
  const body = (await res.json()) as IngestResult & {
    error?: string;
    message?: string;
  };

  if (!res.ok) {
    throw new Error(body.message ?? body.error ?? `Upload failed (${res.status})`);
  }

  return body;
}

export async function ingestUrl(url: string): Promise<IngestResult> {
  const res = await authorizedFetch('/knowledge/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url.trim() }),
  });
  return parseIngestResponse(res);
}

export async function ingestText(
  text: string,
  title?: string,
): Promise<IngestResult> {
  const res = await authorizedFetch('/knowledge/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.trim(), title }),
  });
  return parseIngestResponse(res);
}

export async function ingestFile(file: IngestFile): Promise<IngestResult> {
  const form = new FormData();
  form.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type || 'application/octet-stream',
  } as unknown as Blob);

  const res = await authorizedFetch('/knowledge/ingest', {
    method: 'POST',
    body: form,
  });
  return parseIngestResponse(res);
}

export function ingestMessageForKind(assetKind: string): string {
  switch (assetKind) {
    case 'link':
      return 'Saved link to memory';
    case 'image':
      return 'Saved photo to memory';
    case 'audio':
      return 'Saved audio to memory';
    case 'text':
      return 'Saved note to memory';
    default:
      return 'Saved document to memory';
  }
}
