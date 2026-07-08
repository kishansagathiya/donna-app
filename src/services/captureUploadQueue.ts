/**
 * Background cloud upload for device captures already saved on the phone.
 * Hardware sync (device → phone) is independent of this queue.
 */

import { uploadCapture } from './capturesApi';
import {
  listPendingUploadCaptures,
  markCaptureUploaded,
  markCaptureUploadFailed,
  markCaptureUploading,
  readCaptureWav,
} from './localDeviceCaptures';

let draining = false;
let scheduled = false;
const completeListeners = new Set<(result: UploadQueueResult) => void>();

export function onCaptureUploadComplete(
  listener: (result: UploadQueueResult) => void,
): () => void {
  completeListeners.add(listener);
  return () => completeListeners.delete(listener);
}

function notifyComplete(result: UploadQueueResult): void {
  for (const listener of completeListeners) {
    try {
      listener(result);
    } catch {
      // ignore listener errors
    }
  }
}

export type UploadQueueResult = {
  uploaded: number;
  failed: number;
  lastError: string | null;
};

/** Process pending local captures — safe to call repeatedly; no-ops if already running. */
export async function drainCaptureUploadQueue(): Promise<UploadQueueResult> {
  if (draining) {
    return { uploaded: 0, failed: 0, lastError: null };
  }
  draining = true;
  let uploaded = 0;
  let failed = 0;
  let lastError: string | null = null;

  try {
    const pending = await listPendingUploadCaptures();
    if (pending.length === 0) {
      return { uploaded: 0, failed: 0, lastError: null };
    }
    console.log(`[captureUploadQueue] draining ${pending.length} pending capture(s)`);

    for (const capture of pending) {
      await markCaptureUploading(capture.id);
      try {
        const wav = await readCaptureWav(capture);
        const result = await uploadCapture(wav);
        if (!result.ok) {
          failed++;
          lastError = result.error ?? 'Upload failed.';
          await markCaptureUploadFailed(capture.id, lastError);
          console.log(`[captureUploadQueue] failed ${capture.deviceName}:`, lastError);
          continue;
        }
        await markCaptureUploaded(capture.id, result.transcript);
        uploaded++;
        console.log(`[captureUploadQueue] uploaded ${capture.deviceName}`);
      } catch (err) {
        failed++;
        lastError = err instanceof Error ? err.message : 'Upload failed.';
        await markCaptureUploadFailed(capture.id, lastError);
        console.log(`[captureUploadQueue] error ${capture.deviceName}:`, lastError);
      }
    }
  } finally {
    draining = false;
    scheduled = false;
  }

  const result = { uploaded, failed, lastError };
  notifyComplete(result);
  return result;
}

/** Fire-and-forget upload drain — coalesces concurrent requests. */
export function scheduleCaptureUploads(): void {
  if (scheduled || draining) return;
  scheduled = true;
  setTimeout(() => {
    void drainCaptureUploadQueue();
  }, 500);
}
