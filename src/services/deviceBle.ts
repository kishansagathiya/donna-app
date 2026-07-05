/**
 * BLE peripheral client for the Donna capture device.
 *
 * Pairs with the ESP32 firmware's "Donna Capture" GATT service
 * (6e7c1c00-0000-1000-8000-00805f9b34fb). Handles:
 *   - scanning for "Donna Device"
 *   - reading/writing provisioning characteristics (Wi-Fi SSID/PSK, JWT,
 *     refresh token — JWT/refresh are sent in chunked writes with a marker
 *     byte: 0x01 = continuation, 0x02 = final, 0x00 = reset). Each SSID+PSK
 *     pair is added to the device's saved network list (up to DONNA_WIFI_MAX_NETS);
 *     the device reports `wifi_saved:N` on success.
 *   - subscribing to the framed capture-data indication stream and
 *     reassembling it back into a WAV file
 *   - driving the capture control characteristic with start/ack/delete commands
 *
 * The reassembled WAV bytes are delivered to the caller via a callback. The
 * caller is responsible for uploading them (see src/services/capturesApi.ts).
 */

import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DONNA_SERVICE_UUID        = '6e7c1c00-0000-1000-8000-00805f9b34fb';
export const DONNA_WIFI_MAX_NETS         = 5;
const CH_WIFI_SSID                     = '6e7c1c00-0001-1000-8000-00805f9b34fb';
const CH_WIFI_PSK                      = '6e7c1c00-0002-1000-8000-00805f9b34fb';
const CH_JWT                          = '6e7c1c00-0003-1000-8000-00805f9b34fb';
const CH_REFRESH                       = '6e7c1c00-0004-1000-8000-00805f9b34fb';
const CH_PENDING_COUNT                 = '6e7c1c00-0005-1000-8000-00805f9b34fb';
const CH_CAPTURE_DATA                  = '6e7c1c00-0006-1000-8000-00805f9b34fb';
const CH_CAPTURE_CTRL                  = '6e7c1c00-0007-1000-8000-00805f9b34fb';
const CH_STATUS                        = '6e7c1c00-0008-1000-8000-00805f9b34fb';

const PAIRED_DEVICE_ID_KEY             = 'donna.pairedDeviceId.v1';

// BLE chunked write payload cap (per single Write Request). Leave room for the
// 1-byte marker prefix.
const BLE_CHUNK_WRITE_BYTES            = 200;

const ble = new BleManager();

// ─── Types ────────────────────────────────────────────────────────────────

export type DeviceScan = {
  id: string;            // iOS-facing peripheral identifier (UUID or MAC)
  name: string;          // advertisement local name
  rssi: number;
};

export type DeviceStatus = {
  connectionState: 'disconnected' | 'connecting' | 'connected';
  pendingCount: number;
  status: string;          // raw status string from the device
  pairedDeviceId: string | null;
};

export type CaptureFrame =
  | { kind: 'idle' }                                                 // 0x04 — no pending captures
  | { kind: 'header'; name: string; totalBytes: number }             // 0x01
  | { kind: 'data'; bytes: Uint8Array }                              // 0x02
  | { kind: 'end'; name: string };                                   // 0x03

export type CaptureFrameHandler = (frame: CaptureFrame) => void;
export type StatusHandler = (status: string) => void;
export type PendingCountHandler = (count: number) => void;

// ─── Storage helpers ──────────────────────────────────────────────────────

export async function getPairedDeviceId(): Promise<string | null> {
  return AsyncStorage.getItem(PAIRED_DEVICE_ID_KEY);
}

export async function setPairedDeviceId(id: string | null): Promise<void> {
  if (id) await AsyncStorage.setItem(PAIRED_DEVICE_ID_KEY, id);
  else    await AsyncStorage.removeItem(PAIRED_DEVICE_ID_KEY);
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

export type ProvisionRequest = {
  wifiSsid: string;
  wifiPsk: string;
  jwt: string;
  refreshToken: string;
};

export type WifiProvisionResult = {
  networkCount: number;
  status: string;
};

/** Parse `wifi_saved` or `wifi_saved:N` status strings from the device. */
export function parseWifiSavedCount(status: string): number | null {
  if (status === 'wifi_saved') return 1;
  const match = /^wifi_saved:(\d+)$/.exec(status.trim());
  return match ? parseInt(match[1], 10) : null;
}

async function waitForDeviceStatus(
  device: Device,
  predicate: (status: string) => boolean,
  timeoutMs = 12000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      sub.remove();
      reject(new Error('Timed out waiting for the device to respond.'));
    }, timeoutMs);

    const sub = device.monitorCharacteristicForService(
      DONNA_SERVICE_UUID, CH_STATUS,
      (err, char) => {
        if (settled || err || !char?.value) return;
        const status = base64ToString(char.value);
        if (predicate(status)) {
          settled = true;
          clearTimeout(timer);
          sub.remove();
          resolve(status);
        }
      },
    );
  });
}

