/**
 * PairDeviceScreen — scans for nearby Donna Devices over BLE, lets the user
 * pick one, enters the Wi-Fi SSID/PSK + (auto-filled from session) JWT and
 * refresh token, and writes them to the device via connectAndProvision().
 *
 * Also supports an "add-wifi" mode for already-paired devices: the user enters
 * another SSID/PSK and the app calls provisionWifiNetwork() without
 * re-sending auth tokens. The device stores up to DONNA_WIFI_MAX_NETS networks
 * and tries them in order on connect.
 *
 * Pairing stores the chosen device's peripheral id in AsyncStorage so the
 * global useDeviceSync hook auto-reconnects on subsequent app launches.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { ThemeColors } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';
import {
  DONNA_WIFI_MAX_NETS,
  type DeviceScan,
  scanForDonnaDevices,
  connectAndProvision,
  provisionWifiNetwork,
} from '../services/deviceBle';

type Phase = 'scanning' | 'ready' | 'pairing' | 'done';

type PairDeviceScreenProps = {
  onClose: () => void;
  /** Full pairing (default) or add another Wi-Fi network to a paired device. */
  mode?: 'pair' | 'add-wifi';
  /** Required when mode is 'add-wifi'. */
  pairedDeviceId?: string | null;
};

export function PairDeviceScreen({
  onClose,
  mode = 'pair',
  pairedDeviceId = null,
}: PairDeviceScreenProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { session } = useAuth();
  const isAddWifi = mode === 'add-wifi';

  const [phase, setPhase] = useState<Phase>(isAddWifi ? 'ready' : 'scanning');
  const [devices, setDevices] = useState<DeviceScan[]>([]);
  const [selected, setSelected] = useState<DeviceScan | null>(null);
  const [savedDeviceId, setSavedDeviceId] = useState<string | null>(
    isAddWifi ? (pairedDeviceId ?? null) : null,
  );
  const [wifiOnly, setWifiOnly] = useState(isAddWifi);
  const [savedNetworkCount, setSavedNetworkCount] = useState<number | null>(
    null,
  );
  const [ssid, setSsid] = useState('');
  const [psk, setPsk] = useState('');
  const [status, setStatus] = useState<string>('');
  const stopScanRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (phase !== 'scanning' || isAddWifi) return;
    const stop = scanForDonnaDevices(
      list => setDevices(list),
      msg => setStatus(`Scan: ${msg}`),
    );
    stopScanRef.current = stop;
    return () => stop();
  }, [phase, isAddWifi]);

  async function handleSubmit() {
    if (!ssid.trim() || !psk) {
      Alert.alert('Missing info', 'Enter your Wi-Fi name and password.');
      return;
    }

    if (wifiOnly) {
      const deviceId = isAddWifi ? pairedDeviceId : savedDeviceId;
      if (!deviceId) {
        Alert.alert(
          'No device',
          'Pair a device first before adding Wi-Fi networks.',
        );
        return;
      }
      setPhase('pairing');
      setStatus('Saving Wi-Fi…');
      try {
        const result = await provisionWifiNetwork(
          deviceId,
          ssid.trim(),
          psk,
          s => setStatus(s || ''),
        );
        setSavedNetworkCount(result.networkCount);
        setStatus(
          `Saved (${result.networkCount} network${result.networkCount === 1 ? '' : 's'} stored).`,
        );
        setPhase('done');
      } catch (err) {
        Alert.alert(
          'Could not save Wi-Fi',
          err instanceof Error ? err.message : 'Please try again.',
        );
        setPhase('ready');
      }
      return;
    }

    if (!selected) {
      Alert.alert(
        'Missing info',
        'Pick a device and enter your Wi-Fi name and password.',
      );
      return;
    }
    if (!session) {
      Alert.alert('Not signed in', 'Please sign in before pairing.');
      return;
    }
    setPhase('pairing');
    setStatus('Pairing…');
    try {
      const result = await connectAndProvision(
        selected.id,
        {
          wifiSsid: ssid.trim(),
          wifiPsk: psk,
          jwt: session.access_token,
          refreshToken: session.refresh_token,
        },
        s => setStatus(s || ''),
      );
      setSavedNetworkCount(result.networkCount);
      setSavedDeviceId(selected.id);
      setStatus('Paired.');
      setPhase('done');
    } catch (err) {
      Alert.alert(
        'Pairing failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
      setPhase('ready');
    }
  }

  function handleAddAnotherNetwork() {
    setWifiOnly(true);
    setSsid('');
    setPsk('');
    setStatus('');
    setPhase('ready');
  }

  const title =
    wifiOnly && !isAddWifi
      ? 'Add Wi-Fi network'
      : isAddWifi
        ? 'Add Wi-Fi network'
        : 'Pair Donna device';
  const canAddMore =
    savedNetworkCount !== null && savedNetworkCount < DONNA_WIFI_MAX_NETS;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close">
              <Text style={styles.closeButton}>Close</Text>
            </Pressable>
          </View>

          {phase === 'scanning' ? (
            <>
              <Text style={styles.description}>
                Hold the Donna device's REC button to wake it. We'll scan for
                nearby devices that are advertising as "Donna Device".
              </Text>
              {devices.length === 0 ? (
                <ActivityIndicator
                  color={colors.primary}
                  style={styles.scanningSpinner}
                />
              ) : (
                <ScrollView style={styles.list}>
                  {devices.map(d => {
                    const isSelected = selected?.id === d.id;
                    return (
                      <Pressable
                        key={d.id}
                        style={[styles.row, isSelected && styles.rowSelected]}
                        onPress={() => {
                          setSelected(d);
                          setPhase('ready');
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle}>{d.name}</Text>
                          <Text style={styles.rowSubtitle}>
                            RSSI {d.rssi} dBm
                          </Text>
                        </View>
                        {isSelected ? (
                          <Text style={styles.check}>✓</Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
              {status ? <Text style={styles.hint}>{status}</Text> : null}
            </>
          ) : null}

          {phase === 'ready' || phase === 'pairing' ? (
            <View style={styles.formContainer}>
              <ScrollView
                contentContainerStyle={styles.formContent}
                keyboardShouldPersistTaps="handled"
              >
                {selected && !isAddWifi ? (
                  <View style={styles.selectedBox}>
                    <Text style={styles.rowTitle}>{selected.name}</Text>
                    <Text style={styles.rowSubtitle}>
                      {selected.id} · RSSI {selected.rssi} dBm
                    </Text>
                    <Pressable
                      style={styles.changeButton}
                      onPress={() => {
                        setSelected(null);
                        setPhase('scanning');
                      }}
                      disabled={phase === 'pairing'}
                    >
                      <Text style={styles.changeText}>Change</Text>
                    </Pressable>
                  </View>
                ) : null}

                {wifiOnly ? (
                  <Text style={styles.description}>
                    Add another Wi-Fi network to your paired Donna device. The
                    device remembers up to {DONNA_WIFI_MAX_NETS} networks and
                    connects to whichever is in range — home, office, or a phone
                    hotspot.
                  </Text>
                ) : null}

                <Text style={styles.fieldLabel}>Wi-Fi network name</Text>
                <TextInput
                  style={styles.input}
                  value={ssid}
                  onChangeText={setSsid}
                  placeholder="Home Wi-Fi"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={phase !== 'pairing'}
                />

                <Text style={styles.fieldLabel}>Wi-Fi password</Text>
                <TextInput
                  style={styles.input}
                  value={psk}
                  onChangeText={setPsk}
                  placeholder="••••••••"
                  placeholderTextColor={colors.muted}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={phase !== 'pairing'}
                />

                <Text style={styles.hint}>
                  {wifiOnly
                    ? "This network is added to the device's saved list. Re-entering the same network name updates its password."
                    : 'The device stores this network and can hold up to ' +
                      `${DONNA_WIFI_MAX_NETS} Wi-Fi networks. You can add more from Profile after pairing.`}
                </Text>

                <Pressable
                  style={[
                    styles.primaryButton,
                    phase === 'pairing' && styles.buttonDisabled,
                  ]}
                  onPress={() => {
                    Keyboard.dismiss();
                    void handleSubmit();
                  }}
                  disabled={phase === 'pairing'}
                >
                  {phase === 'pairing' ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {wifiOnly ? 'Save network' : 'Pair device'}
                    </Text>
                  )}
                </Pressable>

                {status ? <Text style={styles.hint}>{status}</Text> : null}
              </ScrollView>
            </View>
          ) : null}

          {phase === 'done' ? (
            <View style={styles.doneBox}>
              <Text style={styles.doneTitle}>
                {wifiOnly ? 'Network saved' : 'All set'}
              </Text>
              <Text style={styles.hint}>
                {wifiOnly
                  ? savedNetworkCount !== null
                    ? `Your device now has ${savedNetworkCount} saved Wi-Fi network${savedNetworkCount === 1 ? '' : 's'}. It will try them automatically when connecting.`
                    : 'Your Wi-Fi network was saved to the device.'
                  : "Your Donna device is paired. Push the REC button to make a capture — if it's on Wi-Fi, it'll upload on its own. If it's offline, your phone will relay the capture next time you open the Donna app."}
              </Text>
              {canAddMore ? (
                <Pressable
                  style={styles.secondaryButton}
                  onPress={handleAddAnotherNetwork}
                >
                  <Text style={styles.secondaryButtonText}>
                    Add another network
                  </Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.primaryButton} onPress={onClose}>
                <Text style={styles.primaryButtonText}>Done</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    scrim: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      maxHeight: '90%',
      paddingBottom: 0,
    },
    formContainer: {
      flexShrink: 1,
    },
    formContent: {
      paddingBottom: 24,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: { fontSize: 18, fontWeight: '700', color: colors.text },
    closeButton: { color: colors.primary, fontSize: 15, fontWeight: '600' },
    description: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
    },
    scanningSpinner: { marginVertical: 24 },
    list: { maxHeight: 240, marginBottom: 12 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    rowSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
    rowSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
    check: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: '700',
      marginLeft: 8,
    },
    selectedBox: {
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
    },
    changeButton: { marginTop: 4 },
    changeText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
    fieldLabel: {
      marginTop: 12,
      marginBottom: 6,
      fontSize: 13,
      color: colors.muted,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    hint: { color: colors.muted, fontSize: 13, marginTop: 12, lineHeight: 18 },
    primaryButton: {
      marginTop: 16,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
    secondaryButton: {
      marginTop: 16,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    buttonDisabled: { opacity: 0.7 },
    doneBox: { paddingVertical: 16 },
    doneTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
  });
}
