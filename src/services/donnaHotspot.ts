import { NativeModules, Platform } from 'react-native';

type DonnaHotspotNative = {
  join(ssid: string, psk: string): Promise<boolean>;
  leave(ssid: string): Promise<boolean>;
  requestLocalNetwork(): Promise<boolean>;
};

const Native = NativeModules.DonnaHotspot as DonnaHotspotNative | undefined;

/** Trigger the iOS local-network permission prompt (required for 192.168.4.1 HTTP). */
export async function requestLocalNetworkAccess(): Promise<void> {
  if (Platform.OS !== 'ios' || !Native?.requestLocalNetwork) return;
  await Native.requestLocalNetwork();
}

export async function joinDonnaHotspot(ssid: string, psk: string): Promise<boolean> {
  if (Platform.OS !== 'ios' || !Native?.join) {
    throw new Error('Wi-Fi sync is only supported on iOS.');
  }
  return Native.join(ssid, psk);
}

export async function leaveDonnaHotspot(ssid: string): Promise<void> {
  if (Platform.OS !== 'ios' || !Native?.leave) return;
  await Native.leave(ssid).catch(() => {});
}
