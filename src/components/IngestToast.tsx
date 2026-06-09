import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { IngestToast as ToastState } from '../hooks/useAssetIngest';

type Props = {
  toast: ToastState | null;
};

export function IngestToast({ toast }: Props) {
  if (!toast) return null;

  return (
    <View
      style={[styles.container, toast.isError && styles.error]}
      pointerEvents="none"
    >
      <Text style={styles.text}>{toast.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 32,
    backgroundColor: 'rgba(30,30,30,0.92)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  error: {
    backgroundColor: 'rgba(140,40,40,0.95)',
  },
  text: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
