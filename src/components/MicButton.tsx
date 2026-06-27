import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { ThemeColors } from '../theme/colors';
import { MicIcon, StopIcon } from './icons';

export type MicState =
  | 'idle'
  | 'requesting'
  | 'listening'
  | 'processing'
  | 'error';

const WRAPPER_SIZE = 112;
const CORE_SIZE = 80;
const ICON_SIZE = 32;
const RING_INSET = 8;
const IDLE_PULSE_DURATION_MS = 2500;
const LISTENING_PULSE_DURATION_MS = 1200;
const PROCESSING_PULSE_DURATION_MS = 1800;
const RING_DELAY_MS = 400;
const PULSE_EASING = Easing.bezier(0.4, 0, 0.6, 1);

type MicButtonProps = {
  state: MicState;
  onPress: () => void;
  disabled?: boolean;
};

function usePulseRing(
  enabled: boolean,
  delayMs = 0,
  durationMs = IDLE_PULSE_DURATION_MS,
) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!enabled) {
      scale.setValue(1);
      opacity.setValue(0);
      return;
    }

    opacity.setValue(0.5);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.35,
            duration: durationMs,
            easing: PULSE_EASING,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: durationMs,
            easing: PULSE_EASING,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.5,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    const timeout = setTimeout(() => animation.start(), delayMs);
    return () => {
      clearTimeout(timeout);
      animation.stop();
    };
  }, [delayMs, durationMs, enabled, opacity, scale]);

  return { scale, opacity };
}

function PulseRing({
  size,
  fillOpacity,
  scale,
  opacity,
  color,
}: {
  size: number;
  fillOpacity: number;
  scale: Animated.Value;
  opacity: Animated.Value;
  color: string;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: Animated.multiply(opacity, fillOpacity),
        transform: [{ scale }],
      }}
    />
  );
}

function coreBackgroundColor(state: MicState, colors: ThemeColors): string {
  switch (state) {
    case 'listening':
      return colors.destructive;
    case 'processing':
      return colors.muted;
    case 'error':
      return colors.primary;
    default:
      return colors.primary;
  }
}

function ringColor(state: MicState, colors: ThemeColors): string {
  if (state === 'listening') {
    return colors.destructive;
  }
  if (state === 'processing') {
    return colors.muted;
  }
  return colors.primary;
}

export function MicButton({ state, onPress, disabled }: MicButtonProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const pulseEnabled =
    state === 'listening' || state === 'processing';
  const pulseDurationMs =
    state === 'listening'
      ? LISTENING_PULSE_DURATION_MS
      : PROCESSING_PULSE_DURATION_MS;
  const outerRing = usePulseRing(pulseEnabled, 0, pulseDurationMs);
  const innerRing = usePulseRing(pulseEnabled, RING_DELAY_MS, pulseDurationMs);
  const coreOpacity = useRef(new Animated.Value(1)).current;

  const isRequesting = state === 'requesting';
  const isListening = state === 'listening';
  const isProcessing = state === 'processing';
  const accessibilityLabel =
    state === 'listening' || state === 'processing'
      ? 'Stop listening'
      : 'Start listening';

  useEffect(() => {
    if (!isRequesting) {
      coreOpacity.setValue(1);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(coreOpacity, {
          toValue: 0.7,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(coreOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [coreOpacity, isRequesting]);

  const ring = ringColor(state, colors);
  const coreBg = coreBackgroundColor(state, colors);

  return (
    <View style={styles.wrapper} testID="mic-toggle">
      {pulseEnabled ? (
        <>
          <PulseRing
            size={WRAPPER_SIZE}
            fillOpacity={0.15}
            color={ring}
            {...outerRing}
          />
          <PulseRing
            size={WRAPPER_SIZE - RING_INSET * 2}
            fillOpacity={0.1}
            color={ring}
            {...innerRing}
          />
        </>
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!disabled, busy: isRequesting }}
        style={({ pressed }) => [pressed && styles.corePressed]}
      >
        <Animated.View
          style={[
            styles.core,
            { backgroundColor: coreBg, opacity: coreOpacity },
            state === 'error' && styles.coreError,
          ]}
        >
          {isProcessing ? (
            <ActivityIndicator size="large" color={colors.white} />
          ) : isListening ? (
            <StopIcon size={ICON_SIZE} color={colors.white} />
          ) : (
            <MicIcon size={ICON_SIZE} color={colors.white} />
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      width: WRAPPER_SIZE,
      height: WRAPPER_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    core: {
      width: CORE_SIZE,
      height: CORE_SIZE,
      borderRadius: CORE_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 15,
      elevation: 8,
    },
    coreError: {
      borderWidth: 3,
      borderColor: colors.destructive,
    },
    corePressed: {
      opacity: 0.9,
    },
  });
}
