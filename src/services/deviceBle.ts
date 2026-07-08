/**
 * BLE peripheral client for the Donna capture device.
 *
 * Pairs with the ESP32 firmware's "Donna Capture" GATT service
 * (6e7c1c00-0000-1000-8000-00805f9b34fb). Handles:
 *   - scanning for "Donna Device"
 *   - storing the selected BLE peripheral id for reconnect
 *   - subscribing to the framed capture-data indication stream and
 *     reassembling it back into a WAV file
 *   - driving the capture control characteristic with start/stop/ack/delete commands
 *
 * The reassembled WAV bytes are delivered to the caller via a callback. The
 * caller saves them on-phone and acks the device; cloud upload is separate
 * (see localDeviceCaptures.ts and captureUploadQueue.ts).
 */

import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import AsyncStorage from '@react-native-async-storage/async-storage';

declare const atob: (data: string) => string;
declare const btoa: (data: string) => string;

export const DONNA_SERVICE_UUID = '6e7c1c00-0000-1000-8000-00805f9b34fb';
const CH_PENDING_COUNT = '6e7c1c00-0005-1000-8000-00805f9b34fb';
const CH_CAPTURE_DATA = '6e7c1c00-0006-1000-8000-00805f9b34fb';
const CH_CAPTURE_CTRL = '6e7c1c00-0007-1000-8000-00805f9b34fb';
const CH_STATUS = '6e7c1c00-0008-1000-8000-00805f9b34fb';
const CH_SYNC_AP = '6e7c1c00-0009-1000-8000-00805f9b34fb';

const PAIRED_DEVICE_ID_KEY = 'donna.pairedDeviceId.v1';
const CAPTURE_REQUEST_MTU = 185; // 182-byte ATT payload; firmware caps at 180.
const CAPTURE_CCCD_SETTLE_MS = 750;

const ble = new BleManager({
  restoreStateIdentifier: 'donna-ble-central-v1',
  restoreStateFunction: restoredState => {
    // iOS relaunched us in the background to hand back BLE peripherals.
    // useDeviceSync re-establishes the session on init; just log here.
    console.log(
      '[deviceBle] state restored, peripherals:',
      restoredState?.connectedPeripherals?.map(p => p.id) ?? [],
    );
  },
});

// ─── Types ────────────────────────────────────────────────────────────────

export type DeviceScan = {
  id: string; // iOS-facing peripheral identifier (UUID or MAC)
  name: string; // advertisement local name
  rssi: number;
};

export type DeviceStatus = {
  connectionState: 'disconnected' | 'connecting' | 'connected';
  pendingCount: number;
  status: string; // raw status string from the device
  pairedDeviceId: string | null;
};

export type CaptureFrame =
  | { kind: 'idle' } // 0x04 — no pending captures
  | { kind: 'header'; name: string; totalBytes: number; format: number } // 0x01
  | { kind: 'data'; bytes: Uint8Array } // 0x02
  | { kind: 'end'; name: string }; // 0x03

export type SyncApCredentials = {
  version: number;
  ssid: string;
  psk: string;
};

export type CaptureFrameHandler = (frame: CaptureFrame) => void;
export type StatusHandler = (status: string) => void;
export type PendingCountHandler = (count: number) => void;

// ─── Storage helpers ──────────────────────────────────────────────────────

export async function getPairedDeviceId(): Promise<string | null> {
  return AsyncStorage.getItem(PAIRED_DEVICE_ID_KEY);
}

export async function setPairedDeviceId(id: string | null): Promise<void> {
  if (id) await AsyncStorage.setItem(PAIRED_DEVICE_ID_KEY, id);
  else await AsyncStorage.removeItem(PAIRED_DEVICE_ID_KEY);
}

// ─── Scanning ──────────────────────────────────────────────────────────────

export function scanForDonnaDevices(
  onFound: (devices: DeviceScan[]) => void,
  onError?: (message: string) => void,
): () => void {
  let stopped = false;
  const found = new Map<string, DeviceScan>();

  ble.startDeviceScan([DONNA_SERVICE_UUID], null, (error, device) => {
    if (stopped) return;
    if (error) {
      onError?.(error.message ?? 'Scan failed.');
      return;
    }
    if (!device) return;
    const name = device.name ?? device.localName ?? 'Donna Device';
    found.set(device.id, { id: device.id, name, rssi: device.rssi ?? 0 });
    onFound(Array.from(found.values()));
  });

  return () => {
    if (stopped) return;
    stopped = true;
    ble.stopDeviceScan().catch(() => {});
  };
}

