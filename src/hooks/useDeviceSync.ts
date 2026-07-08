/**
 * useDeviceSync — auto-connects to the user's paired Donna Device and drains
 * pending captures over Wi-Fi or BLE into on-phone storage. Hardware sync
 * completes when the WAV is saved locally and the device is acked. Cloud
 * upload runs separately via captureUploadQueue.ts.
 *
 * Sync continues while the app is in the background (iOS `bluetooth-central`
 * background mode). This hook is app-wide global:
 *  - On launch / active: if we have a paired device, connect (best-effort).
 *  - On the device going out of range or the link dropping (including while
 *    the phone is locked): settle the current capture and immediately issue a
 *    new pending connect. iOS keeps pending connects alive indefinitely and
 *    completes them in the background when the peripheral advertises again,
 *    so sync resumes without the user unlocking the phone.
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
  sendWifiStopCommand,
  acknowledgeCapture,
  getPairedDeviceId,
  setPairedDeviceId,
  scanForDonnaDevices,
  parseRelayReady,
  parseRelayProgress,
  readSyncApCredentialsFromDevice,
  isInternalDeviceStatus,
} from '../services/deviceBle';
import { captureBytesToWav } from '../services/captureAudio';
import {
  scheduleCaptureUploads,
  onCaptureUploadComplete,
} from '../services/captureUploadQueue';
import { saveDeviceCapture } from '../services/localDeviceCaptures';
import {
  clearSyncApCredentials,
  getSyncApCredentials,
  saveSyncApCredentials,
} from '../services/deviceSyncCredentials';
import { runWifiCaptureSync } from '../services/deviceWifiSync';

export type SyncPath = 'idle' | 'wifi' | 'ble';

export type DeviceConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'idle';

export type UploadState = 'idle' | 'uploading' | 'uploaded' | 'failed';

export type DeviceSyncProgress = {
  synced: number;
  total: number;
};

export type DeviceSyncStatus = {
  connectionState: DeviceConnectionState;
  pairedDeviceId: string | null;
  pendingCount: number;
  uploadState: UploadState;
  syncPath: SyncPath;
  /** Active hardware sync progress (device → phone). Null when not syncing. */
  syncProgress: DeviceSyncProgress | null;
  lastMessage: string | null;
  /** Increments after a capture becomes a saved note — Notes tab can reload on change. */
  notesRefreshToken: number;
};

const initial: DeviceSyncStatus = {
  connectionState: 'disconnected',
  pairedDeviceId: null,
  pendingCount: 0,
  uploadState: 'idle',
  syncPath: 'idle',
  syncProgress: null,
  lastMessage: null,
  notesRefreshToken: 0,
};

type StatusWaiter = {
  predicate: (msg: string) => boolean;
  resolve: (msg: string | null) => void;
  timer: ReturnType<typeof setTimeout>;
};

type InflightCapture = {
  name: string;
  totalBytes: number;
  format: number;
  bytes: Uint8Array[];
  receivedBytes: number;
  lastChunkAt: number;
  lastProgressUiAt: number;
  lastProgressPercent: number;
};

const INFLIGHT_STALL_MS = 45000;
const BLE_START_STALL_MS = 8000;
const SYNC_STATUS_CLEAR_MS = 4000;

function isTransferIncomplete(received: number, declared: number): boolean {
  if (declared <= 0) return received < 44;
  return received < declared;
}

