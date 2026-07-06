/**
 * useDeviceSync — auto-connects to the user's paired Donna Device while the
 * app is in the foreground, drains any pending captures over BLE by
 * reassembling the framed capture-data indication stream into WAVs and
 * uploading them via `capturesApi.uploadCapture`. After a successful upload
 * the device is told to archive the capture; on failure it's left on the
 * device's SD card so the next attempt can retry.
 *
 * This hook is intentionally app-wide global and tied to AppState:
 *  - On active: if we have a paired device, connect (best-effort).
 *  - On background: disconnect the BLE session.
 *  - On the device going out of range: settle the current capture, await
 *    auto-reconnect via `react-native-ble-plx`'s connection state events.
 *
 * The hook exposes:
 *   - connection state ('disconnected' | 'connecting' | 'connected' | 'idle')
 *   - the connected device name
 *   - number of pending captures on the device
 *   - last upload status (idle | uploading | uploaded | failed)
 *   - any user-visible status message from the device
 */

import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../services/auth';
import {
  type CaptureFrame,
  type CaptureSession,
  type StatusHandler,
  type DeviceScan,
  startCaptureSession,
  sendStartCommand,
  sendStopCommand,
  acknowledgeCapture,
  getPairedDeviceId,
  setPairedDeviceId,
  scanForDonnaDevices,
  parseRelayReady,
  parseRelayProgress,
} from '../services/deviceBle';
import { uploadCapture, type CaptureUploadResult } from '../services/capturesApi';

export type DeviceConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'idle';

export type UploadState = 'idle' | 'uploading' | 'uploaded' | 'failed';

export type DeviceSyncStatus = {
  connectionState: DeviceConnectionState;
  pairedDeviceId: string | null;
  pendingCount: number;
  uploadState: UploadState;
  lastMessage: string | null;
  /** Increments after a capture becomes a saved note — Notes tab can reload on change. */
  notesRefreshToken: number;
};

const initial: DeviceSyncStatus = {
  connectionState: 'disconnected',
  pairedDeviceId: null,
  pendingCount: 0,
  uploadState: 'idle',
  lastMessage: null,
  notesRefreshToken: 0,
};

type InflightCapture = {
  name: string;
  totalBytes: number;
  bytes: Uint8Array[];
  receivedBytes: number;
  lastChunkAt: number;
};

const INFLIGHT_STALL_MS = 45000;

function isTransferIncomplete(received: number, declared: number): boolean {
  if (declared <= 0) return received < 44;
  return received < declared;
}

