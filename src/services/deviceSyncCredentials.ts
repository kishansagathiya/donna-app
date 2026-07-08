/**
 * Secure storage for Donna device Wi-Fi sync credentials (SoftAP SSID/PSK).
 * Received over BLE at pairing from CH_SYNC_AP — never typed by the user.
 */

import * as Keychain from 'react-native-keychain';
import { getPairedDeviceId } from './deviceBle';

const SERVICE = 'donna.device.sync-ap.v1';

export type DeviceSyncApCredentials = {
  deviceId: string;
  ssid: string;
  psk: string;
  version: number;
};

function keyForDevice(deviceId: string): string {
  return `${SERVICE}.${deviceId}`;
}

export async function saveSyncApCredentials(
  deviceId: string,
  creds: { ssid: string; psk: string; version?: number },
): Promise<void> {
  const payload: DeviceSyncApCredentials = {
    deviceId,
    ssid: creds.ssid,
    psk: creds.psk,
    version: creds.version ?? 1,
  };
  await Keychain.setGenericPassword(deviceId, JSON.stringify(payload), {
    service: keyForDevice(deviceId),
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
  });
}

export async function getSyncApCredentials(
  deviceId?: string | null,
): Promise<DeviceSyncApCredentials | null> {
  const id = deviceId ?? await getPairedDeviceId();
  if (!id) return null;
  const entry = await Keychain.getGenericPassword({ service: keyForDevice(id) });
  if (!entry) return null;
  try {
    const parsed = JSON.parse(entry.password) as DeviceSyncApCredentials;
    if (!parsed.ssid || !parsed.psk) return null;
    return { ...parsed, deviceId: id };
  } catch {
    return null;
  }
}

export async function clearSyncApCredentials(deviceId?: string | null): Promise<void> {
  const id = deviceId ?? await getPairedDeviceId();
  if (!id) return;
  await Keychain.resetGenericPassword({ service: keyForDevice(id) });
}
