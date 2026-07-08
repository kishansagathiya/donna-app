# Donna Device Sync — manual test matrix

Flash updated firmware from `donna-hardware` before testing the BLE capture path.
The app sync path is Bluetooth-only; the old Wi-Fi SoftAP path is no longer part
of normal app sync.

## Prerequisites

- iPhone with the latest Donna app build
- Donna device with the BLE notification relay firmware
- Bluetooth on, signed into Donna
- Do **not** force-quit the app between tests

## 1. Pairing

1. Profile → Pair device → select Donna Device
2. Confirm success screen mentions automatic Bluetooth sync
3. Re-open Profile — device shows paired

**Pass:** Pairing completes without SSID/password prompts.

## 2. Foreground BLE sync

1. Record ~30s on Donna (REC → release)
2. Keep Donna app open in foreground
3. Wait for sync

**Pass:** Profile shows `ble` sync path; note appears quickly.

## 3. Locked-phone BLE reconnect

1. Record on Donna
2. Lock iPhone with the app in the background
3. Wait 1–3 min

**Pass:** Note appears without unlocking, or sync resumes automatically when the
phone and device reconnect.

## 4. Multiple pending notes

1. Record three notes while the phone is away or locked
2. Bring the phone near Donna and open the app
3. Wait for all pending notes to drain

**Pass:** All notes sync once, pending count reaches zero, no duplicates appear.

## 5. Out of range mid-sync

1. Start sync with a long recording
2. Walk out of Bluetooth range briefly, then return

**Pass:** Capture stays on device; sync retries; no duplicate notes.

## 6. Forget device

1. Profile → Forget device
2. Pair again

**Pass:** The app reconnects to the new paired peripheral and BLE sync resumes.

## 7. Opus BLE path (firmware with libopus)

1. Record on device; wait for encode if enabled
2. Sync over Bluetooth

**Pass:** Shorter BLE transfer vs raw WAV on the same-length clip.