async function writeWifiCredentials(
  device: Device,
  ssid: string,
  psk: string,
  onStatus?: StatusHandler,
): Promise<WifiProvisionResult> {
  const statusPromise = waitForDeviceStatus(
    device,
    (s) => parseWifiSavedCount(s) !== null || s === 'wifi_fail',
  );

  // SSID then PSK — the device commits once both halves arrive.
  await writeStringAsBytes(device, CH_WIFI_SSID, ssid);
  await writeStringAsBytes(device, CH_WIFI_PSK, psk);

  const status = await statusPromise;
  onStatus?.(status);
  if (status === 'wifi_fail') {
    throw new Error('The device could not save this Wi-Fi network.');
  }
  const networkCount = parseWifiSavedCount(status);
  if (networkCount === null) {
    throw new Error(`Unexpected device status: ${status}`);
  }
  return { networkCount, status };
}

async function writeStringAsBytes(device: Device, charUuid: string, value: string): Promise<void> {
  const char = await device.writeCharacteristicWithResponseForService(
    DONNA_SERVICE_UUID, charUuid,
    base64FromBytes(stringToBytes(value)),
  );
  void char;
}

async function writeChunkedToken(device: Device, charUuid: string, token: string): Promise<void> {
  // First byte is a marker:
  //   0x01 = continuation chunk
  //   0x02 = final chunk
  const bytes = stringToBytes(token);
  let offset = 0;
  const chunkSize = BLE_CHUNK_WRITE_BYTES - 1;
  while (offset < bytes.length) {
    const isFinal = offset + chunkSize >= bytes.length;
    const end = isFinal ? bytes.length : offset + chunkSize;
    const chunk = new Uint8Array(end - offset + 1);
    chunk[0] = isFinal ? 0x02 : 0x01;
    chunk.set(bytes.subarray(offset, end), 1);
    await device.writeCharacteristicWithResponseForService(
      DONNA_SERVICE_UUID, charUuid,
      base64FromBytes(chunk),
    );
    offset = end;
  }
  // Edge case: the token is empty. Send a single final empty chunk so the
  // device commits (length 0 → saveFn(empty) on the device).
  if (bytes.length === 0) {
    const chunk = new Uint8Array([0x02]);
    await device.writeCharacteristicWithResponseForService(
      DONNA_SERVICE_UUID, charUuid,
      base64FromBytes(chunk),
    );
  }
}

export async function connectAndProvision(
  deviceId: string,
  provision: ProvisionRequest,
  onStatus?: StatusHandler,
): Promise<WifiProvisionResult> {
  const device = await ble.connectToDevice(deviceId, { requestMTU: 247 });
  await device.discoverAllServicesAndCharacteristics();

  const wifiResult = await writeWifiCredentials(
    device,
    provision.wifiSsid,
    provision.wifiPsk,
    onStatus,
  );

  // JWT and refresh are sent in chunked writes with a final marker byte.
  await writeChunkedToken(device, CH_JWT,     provision.jwt);
  await writeChunkedToken(device, CH_REFRESH, provision.refreshToken);

  try {
    const statusChar = await device.readCharacteristicForService(
      DONNA_SERVICE_UUID, CH_STATUS,
    );
    onStatus?.(base64ToString(statusChar.value ?? ''));
  } catch {
    // status read is best-effort
  }
  await device.cancelConnection();
  await setPairedDeviceId(deviceId);
  return wifiResult;
}