// ─── Connect / provision ──────────────────────────────────────────────────

/** Parse `relay_ready:<reason>:<count>` status strings from the device. */
export function parseRelayReady(
  status: string,
): { reason: string; count: number } | null {
  const match = /^relay_ready:([^:]+):(\d+)$/.exec(status.trim());
  if (!match) return null;
  const count = parseInt(match[2], 10);
  return { reason: match[1], count: Number.isFinite(count) ? count : 0 };
}

export function parseRelayProgress(
  status: string,
): { name: string; sent: number; total: number; percent: number } | null {
  const match = /^relay_progress:([^:]+):(\d+):(\d+)$/.exec(status.trim());
  if (!match) return null;
  const sent = parseInt(match[2], 10);
  const total = parseInt(match[3], 10);
  if (!Number.isFinite(sent) || !Number.isFinite(total) || total <= 0)
    return null;
  return {
    name: match[1],
    sent,
    total,
    percent: Math.max(0, Math.min(100, Math.floor((sent * 100) / total))),
  };
}

/** Parse `wifi_ap_ready:<ip>:<port>` from device status. */
export function parseWifiApReady(
  status: string,
): { ip: string; port: number } | null {
  const match = /^wifi_ap_ready:([^:]+):(\d+)$/.exec(status.trim());
  if (!match) return null;
  const port = parseInt(match[2], 10);
  if (!Number.isFinite(port) || port <= 0) return null;
  return { ip: match[1], port };
}

/** Firmware protocol statuses — consumed internally, not shown in the UI. */
export function isInternalDeviceStatus(status: string): boolean {
  const msg = status.trim();
  if (!msg) return true;
  if (msg === 'booting' || msg === 'wifi_ap_stopped') return true;
  if (msg.startsWith('wifi_ap_ready:')) return true;
  if (msg.startsWith('wifi_sync_fail:')) return true;
  if (msg.startsWith('relay_ready:') || msg.startsWith('relay_idle:'))
    return true;
  if (msg.startsWith('relay_progress:')) return true;
  if (msg.startsWith('pending:')) return true;
  return false;
}

export function parseSyncApJson(raw: string): SyncApCredentials | null {
  try {
    const parsed = JSON.parse(raw.trim()) as {
      v?: number;
      ssid?: string;
      psk?: string;
    };
    if (!parsed.ssid || !parsed.psk) return null;
    return {
      version: parsed.v ?? 1,
      ssid: parsed.ssid,
      psk: parsed.psk,
    };
  } catch {
    return null;
  }
}

async function connectForProvisioning(deviceId: string): Promise<Device> {
  // Drop any capture-sync session so provisioning owns the GATT link.
  await ble.cancelDeviceConnection(deviceId).catch(() => {});
  await delay(300);

  const connectMs = 15000;
  const device = await Promise.race([
    ble.connectToDevice(deviceId, { requestMTU: CAPTURE_REQUEST_MTU }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              'Timed out connecting to the device. Move closer and try again.',
            ),
          ),
        connectMs,
      ),
    ),
  ]);
  await device.discoverAllServicesAndCharacteristics();
  return device;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Pair over BLE and fetch Donna SoftAP credentials for tiered Wi-Fi sync. */
export async function connectAndPairBleOnly(
  deviceId: string,
  onStatus?: StatusHandler,
): Promise<SyncApCredentials | null> {
  const device = await connectForProvisioning(deviceId);
  let syncAp: SyncApCredentials | null = null;
  try {
    const statusChar = await device.readCharacteristicForService(
      DONNA_SERVICE_UUID,
      CH_STATUS,
    );
    onStatus?.(base64ToString(statusChar.value ?? ''));

    try {
      const apChar = await device.readCharacteristicForService(
        DONNA_SERVICE_UUID,
        CH_SYNC_AP,
      );
      if (apChar.value) {
        syncAp = parseSyncApJson(base64ToString(apChar.value));
      }
    } catch {
      // Older firmware without CH_SYNC_AP — Wi-Fi fast path unavailable.
    }
  } catch {
    // status read is best-effort
  }
  await device.cancelConnection();
  await setPairedDeviceId(deviceId);
  return syncAp;
}

