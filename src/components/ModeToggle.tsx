import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DonnaMode } from '../types/mode';

type ModeToggleProps = {
  mode: DonnaMode;
  onChange: (mode: DonnaMode) => void;
  disabled?: boolean;
};

export function ModeToggle({ mode, onChange, disabled }: ModeToggleProps) {
  return (
    <View style={styles.container} accessibilityRole="tablist">
      <Pressable
        style={[styles.segment, mode === 'talk' && styles.segmentActive]}
        onPress={() => onChange('talk')}
        disabled={disabled}
        accessibilityRole="tab"
        accessibilityState={{ selected: mode === 'talk', disabled: !!disabled }}
      >
        <Text style={[styles.label, mode === 'talk' && styles.labelActive]}>
          Talk
        </Text>
      </Pressable>
      <Pressable
        style={[styles.segment, mode === 'listen' && styles.segmentActive]}
        onPress={() => onChange('listen')}
        disabled={disabled}
        accessibilityRole="tab"
        accessibilityState={{ selected: mode === 'listen', disabled: !!disabled }}
      >
        <Text style={[styles.label, mode === 'listen' && styles.labelActive]}>
          Listen
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#f2efe6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0d8c4',
    padding: 3,
    marginBottom: 24,
  },
  segment: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  segmentActive: {
    backgroundColor: '#9A7B2F',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9A7B2F',
  },
  labelActive: {
    color: '#ffffff',
  },
});
