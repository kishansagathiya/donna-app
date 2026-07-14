/**
 * PairDeviceScreen — scans for nearby Donna Devices over BLE, lets the user
 * pick one, and stores it for BLE relay sync.
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
  View,
} from 'react-native';
import { Text } from '../components/ThemedText';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { ThemeColors } from '../theme/colors';
import {
  type DeviceScan,
  scanForDonnaDevices,
  connectAndPairBleOnly,
} from '../services/deviceBle';

type Phase = 'scanning' | 'ready' | 'pairing' | 'done';

type PairDeviceScreenProps = {
  onClose: () => void;
  /** Release the capture-sync BLE session before pairing. */
  onBeforeBleProvision?: () => Promise<void>;
  /** Resume capture sync after pairing finishes. */
  onAfterBleProvision?: () => Promise<void>;
};

export function PairDeviceScreen({
  onClose,
  onBeforeBleProvision,
  onAfterBleProvision,
}: PairDeviceScreenProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [phase, setPhase] = useState<Phase>('scanning');
  const [devices, setDevices] = useState<DeviceScan[]>([]);
  const [selected, setSelected] = useState<DeviceScan | null>(null);
  const [status, setStatus] = useState<string>('');
  const stopScanRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (phase !== 'scanning') return;
    const stop = scanForDonnaDevices(
      list => setDevices(list),
      msg => setStatus(`Scan: ${msg}`),
    );
    stopScanRef.current = stop;
    return () => stop();
  }, [phase]);

  async function handleSubmit() {
    if (!selected) {
      Alert.alert('Missing info', 'Pick a device to pair.');
      return;
    }
    setPhase('pairing');
    setStatus('Pairing…');
    try {
      await onBeforeBleProvision?.();
      await connectAndPairBleOnly(selected.id, s => setStatus(s || ''));
      setStatus('Paired.');
      setPhase('done');
    } catch (err) {
      Alert.alert(
        'Pairing failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
      setPhase('ready');
    } finally {
      await onAfterBleProvision?.();
    }
  }

  const title = 'Pair Donna device';

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
                {selected ? (
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

                <Text style={styles.description}>
                  Captures stay on the device until your phone relays them over
                  Bluetooth. Open Donna with Bluetooth on to upload pending
                  captures automatically.
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
                    <Text style={styles.primaryButtonText}>Pair device</Text>
                  )}
                </Pressable>

                {status ? <Text style={styles.hint}>{status}</Text> : null}
              </ScrollView>
            </View>
          ) : null}

          {phase === 'done' ? (
            <View style={styles.doneBox}>
              <Text style={styles.doneTitle}>All set</Text>
              <Text style={styles.hint}>
                Your Donna device is paired. Record a capture anytime — notes
                sync automatically over Bluetooth when your phone is nearby.
              </Text>
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
    hint: { color: colors.muted, fontSize: 13, marginTop: 12, lineHeight: 18 },
    primaryButton: {
      marginTop: 16,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
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
