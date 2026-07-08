# Tiered Donna Sync — manual test matrix

Flash updated firmware from `donna-hardware` before testing Wi-Fi / Opus paths.

## Prerequisites

- iPhone with Donna app build 42+
- Donna device with tiered-sync firmware
- Bluetooth on, signed into Donna
- Do **not** force-quit the app between tests

## 1. Pairing (no Wi-Fi password)

1. Profile → Pair device → select Donna Device
2. Confirm success screen mentions automatic sync
3. Re-open Profile — device shows paired

**Pass:** No SSID/password fields; pairing completes.

## 2. Foreground Wi-Fi fast sync

1. Record ~30s on Donna (REC → release)
2. Keep Donna app **open** in foreground
3. Wait for sync

**Pass:** Profile shows `wifi` sync path; note appears in &lt;15s.

## 3. Locked-phone BLE fallback

1. Record on Donna
2. **Lock iPhone** (app in background)
3. Wait 1–3 min

**Pass:** Note appears without unlocking; may show `ble` path when app reopened.

## 4. Wi-Fi join dismissed

1. Record on Donna with app open
2. If iOS shows “Join network” / “No internet”, tap **Cancel**
3. Wait

**Pass:** Sync still completes via BLE (slower).

## 5. Out of range mid-sync

1. Start sync with a long recording
2. Walk out of Bluetooth range briefly, return

**Pass:** Capture stays on device; sync retries; no duplicate notes.

## 6. Forget device

1. Profile → Forget device
2. Pair again

**Pass:** Old Wi-Fi creds cleared; re-pair fetches new SoftAP password.

## 7. Opus BLE path (firmware with libopus)

1. Record on device; wait for encode (few seconds on device)
2. Lock phone or dismiss Wi-Fi join
3. Sync over BLE

**Pass:** Shorter BLE transfer vs raw WAV on same-length clip.