/** Read Donna SoftAP credentials from a connected peripheral (refreshes after firmware updates). */
export async function readSyncApCredentialsFromDevice(
  deviceId: string,
): Promise<SyncApCredentials | null> {
  const devices = await ble.devices([deviceId]);
  const device = devices[0];
  if (!device) return null;
  try {
    const apChar = await device.readCharacteristicForService(
      DONNA_SERVICE_UUID,
      CH_SYNC_AP,
    );
    if (!apChar.value) return null;
    return parseSyncApJson(base64ToString(apChar.value));
  } catch {
    return null;
  }
}

// ─── Telemetry session ──────────────────────────────────────────────────────

export type CaptureSession = {
  deviceId: string;
  deviceName: string;
  disconnect: () => Promise<void>;
};

export async function startCaptureSession(
  deviceId: string,
  handlers: {
    onCaptureFrame: CaptureFrameHandler;
    onStatus?: StatusHandler;
    onPendingCount?: PendingCountHandler;
    /**
     * Fired when the BLE link drops unexpectedly (out of range, device reset,
     * phone locked long enough for supervision timeout). Not fired for
     * intentional disconnects via `session.disconnect()`.
     */
    onDisconnected?: () => void;
  },
): Promise<CaptureSession> {
  const device = await ble.connectToDevice(deviceId, {
    requestMTU: CAPTURE_REQUEST_MTU,
  });
  console.log(
    '[deviceBle] connected',
    deviceId,
    'mtu',
    device.mtu,
    'requested',
    CAPTURE_REQUEST_MTU,
  );
  await device.discoverAllServicesAndCharacteristics();
  console.log('[deviceBle] discovered services');

  const subs: Subscription[] = [];

  subs.push(
    device.onDisconnected(err => {
      console.log('[deviceBle] disconnected', deviceId, err?.message ?? '');
      handlers.onDisconnected?.();
    }),
  );

  // Status notifications
  subs.push(
    device.monitorCharacteristicForService(
      DONNA_SERVICE_UUID,
      CH_STATUS,
      (err, char) => {
        if (err) {
          console.log('[deviceBle] status monitor error', err.message);
          return;
        }
        if (!char?.value) return;
        handlers.onStatus?.(base64ToString(char.value));
      },
    ),
  );

  // Pending-count notifications
  subs.push(
    device.monitorCharacteristicForService(
      DONNA_SERVICE_UUID,
      CH_PENDING_COUNT,
      (err, char) => {
        if (err) {
          console.log('[deviceBle] pending monitor error', err.message);
          return;
        }
        if (!char?.value) return;
        const b = bytesFromBase64(char.value);
        handlers.onPendingCount?.(b[0] ?? 0);
      },
    ),
  );

  // Capture-data indications (framed)
  subs.push(
    device.monitorCharacteristicForService(
      DONNA_SERVICE_UUID,
      CH_CAPTURE_DATA,
      (err, char) => {
        if (err) {
          console.log('[deviceBle] capture monitor error', err.message);
          return;
        }
        if (!char?.value) return;
        const bytes = bytesFromBase64(char.value);
        if (bytes.length < 1) return;
        const marker = bytes[0];
        if (marker === 0x04) {
          handlers.onCaptureFrame({ kind: 'idle' });
        } else if (marker === 0x01) {
          // header: bytes 1..40 = name, 41..44 = total BE, 45 = format (optional)
          const name = decodeNullPaddedName(bytes.subarray(1, 41));
          let totalBytes = 0;
          let format = 0;
          if (bytes.length >= 45) {
            const parsed =
              ((bytes[41] << 24) >>> 0) +
              (bytes[42] << 16) +
              (bytes[43] << 8) +
              bytes[44];
            const legacyShifted =
              ((bytes[40] << 24) >>> 0) +
              (bytes[41] << 16) +
              (bytes[42] << 8) +
              bytes[43];
            totalBytes =
              parsed === legacyShifted * 256 ? legacyShifted : parsed;
          }
          if (bytes.length >= 46) format = bytes[45];
          console.log(
            '[deviceBle] capture header',
            name,
            totalBytes,
            'fmt',
            format,
          );
          handlers.onCaptureFrame({ kind: 'header', name, totalBytes, format });
        } else if (marker === 0x02) {
          handlers.onCaptureFrame({ kind: 'data', bytes: bytes.subarray(1) });
        } else if (marker === 0x03) {
          const name = decodeNullPaddedName(bytes.subarray(1, 41));
          console.log('[deviceBle] capture end', name);
          handlers.onCaptureFrame({ kind: 'end', name });
        }
      },
    ),
  );

  // Apply any status already on the characteristic (e.g. relay_ready emitted
  // before the subscription registered).
  try {
    const statusChar = await device.readCharacteristicForService(
      DONNA_SERVICE_UUID,
      CH_STATUS,
    );
    if (statusChar.value) {
      handlers.onStatus?.(base64ToString(statusChar.value));
    }
  } catch {
    // best-effort
  }

  try {
    const pendingChar = await device.readCharacteristicForService(
      DONNA_SERVICE_UUID,
      CH_PENDING_COUNT,
    );
    if (pendingChar.value) {
      const b = bytesFromBase64(pendingChar.value);
      handlers.onPendingCount?.(b[0] ?? 0);
    }
  } catch {
    // best-effort
  }

  // iOS can return the monitor subscription before the peripheral has fully
  // processed the capture-data CCCD write. If we send `start` too soon, the
  // device can indicate the header before the app receives indications, which
  // leaves sync sitting at 0 until retry.
  await delay(CAPTURE_CCCD_SETTLE_MS);

  return {
    deviceId,
    deviceName: device.name ?? 'Donna Device',
    disconnect: async () => {
      subs.forEach(s => s.remove());
      try {
        await device.cancelConnection();
      } catch {
        /* ignore */
      }
    },
  };
}

