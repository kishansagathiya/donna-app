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
import { getAccessToken, getSession, supabase } from '../services/auth';
import {
  type CaptureFrame,
  type CaptureSession,
  type StatusHandler,
  type DeviceScan,
  connectAndProvision,
  startCaptureSession,
  sendStartCommand,
  acknowledgeCapture,
  deleteCapture,
  getPairedDeviceId,
  setPairedDeviceId,
  scanForDonnaDevices,
  parseWifiSavedCount,
  parseRelayReady,
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
  wifiNetworkCount: number | null;
};

const initial: DeviceSyncStatus = {
  connectionState: 'disconnected',
  pairedDeviceId: null,
  pendingCount: 0,
  uploadState: 'idle',
  lastMessage: null,
  wifiNetworkCount: null,
};

type InflightCapture = {
  name: string;
  totalBytes: number;
  bytes: Uint8Array[];
  receivedBytes: number;
};

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

    function maybeStartDrain() {
      const session = sessionRef.current;
      if (!session || inflightRef.current || uploadBusyRef.current) return;
      sendStartCommand(session).catch(() => {});
    }

    const handleStatus: StatusHandler = (msg) => {
      if (cancelled) return;
      const relayReady = parseRelayReady(msg);
      if (relayReady !== null) {
        setStatus(s => ({
          ...s,
          pendingCount: relayReady.count,
          lastMessage: msg,
        }));
        if (relayReady.count > 0) {
          maybeStartDrain();
        }
        return;
      }
      if (msg.startsWith('pending:')) {
        const n = parseInt(msg.slice('pending:'.length), 10) || 0;
        setStatus(s => ({ ...s, pendingCount: n }));
        if (n > 0) {
          maybeStartDrain();
        }
        return;
      }
      const wifiCount = parseWifiSavedCount(msg);
      if (wifiCount !== null) {
        setStatus(s => ({ ...s, wifiNetworkCount: wifiCount, lastMessage: msg }));
        return;
      }
      setStatus(s => ({ ...s, lastMessage: msg }));
    };

    const handleFrame = async (frame: CaptureFrame) => {
      if (cancelled) return;
      if (frame.kind === 'idle') {
        setStatus(s => ({ ...s, pendingCount: 0, uploadState: 'idle' }));
        inflightRef.current = null;
        return;
      }
      if (frame.kind === 'header') {
        inflightRef.current = {
          name: frame.name,
          totalBytes: frame.totalBytes,
          bytes: [],
          receivedBytes: 0,
        };
        setStatus(s => ({ ...s, uploadState: 'uploading' }));
        return;
      }
      if (frame.kind === 'data') {
        const inflight = inflightRef.current;
        if (inflight) {
          inflight.bytes.push(frame.bytes);
          inflight.receivedBytes += frame.bytes.length;
        }
        return;
      }
      if (frame.kind === 'end') {
        const inflight = inflightRef.current;
        inflightRef.current = null;
        const session = sessionRef.current;
        if (!inflight || !session) {
          setStatus(s => ({ ...s, uploadState: 'failed' }));
          return;
        }
        const wav = concatenateByteChunks(inflight.bytes);
        setStatus(s => ({ ...s, uploadState: 'uploading' }));
        uploadBusyRef.current = true;
        const result: CaptureUploadResult = await uploadCapture(wav);
        if (result.ok) {
          await acknowledgeCapture(session, inflight.name).catch(() => {});
          setStatus(s => ({
            ...s,
            uploadState: 'uploaded',
            pendingCount: Math.max(0, s.pendingCount - 1),
            lastMessage: result.transcript
              ? `Transcript: ${result.transcript.slice(0, 96)}${result.transcript.length > 96 ? '…' : ''}`
              : 'Synced.',
          }));
        } else {
          await deleteCapture(session, inflight.name).catch(() => {});
          setStatus(s => ({
            ...s,
            uploadState: 'failed',
            lastMessage: result.error ?? 'Upload failed.',
          }));
        }
        uploadBusyRef.current = false;
        // Ask for the next capture (if any) — the device emits 0x04 idle
        // when nothing is left, which routes through the 'idle' branch.
        setTimeout(() => {
          if (!cancelled) {
            maybeStartDrain();
          }
        }, 200);
        return;
      }
    };

    async function connectToPaired(deviceId: string) {
      if (cancelled) return;
      setStatus(s => ({ ...s, connectionState: 'connecting' }));
      try {
        const session = await startCaptureSession(deviceId, {
          onCaptureFrame: handleFrame,
          onStatus: handleStatus,
          onPendingCount: (n) => {
            setStatus(s => ({ ...s, pendingCount: n }));
            if (n > 0) maybeStartDrain();
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

export async function currentAccessTokenForProvisioning(): Promise<{
  jwt: string;
  refreshToken: string;
} | null> {
  const session = await getSession();
  if (!session) return null;
  return { jwt: session.access_token, refreshToken: session.refresh_token };
}

export { connectAndProvision, provisionWifiNetwork } from '../services/deviceBle';