function concatenateByteChunks(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

export function useDeviceSync(): DeviceSyncStatus & {
  forgetDevice: () => Promise<void>;
  disconnectForProvisioning: () => Promise<void>;
  reconnectDevice: () => Promise<void>;
} {
  const [status, setStatus] = useState<DeviceSyncStatus>(initial);
  const sessionRef = useRef<CaptureSession | null>(null);
  const inflightRef = useRef<InflightCapture | null>(null);
  const uploadBusyRef = useRef(false);
  const retryPausedRef = useRef(false);
  const inflightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectToPairedRef = useRef<(deviceId: string) => Promise<void>>(
    async () => {},
  );

  async function forgetDevice() {
    if (sessionRef.current) {
      await sessionRef.current.disconnect().catch(() => {});
      sessionRef.current = null;
    }
    await setPairedDeviceId(null);
    setStatus(s => ({ ...s, pairedDeviceId: null, connectionState: 'disconnected' }));
  }

  useEffect(() => {
    let cancelled = false;

    function clearInflight(reason?: string) {
      inflightRef.current = null;
      if (inflightTimerRef.current) {
        clearTimeout(inflightTimerRef.current);
        inflightTimerRef.current = null;
      }
      if (reason) {
        setStatus(s => ({
          ...s,
          uploadState: 'failed',
          lastMessage: reason,
        }));
      }
    }

    function armInflightWatchdog() {
      if (inflightTimerRef.current) clearTimeout(inflightTimerRef.current);
      inflightTimerRef.current = setTimeout(() => {
        inflightTimerRef.current = null;
        const inflight = inflightRef.current;
        if (!inflight) return;
        clearInflight(
          `Timed out receiving ${inflight.name} from Donna (${inflight.receivedBytes} bytes). Retrying…`,
        );
        const session = sessionRef.current;
        if (session) sendStopCommand(session).catch(() => {});
        setTimeout(() => {
          if (!cancelled) maybeStartDrain();
        }, 1500);
      }, INFLIGHT_STALL_MS);
    }

    function maybeStartDrain() {
      const session = sessionRef.current;
      if (!session || inflightRef.current || uploadBusyRef.current || retryPausedRef.current) return;
      sendStartCommand(session).catch(err => {
        console.log('[useDeviceSync] start command failed', err);
      });
    }

    const handleStatus: StatusHandler = (msg) => {
      if (cancelled) return;
      const relayReady = parseRelayReady(msg);
      if (relayReady !== null) {
        setStatus(s => ({ ...s, pendingCount: relayReady.count }));
        if (relayReady.count > 0) {
          maybeStartDrain();
        }
        return;
      }
      const relayProgress = parseRelayProgress(msg);
      if (relayProgress !== null) {
        setStatus(s => ({
          ...s,
          uploadState: 'uploading',
          lastMessage: `Receiving from device ${relayProgress.percent}%`,
        }));
        return;
      }
      if (msg.startsWith('pending:')) {
        const n = parseInt(msg.slice('pending:'.length), 10) || 0;
        setStatus(s => ({ ...s, pendingCount: n }));
        return;
      }
      setStatus(s => ({ ...s, lastMessage: msg }));
    };

    const handleFrame = async (frame: CaptureFrame) => {
      if (cancelled) return;
      if (frame.kind === 'idle') {
        clearInflight();
        setStatus(s => ({ ...s, pendingCount: 0, uploadState: 'idle' }));
        return;
      }
      if (frame.kind === 'header') {
        inflightRef.current = {
          name: frame.name,
          totalBytes: frame.totalBytes,
          bytes: [],
          receivedBytes: 0,
          lastChunkAt: Date.now(),
        };
        armInflightWatchdog();
        setStatus(s => ({
          ...s,
          uploadState: 'uploading',
          lastMessage: `Receiving ${frame.name} from device…`,
        }));
        return;
      }
      if (frame.kind === 'data') {
        const inflight = inflightRef.current;
        if (inflight) {
          inflight.bytes.push(frame.bytes);
          inflight.receivedBytes += frame.bytes.length;
          inflight.lastChunkAt = Date.now();
          armInflightWatchdog();
        }
        return;
      }
      if (frame.kind === 'end') {
        const inflight = inflightRef.current;
        if (inflightTimerRef.current) {
          clearTimeout(inflightTimerRef.current);
          inflightTimerRef.current = null;
        }
        inflightRef.current = null;
        const session = sessionRef.current;
        if (!inflight || !session || inflight.name !== frame.name) {
          setStatus(s => ({ ...s, uploadState: 'failed', lastMessage: 'Capture stream ended unexpectedly.' }));
          return;
        }
        const wav = concatenateByteChunks(inflight.bytes);
        if (isTransferIncomplete(wav.length, inflight.totalBytes)) {
          await sendStopCommand(session).catch(() => {});
          setStatus(s => ({
            ...s,
            uploadState: 'failed',
            lastMessage: `Incomplete transfer: received ${wav.length} of ${inflight.totalBytes} bytes. Retrying…`,
          }));
          setTimeout(() => {
            if (!cancelled) maybeStartDrain();
          }, 2000);
          return;
        }
        setStatus(s => ({
          ...s,
          uploadState: 'uploading',
          lastMessage: `Uploading ${inflight.name} to cloud…`,
        }));
        uploadBusyRef.current = true;
        const result: CaptureUploadResult = await uploadCapture(wav).catch(err => ({
          ok: false,
          error: err instanceof Error ? err.message : 'Upload failed.',
        }));
        if (result.ok) {
          await acknowledgeCapture(session, inflight.name).catch(() => {});
          retryPausedRef.current = false;
          setStatus(s => ({
            ...s,
            uploadState: 'uploaded',
            pendingCount: Math.max(0, s.pendingCount - 1),
            notesRefreshToken: s.notesRefreshToken + 1,
            lastMessage: result.transcript
              ? `Note saved: ${result.transcript.slice(0, 96)}${result.transcript.length > 96 ? '…' : ''}`
              : 'Note saved.',
          }));
        } else {
          // Retry on the next drain attempt instead of blocking until reconnect.
          retryPausedRef.current = false;
          await sendStopCommand(session).catch(() => {});
          setStatus(s => ({
            ...s,
            uploadState: 'failed',
            lastMessage: `${result.error ?? 'Upload failed.'} Capture kept on Donna for retry.`,
          }));
        }
        uploadBusyRef.current = false;
        // Ask for the next capture (if any) — the device emits 0x04 idle
        // when nothing is left, which routes through the 'idle' branch.
        setTimeout(() => {
          if (!cancelled) {
            maybeStartDrain();
          }
        }, result.ok ? 200 : 2000);
        return;
      }
    };

    async function connectToPaired(deviceId: string) {
      if (cancelled) return;
      setStatus(s => ({ ...s, connectionState: 'connecting' }));
      try {
        retryPausedRef.current = false;
        const session = await startCaptureSession(deviceId, {
          onCaptureFrame: handleFrame,
          onStatus: handleStatus,
          onPendingCount: (n) => {
            setStatus(s => ({ ...s, pendingCount: n }));
          },
        });
        if (cancelled) {
          await session.disconnect().catch(() => {});
          return;
        }
        sessionRef.current = session;
        setStatus(s => ({
          ...s,
          connectionState: 'connected',
          pairedDeviceId: deviceId,
        }));
      } catch (err) {
        if (cancelled) return;
        setStatus(s => ({
          ...s,
          connectionState: 'disconnected',
          lastMessage: err instanceof Error ? err.message : 'Device connect failed.',
        }));
        // Best-effort: re-scan for the paired device's advertisement in
        // background; if/when it becomes visible again, the user can come
        // back to the screen and tap "Connect". v1 doesn't auto-scan here.
      }
    }

    connectToPairedRef.current = connectToPaired;

    async function init() {
      const paired = await getPairedDeviceId();
      if (cancelled) return;
      setStatus(s => ({ ...s, pairedDeviceId: paired }));
      if (paired) {
        await connectToPaired(paired);
      }
    }

    init();

    // Reconnect when the app comes back to the foreground.
    function handleAppStateChange(next: AppStateStatus) {
      if (next === 'active' && !sessionRef.current && !cancelled) {
        getPairedDeviceId().then(id => {
          if (id && !cancelled && !sessionRef.current) {
            connectToPaired(id);
          }
        });
      } else if ((next === 'background' || next === 'inactive') && sessionRef.current) {
        if (inflightTimerRef.current) {
          clearTimeout(inflightTimerRef.current);
          inflightTimerRef.current = null;
        }
        inflightRef.current = null;
        sessionRef.current.disconnect().catch(() => {});
        sessionRef.current = null;
        setStatus(s => ({ ...s, connectionState: 'disconnected' }));
      }
    }
    const sub = AppState.addEventListener('change', handleAppStateChange);

    // Supabase session-changed listener: if the user signs out, drop the
    // connection cleanly; if they sign back in, reconnect.
    const authSub = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;
      if (!session) {
        if (sessionRef.current) {
          await sessionRef.current.disconnect().catch(() => {});
          sessionRef.current = null;
        }
        setStatus({ ...initial, pairedDeviceId: await getPairedDeviceId() });
        return;
      }
    });

    return () => {
      cancelled = true;
      if (inflightTimerRef.current) {
        clearTimeout(inflightTimerRef.current);
        inflightTimerRef.current = null;
      }
      sub.remove();
      authSub.data.subscription.unsubscribe();
      if (sessionRef.current) {
        sessionRef.current.disconnect().catch(() => {});
        sessionRef.current = null;
      }
    };
  }, []);

  async function disconnectForProvisioning() {
    if (sessionRef.current) {
      await sessionRef.current.disconnect().catch(() => {});
      sessionRef.current = null;
      setStatus(s => ({ ...s, connectionState: 'disconnected' }));
    }
  }

  async function reconnectDevice() {
    const paired = await getPairedDeviceId();
    if (paired && !sessionRef.current) {
      await connectToPairedRef.current(paired);
    }
  }

  return { ...status, forgetDevice, disconnectForProvisioning, reconnectDevice };
}

export async function listPairedDevices(): Promise<DeviceScan[]> {
  // Re-export the scan primitive so screens can use it without importing
  // the BLE module directly. (Serially scans + resolves after 5s.)
  return new Promise<DeviceScan[]>((resolve) => {
    let latest: DeviceScan[] = [];
    const stop = scanForDonnaDevices(
      (list) => { latest = list; },
      () => {},
    );
    setTimeout(() => { stop(); resolve(latest); }, 5000);
  });
}
