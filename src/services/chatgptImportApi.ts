import ReactNativeBlobUtil from 'react-native-blob-util';
import { authorizedFetch, parseJSON } from './http';

export type ChatGPTImportStatus =
  | 'awaiting_upload'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed';

export type ChatGPTImport = {
  id: string;
  status: ChatGPTImportStatus;
  conversations_total: number;
  conversations_processed: number;
  memories_imported: number;
  cursor_index: number;
  bytes?: number;
  error?: string;
  started_at?: string;
  finished_at?: string;
  created_at: string;
  updated_at: string;
};

export type CreateChatGPTImportResult = {
  id: string;
  status: ChatGPTImportStatus;
  upload_url: string;
  upload_method?: string;
  upload_headers?: Record<string, string>;
  token?: string;
  path: string;
  bucket: string;
  provider?: string;
  max_bytes: number;
  expires_in_s: number;
};

const MAX_BYTES = 512 * 1024 * 1024;

export async function createChatGPTImport(): Promise<CreateChatGPTImportResult> {
  const res = await authorizedFetch('/imports/chatgpt', { method: 'POST' });
  return parseJSON<CreateChatGPTImportResult>(res);
}

export async function getLatestChatGPTImport(): Promise<ChatGPTImport | null> {
  const res = await authorizedFetch('/imports/chatgpt');
  const body = await parseJSON<{ import: ChatGPTImport | null }>(res);
  return body.import;
}

export async function getChatGPTImport(id: string): Promise<ChatGPTImport> {
  const res = await authorizedFetch(`/imports/chatgpt/${id}`);
  const body = await parseJSON<{ import: ChatGPTImport }>(res);
  return body.import;
}

export async function startChatGPTImport(
  id: string,
  bytes?: number,
): Promise<ChatGPTImport> {
  const res = await authorizedFetch(`/imports/chatgpt/${id}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bytes != null ? { bytes } : {}),
  });
  const body = await parseJSON<{ import: ChatGPTImport }>(res);
  return body.import;
}

function normalizeFilePath(uri: string): string {
  if (uri.startsWith('file://')) {
    return uri.replace('file://', '');
  }
  return uri;
}

export async function uploadChatGPTExportZip(
  uploadUrl: string,
  filePath: string,
  opts?: {
    token?: string;
    headers?: Record<string, string>;
    onProgress?: (ratio: number) => void;
  },
): Promise<void> {
  const path = normalizeFilePath(filePath);
  const headers: Record<string, string> = {
    'Content-Type': 'application/zip',
    ...(opts?.headers ?? {}),
  };
  if (opts?.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }

  const task = ReactNativeBlobUtil.fetch(
    'PUT',
    uploadUrl,
    headers,
    ReactNativeBlobUtil.wrap(path),
  );

  if (opts?.onProgress) {
    task.uploadProgress({ interval: 200 }, (written, total) => {
      if (total > 0) {
        opts.onProgress?.(written / total);
      }
    });
  }

  const res = await task;
  const status = res.info().status;
  if (status < 200 || status >= 300) {
    throw new Error(
      `Upload failed (${status})${res.text() ? `: ${res.text()}` : ''}`,
    );
  }
}

export async function importChatGPTExportZip(input: {
  uri: string;
  name?: string;
  size?: number | null;
  onProgress?: (phase: 'uploading' | 'starting', ratio?: number) => void;
}): Promise<ChatGPTImport> {
  const size = input.size ?? null;
  if (size != null && size > MAX_BYTES) {
    throw new Error('Export ZIP must be 512MB or smaller');
  }
  const name = (input.name ?? '').toLowerCase();
  if (name && !name.endsWith('.zip')) {
    throw new Error('Please upload the ChatGPT export ZIP file');
  }

  const created = await createChatGPTImport();
  input.onProgress?.('uploading', 0);
  await uploadChatGPTExportZip(created.upload_url, input.uri, {
    token: created.token,
    headers: created.upload_headers,
    onProgress: ratio => input.onProgress?.('uploading', ratio),
  });
  input.onProgress?.('starting');
  return startChatGPTImport(created.id, size ?? undefined);
}
