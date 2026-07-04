/**
 * Donna capture uploader — replays a finished WAV (as recorded by the Donna
 * capture device) into the server's /voice WebSocket in `notes` mode, which
 * is the exact same path the iOS app uses for phone-side voice notes.
 *
 * The server transcribes, saves a conversation_turn with channel='voice', and
 * a few seconds later runs the post-session compile that produces a Note
 * (visible in the Notes tab) and updates the user's memory facts.
 *
 * The resulting audio file shape on the server side is therefore identical
 * to a phone-side voice note: `source_type = 'voice_turn'`, channel='voice'.
 */

import { supabase, getAccessToken, getSession } from '../services/auth';
import { VOICE_WS_URL, AUDIO_SAMPLE_RATE, AUDIO_CHANNELS } from '../config';
import { pcm16ToBase64 } from '../voice/pcm';
import type { ClientMessage } from '../voice/protocol';

// 100 ms of 16 kHz mono 16-bit audio = 1600 samples * 2 = 3200 bytes.
const PCM_CHUNK_BYTES = (AUDIO_SAMPLE_RATE / 10) * AUDIO_CHANNELS * 2;

const WAV_HEADER_BYTES = 44;

export type CaptureUploadResult =
  | { ok: true; transcript: string }
  | { ok: false; error: string };

function sendFrames(
  ws: WebSocket,
  message: ClientMessage,
): void {
  ws.send(JSON.stringify(message));
}

function randomSessionId(): string {
  // Crypto-grade enough for v1. Browsers/React-Native expose crypto.randomUUID
  // on the global; if not, fall back to a Math.random-based UUID v4.
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) {
    return g.crypto.randomUUID();
  }
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function refreshJwt(): Promise<string | null> {
  // The Supabase client auto-refreshes the access token in the background.
  // This local refresh is just an explicit no-op fallback. getSession() will
  // return a freshly-refreshed JWT if one was issued since the last call.
  return getAccessToken();
}

/**
 * Upload a capture WAV (16 kHz mono 16-bit, 44-byte WAV header) to the
 * donna-server-go /voice endpoint in notes mode. The caller passes the full
 * WAV bytes as received from the device over BLE — the server expects raw
 * PCM16 framed inside base64 JSON; the 44-byte WAV header is stripped
 * locally first.
 */
export async function uploadCapture(wavBytes: Uint8Array): Promise<CaptureUploadResult> {
  if (wavBytes.length <= WAV_HEADER_BYTES) {
    return { ok: false, error: 'Capture too small to be a WAV.' };
  }

  let accessToken = await getAccessToken();
  if (!accessToken) {
    // Try an explicit refresh — the auth listener may have refreshed but the
    // local session might not have propagated yet.
    accessToken = await refreshJwt();
  }
  if (!accessToken) {
    return { ok: false, error: 'Not signed in. Please sign in and try again.' };
  }

  const sessionId = `device:${randomSessionId()}`;

  return new Promise<CaptureUploadResult>(resolve => {
    let settled = false;
    let seq = 0;
    let transcript = '';
    const settleOK = () => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* ignore */ }
      resolve({ ok: true, transcript });
    };
    const settleErr = (msg: string) => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* ignore */ }
      resolve({ ok: false, error: msg });
    };

    const url = `${VOICE_WS_URL}?token=${encodeURIComponent(accessToken)}`;
    console.log('[capturesApi] uploading capture to', VOICE_WS_URL.replace(/token=[^&]+/, ''), `bytes=${wavBytes.length}`);
    const ws = new WebSocket(url);

    ws.onopen = () => {
      sendFrames(ws, {
        type: 'session.start',
        mode: 'notes',
        sessionId,
      });

      // Strip the 44-byte WAV header; chunk the rest into PCM frames.
      const bytes = wavBytes.subarray(WAV_HEADER_BYTES);
      let offset = 0;
      while (offset < bytes.length) {
        const end = Math.min(offset + PCM_CHUNK_BYTES, bytes.length);
        const chunk = bytes.subarray(offset, end);
        seq += 1;
        sendFrames(ws, {
          type: 'audio.chunk',
          seq,
          format: 'pcm16',
          sampleRate: AUDIO_SAMPLE_RATE,
          channels: AUDIO_CHANNELS,
          data: pcm16ToBase64(chunk as Uint8Array),
        });
        offset = end;
      }
      sendFrames(ws, { type: 'turn.end' });
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data));
        if (message.type === 'turn.transcript' && typeof message.text === 'string') {
          transcript = message.text;
        } else if (message.type === 'turn.done') {
          settleOK();
        } else if (message.type === 'error') {
          settleErr(message.message ?? 'Server error during capture upload.');
        }
      } catch {
        // Ignore malformed frames — server may send many turn.phase events.
      }
    };

    ws.onerror = () => {
      settleErr(
        __DEV__
          ? `Cannot reach Donna server at ${VOICE_WS_URL}.`
          : 'Could not upload this capture. Please try again later.',
      );
    };

    ws.onclose = (event) => {
      if (settled) return;
      if (event.code === 4401) {
        settleErr('Authentication failed. Please sign in again.');
      } else {
        settleErr('Connection closed before the capture finished uploading.');
      }
    };

    // Safety: resolve after 30s even if the server never sends turn.done.
    setTimeout(() => settleErr('Capture upload timed out.'), 30000);
  });
}

/** Check that the user is currently signed in (used by the device-sync hook). */
export function isSignedIn(): Promise<boolean> {
  return getSession().then(s => s !== null);
}

// Re-export the supabase client to make treeshaking happy if anything else
// imports it from here.
export { supabase };