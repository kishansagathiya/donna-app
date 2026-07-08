/**
 * Fast capture sync over Donna's short-lived SoftAP (HTTP on 192.168.4.1:8080).
 * BLE stays connected for control; bulk data moves over local Wi-Fi.
 *
 * Hardware sync ends when captures are saved on the phone and acked on the
 * device. Cloud upload is handled separately by captureUploadQueue.ts.
 */

import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  type CaptureSession,
  acknowledgeCapture,
  bytesFromBase64,
  parseWifiApReady,
  sendWifiStopCommand,
  sendWifiSyncCommand,
} from './deviceBle';
import { getSyncApCredentials } from './deviceSyncCredentials';
import {
  joinDonnaHotspot,
  leaveDonnaHotspot,
  requestLocalNetworkAccess,
} from './donnaHotspot';
import { saveDeviceCapture } from './localDeviceCaptures';

export type WifiCaptureMeta = {
  name: string;
  bytes: number;
  created_utc: number;
  format: string;
};

const AP_READY_TIMEOUT_MS = 15000;
const AP_BEACON_SETTLE_MS = 2500;
const HTTP_TIMEOUT_MS = 60000;
const HTTP_PROBE_TIMEOUT_MS = 8000;
const HTTP_PROBE_ATTEMPTS = 8;
const WIFI_AP_STOP_TIMEOUT_MS = 8000;
const HTTP_PROBE_RETRY_MS = 1500;
const HOTSPOT_JOIN_ATTEMPTS = 2;
const HOTSPOT_JOIN_RETRY_MS = 1500;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(() => resolve(), ms));
}

function waitForWifiApReady(
  waitStatus: (
    predicate: (msg: string) => boolean,
    timeoutMs: number,
  ) => Promise<string | null>,
): Promise<{ ip: string; port: number }> {
  return waitStatus(
    msg => parseWifiApReady(msg) !== null,
    AP_READY_TIMEOUT_MS,
  ).then(msg => {
    const ready = msg ? parseWifiApReady(msg) : null;
    if (!ready) throw new Error('Timed out waiting for Donna Wi-Fi sync.');
    return ready;
  });
}

async function fetchCaptureList(baseUrl: string): Promise<WifiCaptureMeta[]> {
  const res = await ReactNativeBlobUtil.config({
    timeout: HTTP_PROBE_TIMEOUT_MS,
  }).fetch('GET', `${baseUrl}/captures`);
  const status = res.info().status;
  if (status !== 200) throw new Error(`Device list failed (${status}).`);
  const text = await Promise.resolve(res.text());
  const json = JSON.parse(text) as WifiCaptureMeta[];
  return Array.isArray(json) ? json : [];
}

async function fetchCaptureListWithRetry(
  baseUrl: string,
): Promise<WifiCaptureMeta[]> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= HTTP_PROBE_ATTEMPTS; attempt++) {
    try {
      console.log(
        `[deviceWifiSync] probing ${baseUrl}/captures (${attempt}/${HTTP_PROBE_ATTEMPTS})`,
      );
      return await fetchCaptureList(baseUrl);
    } catch (err) {
      lastError =
        err instanceof Error ? err : new Error('Could not reach Donna device.');
      console.log(
        '[deviceWifiSync] device HTTP probe failed',
        lastError.message,
      );
      if (attempt < HTTP_PROBE_ATTEMPTS) {
        await delay(HTTP_PROBE_RETRY_MS);
      }
    }
  }
  throw new Error(
    `${lastError?.message ?? 'Could not reach Donna device.'} ` +
      'Check Settings → Donna → Local Network is enabled.',
  );
}

async function downloadCapture(
  baseUrl: string,
  name: string,
): Promise<Uint8Array> {
  const res = await ReactNativeBlobUtil.config({
    timeout: HTTP_TIMEOUT_MS,
  }).fetch('GET', `${baseUrl}/captures/${encodeURIComponent(name)}`);
  const status = res.info().status;
  if (status !== 200)
    throw new Error(`Download failed for ${name} (${status}).`);
  const b64 = await Promise.resolve(res.base64());
  return bytesFromBase64(b64);
}

