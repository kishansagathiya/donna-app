/**
 * Device captures saved on the phone after hardware sync completes.
 * Cloud upload is a separate background step (see captureUploadQueue.ts).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import type { NoteSummary } from './notesApi';

declare const atob: (data: string) => string;
declare const btoa: (data: string) => string;

const INDEX_KEY = 'donna:device-captures:index';
const CAPTURE_DIR = 'device-captures';

export const LOCAL_DEVICE_NOTE_PREFIX = 'device:';

export type LocalDeviceCapture = {
  id: string;
  /** Capture filename on the Donna device, e.g. cap_1756532028 */
  deviceName: string;
  wavPath: string;
  createdAt: string;
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed';
  transcript: string | null;
  serverNoteId: string | null;
  lastUploadError: string | null;
};

function captureDir(): string {
  return `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${CAPTURE_DIR}`;
}

async function ensureCaptureDir(): Promise<void> {
  const dir = captureDir();
  const exists = await ReactNativeBlobUtil.fs.exists(dir);
  if (exists) return;
  try {
    await ReactNativeBlobUtil.fs.mkdir(dir);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('EEXIST') || message.includes('already exists'))
      return;
    throw err;
  }
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function readIndex(): Promise<LocalDeviceCapture[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LocalDeviceCapture[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIndex(entries: LocalDeviceCapture[]): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(entries));
}

export function isLocalDeviceNoteId(noteId: string): boolean {
  return noteId.startsWith(LOCAL_DEVICE_NOTE_PREFIX);
}

export function localDeviceNoteId(captureId: string): string {
  return `${LOCAL_DEVICE_NOTE_PREFIX}${captureId}`;
}

export function parseLocalDeviceNoteId(noteId: string): string | null {
  if (!isLocalDeviceNoteId(noteId)) return null;
  return noteId.slice(LOCAL_DEVICE_NOTE_PREFIX.length);
}

export function localCaptureFileUri(wavPath: string): string {
  return wavPath.startsWith('file://') ? wavPath : `file://${wavPath}`;
}

export async function listLocalDeviceCaptures(): Promise<LocalDeviceCapture[]> {
  const entries = await readIndex();
  return entries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function listLocalDeviceNoteSummaries(): Promise<NoteSummary[]> {
  const captures = await listLocalDeviceCaptures();
  return captures.map(localCaptureToSummary);
}

export async function getLocalDeviceCapture(
  id: string,
): Promise<LocalDeviceCapture | null> {
  const entries = await readIndex();
  return entries.find(e => e.id === id) ?? null;
}

export async function listPendingUploadCaptures(): Promise<
  LocalDeviceCapture[]
> {
  const entries = await readIndex();
  return entries.filter(
    e => e.uploadStatus === 'pending' || e.uploadStatus === 'failed',
  );
}

/**
 * Persist a WAV received from Donna hardware. Dedupes by device capture name.
 */
export async function saveDeviceCapture(opts: {
  deviceName: string;
  wav: Uint8Array;
  createdAt?: string;
}): Promise<LocalDeviceCapture> {
  const entries = await readIndex();
  const existing = entries.find(e => e.deviceName === opts.deviceName);
  if (existing) {
    console.log('[localDeviceCaptures] already saved', opts.deviceName);
    return existing;
  }

  const dir = captureDir();
  await ensureCaptureDir();
  const id = `${opts.deviceName}-${Date.now()}`;
  const wavPath = `${dir}/${id}.wav`;
  await ReactNativeBlobUtil.fs.writeFile(
    wavPath,
    uint8ToBase64(opts.wav),
    'base64',
  );

  const entry: LocalDeviceCapture = {
    id,
    deviceName: opts.deviceName,
    wavPath,
    createdAt: opts.createdAt ?? new Date().toISOString(),
    uploadStatus: 'pending',
    transcript: null,
    serverNoteId: null,
    lastUploadError: null,
  };
  entries.push(entry);
  await writeIndex(entries);
  console.log('[localDeviceCaptures] saved', opts.deviceName, wavPath);
  return entry;
}

export async function markCaptureUploading(id: string): Promise<void> {
  const entries = await readIndex();
  const idx = entries.findIndex(e => e.id === id);
  if (idx < 0) return;
  entries[idx] = {
    ...entries[idx],
    uploadStatus: 'uploading',
    lastUploadError: null,
  };
  await writeIndex(entries);
}

export async function markCaptureUploaded(
  id: string,
  transcript: string,
): Promise<void> {
  const entries = await readIndex();
  const idx = entries.findIndex(e => e.id === id);
  if (idx < 0) return;
  entries[idx] = {
    ...entries[idx],
    uploadStatus: 'uploaded',
    transcript: transcript.trim() || entries[idx].transcript,
    lastUploadError: null,
  };
  await writeIndex(entries);
}

export async function markCaptureUploadFailed(
  id: string,
  error: string,
): Promise<void> {
  const entries = await readIndex();
  const idx = entries.findIndex(e => e.id === id);
  if (idx < 0) return;
  entries[idx] = {
    ...entries[idx],
    uploadStatus: 'failed',
    lastUploadError: error,
  };
  await writeIndex(entries);
}

export async function readCaptureWav(
  capture: LocalDeviceCapture,
): Promise<Uint8Array> {
  const b64 = await ReactNativeBlobUtil.fs.readFile(capture.wavPath, 'base64');
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function deleteLocalDeviceCapture(id: string): Promise<void> {
  const entries = await readIndex();
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  await ReactNativeBlobUtil.fs.unlink(entry.wavPath).catch(() => {});
  await writeIndex(entries.filter(e => e.id !== id));
}

export function localCaptureToSummary(
  capture: LocalDeviceCapture,
): NoteSummary {
  const date = new Date(capture.createdAt);
  const timeLabel = Number.isNaN(date.getTime())
    ? capture.deviceName
    : date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

  const transcriptLine =
    capture.transcript?.trim().split('\n').find(Boolean) ?? '';
  const title = transcriptLine.slice(0, 80) || `Donna capture · ${timeLabel}`;

  let preview = 'Voice note from Donna';
  if (capture.transcript?.trim()) {
    preview = capture.transcript.trim().slice(0, 200);
  } else if (
    capture.uploadStatus === 'pending' ||
    capture.uploadStatus === 'uploading'
  ) {
    preview = 'Synced from device — uploading to cloud…';
  } else if (capture.uploadStatus === 'failed') {
    preview = capture.lastUploadError ?? 'Cloud upload pending retry';
  }

  return {
    id: localDeviceNoteId(capture.id),
    title,
    preview,
    note_date: capture.createdAt,
    is_important: false,
    is_urgent: false,
    source_type: 'device',
    keywords: null,
    category: null,
    has_audio: true,
  };
}

export function localCaptureToDetail(capture: LocalDeviceCapture) {
  const summary = localCaptureToSummary(capture);
  return {
    ...summary,
    user_id: '',
    source_id: capture.deviceName,
    content: capture.transcript?.trim() || summary.preview,
    user_last_modified: null,
    created_at: capture.createdAt,
    updated_at: capture.createdAt,
    audio_url: localCaptureFileUri(capture.wavPath),
  };
}