/** Add a Wi-Fi network to an already-paired device (no JWT re-provisioning). */
export async function provisionWifiNetwork(
  deviceId: string,
  wifiSsid: string,
  wifiPsk: string,
  onStatus?: StatusHandler,
): Promise<WifiProvisionResult> {
  const device = await ble.connectToDevice(deviceId, { requestMTU: 247 });
  await device.discoverAllServicesAndCharacteristics();
  try {
    return await writeWifiCredentials(device, wifiSsid, wifiPsk, onStatus);
  } finally {
    await device.cancelConnection().catch(() => {});
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
  },
): Promise<CaptureSession> {
  const device = await ble.connectToDevice(deviceId, { requestMTU: 247 });
  await device.discoverAllServicesAndCharacteristics();

  const subs: Subscription[] = [];

  // Status notifications
  subs.push(
    device.monitorCharacteristicForService(
      DONNA_SERVICE_UUID, CH_STATUS,
      (err, char) => {
        if (err || !char?.value) return;
        handlers.onStatus?.(base64ToString(char.value));
      },
    ),
  );

  // Pending-count notifications
  subs.push(
    device.monitorCharacteristicForService(
      DONNA_SERVICE_UUID, CH_PENDING_COUNT,
      (err, char) => {
        if (err || !char?.value) return;
        const b = bytesFromBase64(char.value);
        handlers.onPendingCount?.(b[0] ?? 0);
      },
    ),
  );

  // Capture-data indications (framed)
  subs.push(
    device.monitorCharacteristicForService(
      DONNA_SERVICE_UUID, CH_CAPTURE_DATA,
      (err, char) => {
        if (err || !char?.value) return;
        const bytes = bytesFromBase64(char.value);
        if (bytes.length < 1) return;
        const marker = bytes[0];
        if (marker === 0x04) {
          handlers.onCaptureFrame({ kind: 'idle' });
        } else if (marker === 0x01) {
          // header: bytes 1..40 = name (null-padded), bytes 41..44 = uint32 BE total bytes
          const name = decodeNullPaddedName(bytes.subarray(1, 41));
          let totalBytes = 0;
          if (bytes.length >= 45) {
            totalBytes =
              (bytes[41] << 24) | (bytes[42] << 16) | (bytes[43] << 8) | bytes[44];
          }
          handlers.onCaptureFrame({ kind: 'header', name, totalBytes });
        } else if (marker === 0x02) {
          handlers.onCaptureFrame({ kind: 'data', bytes: bytes.subarray(1) });
        } else if (marker === 0x03) {
          const name = decodeNullPaddedName(bytes.subarray(1, 41));
          handlers.onCaptureFrame({ kind: 'end', name });
        }
      },
    ),
  );

  // Kick off the first batch.
  await device.writeCharacteristicWithResponseForService(
    DONNA_SERVICE_UUID, CH_CAPTURE_CTRL,
    base64FromBytes(stringToBytes('start')),
  );

  return {
    deviceId,
    deviceName: device.name ?? 'Donna Device',
    disconnect: async () => {
      subs.forEach(s => s.remove());
      try { await device.cancelConnection(); } catch { /* ignore */ }
    },
  };
}

/** Tell the device to send the next pending capture (or re-stream after a client timeout). */
export async function sendStartCommand(session: CaptureSession): Promise<void> {
  const device = await ble.devices([session.deviceId]);
  const d = device[0];
  if (!d) throw new Error('No such device in manager');
  await d.writeCharacteristicWithResponseForService(
    DONNA_SERVICE_UUID, CH_CAPTURE_CTRL,
    base64FromBytes(stringToBytes('start')),
  );
}

export async function acknowledgeCapture(session: CaptureSession, name: string): Promise<void> {
  const device = await ble.devices([session.deviceId]);
  const d = device[0];
  if (!d) throw new Error('No such device in manager');
  await d.writeCharacteristicWithResponseForService(
    DONNA_SERVICE_UUID, CH_CAPTURE_CTRL,
    base64FromBytes(stringToBytes(`ack ${name}`)),
  );
}

export async function deleteCapture(session: CaptureSession, name: string): Promise<void> {
  const device = await ble.devices([session.deviceId]);
  const d = device[0];
  if (!d) throw new Error('No such device in manager');
  await d.writeCharacteristicWithResponseForService(
    DONNA_SERVICE_UUID, CH_CAPTURE_CTRL,
    base64FromBytes(stringToBytes(`delete ${name}`)),
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
    if (bytes[i] === 0) { len = i; break; }
  }
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[i]);
  return s.trim();
}