async function joinDonnaHotspotBestEffort(
  ssid: string,
  psk: string,
): Promise<boolean> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= HOTSPOT_JOIN_ATTEMPTS; attempt++) {
    try {
      console.log(
        `[deviceWifiSync] joining hotspot ${ssid} (attempt ${attempt}/${HOTSPOT_JOIN_ATTEMPTS})`,
      );
      await joinDonnaHotspot(ssid, psk);
      return true;
    } catch (err) {
      lastError =
        err instanceof Error ? err : new Error('Could not join Donna Wi-Fi.');
      console.log('[deviceWifiSync] hotspot join failed', lastError.message);
      if (attempt < HOTSPOT_JOIN_ATTEMPTS) {
        await delay(HOTSPOT_JOIN_RETRY_MS);
      }
    }
  }
  console.log(
    '[deviceWifiSync] join API failed, will try HTTP anyway:',
    lastError?.message,
  );
  return false;
}

export type WifiSyncProgress = {
  phase: 'joining' | 'downloading' | 'saving';
  captureName?: string;
  index?: number;
  total?: number;
};

export type WifiSyncOutcome = {
  /** Captures saved on phone and acked on device. */
  synced: number;
};

/**
 * Run Wi-Fi fast sync for all pending captures. Returns null if credentials
 * are missing (caller should fall back to BLE).
 */
export async function runWifiCaptureSync(
  session: CaptureSession,
  opts: {
    waitStatus: (
      predicate: (msg: string) => boolean,
      timeoutMs: number,
    ) => Promise<string | null>;
    onProgress?: (p: WifiSyncProgress) => void;
    /** Called after each capture is saved on-phone and acked on the device. */
    onCaptureSaved?: (deviceName: string) => void;
  },
): Promise<WifiSyncOutcome | null> {
  const creds = await getSyncApCredentials(session.deviceId);
  if (!creds) return null;

  let synced = 0;
  let joinedViaApi = false;
  try {
    await sendWifiSyncCommand(session);
    const ap = await waitForWifiApReady(opts.waitStatus);
    const baseUrl = `http://${ap.ip}:${ap.port}`;

    await delay(AP_BEACON_SETTLE_MS);
    opts.onProgress?.({ phase: 'joining' });
    await requestLocalNetworkAccess();

    let list: WifiCaptureMeta[];
    try {
      list = await fetchCaptureListWithRetry(baseUrl);
    } catch (probeErr) {
      joinedViaApi = await joinDonnaHotspotBestEffort(creds.ssid, creds.psk);
      await delay(joinedViaApi ? 800 : 1500);
      list = await fetchCaptureListWithRetry(baseUrl);
      if (!joinedViaApi && list.length === 0) {
        throw probeErr instanceof Error
          ? probeErr
          : new Error('Could not reach Donna device.');
      }
    }

    if (list.length === 0) return { synced: 0 };

    for (let i = 0; i < list.length; i++) {
      const cap = list[i];
      opts.onProgress?.({
        phase: 'downloading',
        captureName: cap.name,
        index: i + 1,
        total: list.length,
      });
      const wav = await downloadCapture(baseUrl, cap.name);
      console.log(
        `[deviceWifiSync] downloaded ${cap.name} (${wav.length} bytes)`,
      );

      opts.onProgress?.({
        phase: 'saving',
        captureName: cap.name,
        index: i + 1,
        total: list.length,
      });
      const createdAt =
        cap.created_utc > 0
          ? new Date(cap.created_utc * 1000).toISOString()
          : undefined;
      await saveDeviceCapture({ deviceName: cap.name, wav, createdAt });
      await acknowledgeCapture(session, cap.name);
      synced++;
      opts.onCaptureSaved?.(cap.name);
      console.log(`[deviceWifiSync] saved and acked ${cap.name}`);
    }
  } finally {
    const stopped = opts.waitStatus(
      msg => msg.includes('wifi_ap_stopped'),
      WIFI_AP_STOP_TIMEOUT_MS,
    );
    await sendWifiStopCommand(session).catch(() => {});
    await stopped.catch(() => null);
    if (joinedViaApi) await leaveDonnaHotspot(creds.ssid);
  }

  return { synced };
}