/** Tell the device to send the next pending capture (or re-stream after a client timeout). */
export async function sendStartCommand(session: CaptureSession): Promise<void> {
  const device = await ble.devices([session.deviceId]);
  const d = device[0];
  if (!d) throw new Error('No such device in manager');
  await d.writeCharacteristicWithResponseForService(
    DONNA_SERVICE_UUID,
    CH_CAPTURE_CTRL,
    base64FromBytes(stringToBytes('start')),
  );
}

export async function sendStopCommand(session: CaptureSession): Promise<void> {
  const device = await ble.devices([session.deviceId]);
  const d = device[0];
  if (!d) throw new Error('No such device in manager');
  await d.writeCharacteristicWithResponseForService(
    DONNA_SERVICE_UUID,
    CH_CAPTURE_CTRL,
    base64FromBytes(stringToBytes('stop')),
  );
}

export async function acknowledgeCapture(
  session: CaptureSession,
  name: string,
): Promise<void> {
  const device = await ble.devices([session.deviceId]);
  const d = device[0];
  if (!d) throw new Error('No such device in manager');
  await d.writeCharacteristicWithResponseForService(
    DONNA_SERVICE_UUID,
    CH_CAPTURE_CTRL,
    base64FromBytes(stringToBytes(`ack ${name}`)),
  );
}

export async function deleteCapture(
  session: CaptureSession,
  name: string,
): Promise<void> {
  const device = await ble.devices([session.deviceId]);
  const d = device[0];
  if (!d) throw new Error('No such device in manager');
  await d.writeCharacteristicWithResponseForService(
    DONNA_SERVICE_UUID,
    CH_CAPTURE_CTRL,
    base64FromBytes(stringToBytes(`delete ${name}`)),
  );
}

export async function sendWifiSyncCommand(
  session: CaptureSession,
): Promise<void> {
  const device = await ble.devices([session.deviceId]);
  const d = device[0];
  if (!d) throw new Error('No such device in manager');
  await d.writeCharacteristicWithResponseForService(
    DONNA_SERVICE_UUID,
    CH_CAPTURE_CTRL,
    base64FromBytes(stringToBytes('wifi_sync')),
  );
}

export async function sendWifiStopCommand(
  session: CaptureSession,
): Promise<void> {
  const device = await ble.devices([session.deviceId]);
  const d = device[0];
  if (!d) throw new Error('No such device in manager');
  await d.writeCharacteristicWithResponseForService(
    DONNA_SERVICE_UUID,
    CH_CAPTURE_CTRL,
    base64FromBytes(stringToBytes('wifi_stop')),
  );
}

// ─── Tiny base64 + bytes utilities ─────────────────────────────────────────

export function bytesFromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function base64FromBytes(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function base64ToString(b64: string): string {
  const b = bytesFromBase64(b64);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  // Strip trailing nulls (we use null-padded payloads on the device side too).
  return s.replace(/\u0000+$/, '');
}

function stringToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

function decodeNullPaddedName(bytes: Uint8Array): string {
  let len = bytes.length;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) {
      len = i;
      break;
    }
  }
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[i]);
  return s.trim();
}