function formatByteCount(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
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
  const connectingRef = useRef(false);
  const inflightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bleStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusWaitersRef = useRef<StatusWaiter[]>([]);
  const wifiBusyRef = useRef(false);
  /** After Wi-Fi transport fails, stick to BLE until the next device connect. */
  const blePreferredRef = useRef(false);
  const drainLockRef = useRef(false);
  const bleStartPendingRef = useRef(false);
  const statusClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const connectToPairedRef = useRef<(deviceId: string) => Promise<void>>(
    async () => {},
  );

  async function forgetDevice() {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (sessionRef.current) {
      await sendWifiStopCommand(sessionRef.current).catch(() => {});
      await sessionRef.current.disconnect().catch(() => {});
      sessionRef.current = null;
    }
    await setPairedDeviceId(null);
    await clearSyncApCredentials();
    setStatus(s => ({
      ...s,
      pairedDeviceId: null,
      connectionState: 'disconnected',
      syncPath: 'idle',
    }));
  }

  useEffect(() => {
    let cancelled = false;

    function clearBleStartPending() {
      bleStartPendingRef.current = false;
      if (bleStartTimerRef.current) {
        clearTimeout(bleStartTimerRef.current);
        bleStartTimerRef.current = null;
      }
    }

    function markBleStartPending() {
      clearBleStartPending();
      bleStartPendingRef.current = true;
      bleStartTimerRef.current = setTimeout(() => {
        bleStartTimerRef.current = null;
        if (!bleStartPendingRef.current || cancelled) return;
        bleStartPendingRef.current = false;
        maybeStartDrain();
      }, BLE_START_STALL_MS);
    }

    function clearInflight(reason?: string) {
      inflightRef.current = null;
      if (inflightTimerRef.current) {
        clearTimeout(inflightTimerRef.current);
        inflightTimerRef.current = null;
      }
      if (bleStartTimerRef.current) {
        clearTimeout(bleStartTimerRef.current);
        bleStartTimerRef.current = null;
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

    function notifyStatusWaiters(msg: string) {
      const waiters = statusWaitersRef.current;
      if (waiters.length === 0) return;
      const remaining: StatusWaiter[] = [];
      for (const w of waiters) {
        if (w.predicate(msg)) {
          clearTimeout(w.timer);
          w.resolve(msg);
        } else {
          remaining.push(w);
        }
      }
      statusWaitersRef.current = remaining;
    }

    function waitForStatus(
      predicate: (msg: string) => boolean,
      timeoutMs: number,
    ): Promise<string | null> {
      return new Promise(resolve => {
        const timer = setTimeout(() => {
          statusWaitersRef.current = statusWaitersRef.current.filter(
            w => w.timer !== timer,
          );
          resolve(null);
        }, timeoutMs);
        statusWaitersRef.current.push({ predicate, resolve, timer });
      });
    }

    function clearStatusLater() {
      if (statusClearTimerRef.current)
        clearTimeout(statusClearTimerRef.current);
      statusClearTimerRef.current = setTimeout(() => {
        statusClearTimerRef.current = null;
        if (cancelled) return;
        setStatus(s => ({
          ...s,
          uploadState: 'idle',
          syncPath: 'idle',
          syncProgress: null,
          lastMessage: null,
        }));
      }, SYNC_STATUS_CLEAR_MS);
    }

    function onHardwareCaptureSaved() {
      if (cancelled) return;
      setStatus(s => {
        const total = s.syncProgress?.total ?? Math.max(1, s.pendingCount);
        const synced = Math.min(total, (s.syncProgress?.synced ?? 0) + 1);
        return {
          ...s,
          notesRefreshToken: s.notesRefreshToken + 1,
          pendingCount: Math.max(0, s.pendingCount - 1),
          syncProgress: { synced, total },
          lastMessage: `Synced ${synced}/${total} from Donna`,
        };
      });
    }

    function finishHardwareSync(message: string) {
      setStatus(s => ({
        ...s,
        uploadState: 'uploaded',
        syncPath: 'idle',
        syncProgress: null,
        lastMessage: message,
      }));
      clearStatusLater();
    }

    async function drainPending() {
      const session = sessionRef.current;
      if (
        !session ||
        inflightRef.current ||
        wifiBusyRef.current ||
        drainLockRef.current ||
        bleStartPendingRef.current
      ) {
        return;
      }
      drainLockRef.current = true;
      try {
        const creds = await getSyncApCredentials(session.deviceId);
        const preferWifi =
          AppState.currentState === 'active' &&
          creds !== null &&
          !blePreferredRef.current;

        if (!preferWifi) {
          const reason =
            AppState.currentState !== 'active'
              ? 'app backgrounded'
              : 'no Wi-Fi credentials — open Pair device to refresh';
          console.log('[useDeviceSync] using BLE:', reason);
        }

        if (preferWifi) {
          wifiBusyRef.current = true;
          let scheduleAnother = false;
          let fallbackToBle = false;
          setStatus(s => {
            const total = Math.max(1, s.pendingCount || 1);
            return {
              ...s,
              syncPath: 'wifi',
              uploadState: 'uploading',
              syncProgress: { synced: 0, total },
              lastMessage: `Syncing 0/${total} from Donna…`,
            };
          });
          try {
            const outcome = await runWifiCaptureSync(session, {
              waitStatus: waitForStatus,
              onProgress: p => {
                if (cancelled) return;
                const label =
                  p.phase === 'joining'
                    ? 'Joining Donna Wi-Fi…'
                    : p.phase === 'downloading'
                    ? `Downloading ${p.captureName ?? 'capture'}${
                        p.index && p.total ? ` (${p.index}/${p.total})` : ''
                      }…`
                    : `Saving ${p.captureName ?? 'capture'}${
                        p.index && p.total ? ` (${p.index}/${p.total})` : ''
                      }…`;
                setStatus(s => ({
                  ...s,
                  syncPath: 'wifi',
                  uploadState: 'uploading',
                  lastMessage: label,
                }));
              },
              onCaptureSaved: () => {
                onHardwareCaptureSaved();
              },
            });
            if (outcome !== null) {
              blePreferredRef.current = false;
              if (outcome.synced > 0) {
                scheduleAnother = true;
                finishHardwareSync(
                  `${outcome.synced} note${
                    outcome.synced === 1 ? '' : 's'
                  } synced from Donna`,
                );
                scheduleCaptureUploads();
              } else {
                setStatus(s => ({
                  ...s,
                  syncPath: 'idle',
                  uploadState: 'idle',
                  syncProgress: null,
                  lastMessage: null,
                }));
              }
            }
          } catch (err) {
            const message =
              err instanceof Error ? err.message : 'Wi-Fi sync failed.';
            console.log(
              '[useDeviceSync] Wi-Fi sync failed, falling back to BLE',
              err,
            );
            const isTransportFailure =
              /join|hotspot|could not reach|local network|timed out|device list|download failed|probe/i.test(
                message,
              );
            if (isTransportFailure) {
              blePreferredRef.current = true;
              fallbackToBle = true;
              setStatus(s => ({
                ...s,
                syncPath: 'ble',
                uploadState: 'uploading',
                syncProgress: null,
                lastMessage:
                  'Wi-Fi unavailable — syncing over Bluetooth instead…',
              }));
            } else {
              setStatus(s => ({
                ...s,
                syncPath: 'idle',
                uploadState: 'failed',
                syncProgress: null,
                lastMessage: message,
              }));
            }
          } finally {
            wifiBusyRef.current = false;
            if (scheduleAnother && !cancelled) {
              setTimeout(() => drainPending(), 200);
            } else if (fallbackToBle && !cancelled) {
              markBleStartPending();
              sendStartCommand(session).catch(startErr => {
                clearBleStartPending();
                console.log(
                  '[useDeviceSync] BLE fallback start failed',
                  startErr,
                );
              });
              setTimeout(() => maybeStartDrain(), 200);
            }
          }
          return;
        }

        setStatus(s => {
          const total = Math.max(1, s.pendingCount || 1);
          return {
            ...s,
            syncPath: 'ble',
            uploadState: 'uploading',
            syncProgress: { synced: 0, total },
            lastMessage: `Syncing 0/${total} from Donna…`,
          };
        });
        markBleStartPending();
        sendStartCommand(session).catch(err => {
          clearBleStartPending();
          console.log('[useDeviceSync] start command failed', err);
        });
      } finally {
        drainLockRef.current = false;
      }
    }

    function maybeStartDrain() {
      if (wifiBusyRef.current) return;
      void drainPending();
    }

    const handleStatus: StatusHandler = msg => {
      if (cancelled) return;
      notifyStatusWaiters(msg);
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
      if (isInternalDeviceStatus(msg)) return;
      setStatus(s => ({ ...s, lastMessage: msg }));
    };

    const handleFrame = async (frame: CaptureFrame) => {
      if (cancelled) return;
      if (frame.kind === 'idle') {
        clearBleStartPending();
        clearInflight();
        setStatus(s => ({
          ...s,
          pendingCount: 0,
          uploadState: 'idle',
          syncPath: 'idle',
        }));
        return;
      }
      if (frame.kind === 'header') {
        clearBleStartPending();
        inflightRef.current = {
          name: frame.name,
          totalBytes: frame.totalBytes,
          format: frame.format,
          bytes: [],
          receivedBytes: 0,
          lastChunkAt: Date.now(),
          lastProgressUiAt: 0,
          lastProgressPercent: -1,
        };
        armInflightWatchdog();
        setStatus(s => ({
          ...s,
          syncPath: 'ble',
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
          const now = Date.now();
          inflight.lastChunkAt = now;
          armInflightWatchdog();

          const percent =
            inflight.totalBytes > 0
              ? Math.max(
                  0,
                  Math.min(
                    100,
                    Math.floor(
                      (inflight.receivedBytes * 100) / inflight.totalBytes,
                    ),
                  ),
                )
              : 0;
          const shouldUpdateUi =
            now - inflight.lastProgressUiAt >= 1000 ||
            percent !== inflight.lastProgressPercent;
          if (shouldUpdateUi) {
            inflight.lastProgressUiAt = now;
            inflight.lastProgressPercent = percent;
            const received = formatByteCount(inflight.receivedBytes);
            const total =
              inflight.totalBytes > 0
                ? ` / ${formatByteCount(inflight.totalBytes)}`
                : '';
            setStatus(s => ({
              ...s,
              syncPath: 'ble',
              uploadState: 'uploading',
              lastMessage:
                inflight.totalBytes > 0
                  ? `Receiving ${inflight.name} ${percent}% (${received}${total})`
                  : `Receiving ${inflight.name} (${received})`,
            }));
          }
        }
        return;
      }
      if (frame.kind === 'end') {
        clearBleStartPending();
        const inflight = inflightRef.current;
        if (inflightTimerRef.current) {
          clearTimeout(inflightTimerRef.current);
          inflightTimerRef.current = null;
        }
        inflightRef.current = null;
        const session = sessionRef.current;
        if (!inflight || !session || inflight.name !== frame.name) {
          setStatus(s => ({
            ...s,
            uploadState: 'failed',
            lastMessage: 'Capture stream ended unexpectedly.',
          }));
          return;
        }
        const raw = concatenateByteChunks(inflight.bytes);
        if (isTransferIncomplete(raw.length, inflight.totalBytes)) {
          await sendStopCommand(session).catch(() => {});
          setStatus(s => ({
            ...s,
            syncPath: 'ble',
            uploadState: 'failed',
            lastMessage: `Incomplete transfer: received ${raw.length} of ${inflight.totalBytes} bytes. Retrying…`,
          }));
          setTimeout(() => {
            if (!cancelled) maybeStartDrain();
          }, 2000);
          return;
        }
        setStatus(s => ({
          ...s,
          uploadState: 'uploading',
          lastMessage: `Saving ${inflight.name}…`,
        }));
        let wav: Uint8Array;
        try {
          wav = await captureBytesToWav(raw, inflight.format);
        } catch (err) {
          await sendStopCommand(session).catch(() => {});
          setStatus(s => ({
            ...s,
            uploadState: 'failed',
            lastMessage:
              err instanceof Error
                ? err.message
                : 'Could not decode capture audio.',
          }));
          setTimeout(() => {
            if (!cancelled) maybeStartDrain();
          }, 2000);
          return;
        }
        try {
          await saveDeviceCapture({ deviceName: inflight.name, wav });
          await acknowledgeCapture(session, inflight.name);
          onHardwareCaptureSaved();
          finishHardwareSync('Capture synced from Donna.');
        } catch (err) {
          await sendStopCommand(session).catch(() => {});
          setStatus(s => ({
            ...s,
            uploadState: 'failed',
            lastMessage:
              err instanceof Error
                ? err.message
                : 'Could not save capture on phone.',
          }));
          setTimeout(() => {
            if (!cancelled) maybeStartDrain();
          }, 2000);
          return;
        }
        scheduleCaptureUploads();
        if (!cancelled) maybeStartDrain();
        return;
      }
    };

    function scheduleReconnect(deviceId: string, delayMs: number) {
      if (cancelled) return;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        if (cancelled || sessionRef.current || connectingRef.current) return;
        getPairedDeviceId().then(id => {
          if (id === deviceId && !cancelled && !sessionRef.current) {
            connectToPaired(deviceId);
          }
        });
      }, delayMs);
    }

    function handleUnexpectedDisconnect(deviceId: string) {
      if (cancelled) return;
      sessionRef.current = null;
      clearBleStartPending();
      clearInflight();
      setStatus(s => ({
        ...s,
        connectionState: 'disconnected',
        uploadState: 'idle',
      }));
      // Re-issue the connect synchronously within the background wake window
      // iOS gives us for the disconnect event — a deferred timer may never
      // fire before the app is suspended again. On iOS `connectToDevice`
      // becomes a pending connection that the system completes in the
      // background (even with the phone locked) once the peripheral
      // advertises again.
      connectToPaired(deviceId);
    }

    async function connectToPaired(deviceId: string) {
      if (cancelled || connectingRef.current) return;
      connectingRef.current = true;
      setStatus(s => ({ ...s, connectionState: 'connecting' }));
      try {
        blePreferredRef.current = false;
        clearBleStartPending();
        const session = await startCaptureSession(deviceId, {
          onCaptureFrame: handleFrame,
          onStatus: handleStatus,
          onPendingCount: n => {
            setStatus(s => ({ ...s, pendingCount: n }));
            if (n > 0) maybeStartDrain();
          },
          onDisconnected: () => handleUnexpectedDisconnect(deviceId),
        });
        if (cancelled) {
          await session.disconnect().catch(() => {});
          return;
        }
        sessionRef.current = session;

        // Refresh SoftAP creds from the device on every connect — firmware flash
        // or NVS reset can rotate them without a full re-pair.
        const syncAp = await readSyncApCredentialsFromDevice(deviceId);
        if (syncAp) {
          await saveSyncApCredentials(deviceId, syncAp);
          console.log('[useDeviceSync] refreshed Wi-Fi sync credentials');
        } else {
          console.log(
            '[useDeviceSync] no CH_SYNC_AP on device — Wi-Fi sync unavailable',
          );
        }

        setStatus(s => ({
          ...s,
          connectionState: 'connected',
          pairedDeviceId: deviceId,
        }));
        maybeStartDrain();
      } catch (err) {
        if (cancelled) return;
        setStatus(s => ({
          ...s,
          connectionState: 'disconnected',
          lastMessage:
            err instanceof Error ? err.message : 'Device connect failed.',
        }));
        // Retry: covers transient failures (Bluetooth resetting, device mid-
        // boot). The retry itself becomes a background-safe pending connect.
        scheduleReconnect(deviceId, 5000);
      } finally {
        connectingRef.current = false;
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
    scheduleCaptureUploads();
    const uploadSub = onCaptureUploadComplete(result => {
      if (cancelled || result.uploaded === 0) return;
      setStatus(s => ({
        ...s,
        notesRefreshToken: s.notesRefreshToken + result.uploaded,
      }));
    });

    // Retry cloud uploads when the app returns to foreground.
    function handleAppStateChange(next: AppStateStatus) {
      if (next === 'active') {
        scheduleCaptureUploads();
        if (!sessionRef.current && !cancelled) {
          getPairedDeviceId().then(id => {
            if (id && !cancelled && !sessionRef.current) {
              connectToPaired(id);
            }
          });
        }
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
      if (bleStartTimerRef.current) {
        clearTimeout(bleStartTimerRef.current);
        bleStartTimerRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (statusClearTimerRef.current) {
        clearTimeout(statusClearTimerRef.current);
        statusClearTimerRef.current = null;
      }
      for (const w of statusWaitersRef.current) clearTimeout(w.timer);
      statusWaitersRef.current = [];
      sub.remove();
      uploadSub();
      authSub.data.subscription.unsubscribe();
      if (sessionRef.current) {
        sessionRef.current.disconnect().catch(() => {});
        sessionRef.current = null;
      }
    };
  }, []);

  async function disconnectForProvisioning() {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
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

  return {
    ...status,
    forgetDevice,
    disconnectForProvisioning,
    reconnectDevice,
  };
}

export async function listPairedDevices(): Promise<DeviceScan[]> {
  // Re-export the scan primitive so screens can use it without importing
  // the BLE module directly. (Serially scans + resolves after 5s.)
  return new Promise<DeviceScan[]>(resolve => {
    let latest: DeviceScan[] = [];
    const stop = scanForDonnaDevices(
      list => {
        latest = list;
      },
      () => {},
    );
    setTimeout(() => {
      stop();
      resolve(latest);
    }, 5000);
  });
}
