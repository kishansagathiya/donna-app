import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { ThemeColors } from '../theme/colors';
import { MicIcon } from './icons';

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
const PULSE_DURATION_MS = 2500;
const RING_DELAY_MS = 800;
const PULSE_EASING = Easing.bezier(0.4, 0, 0.6, 1);

type MicButtonProps = {
  state: MicState;
  onPress: () => void;
  disabled?: boolean;
};

function usePulseRing(delayMs = 0) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.35,
            duration: PULSE_DURATION_MS,
            easing: PULSE_EASING,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: PULSE_DURATION_MS,
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
  }, [delayMs, opacity, scale]);

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

export function MicButton({ state, onPress, disabled }: MicButtonProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const outerRing = usePulseRing(0);
  const innerRing = usePulseRing(RING_DELAY_MS);
  const coreOpacity = useRef(new Animated.Value(1)).current;

  const isRequesting = state === 'requesting';
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

  return (
    <View style={styles.wrapper} testID="mic-toggle">
      <PulseRing
        size={WRAPPER_SIZE}
        fillOpacity={0.15}
        color={colors.primary}
        {...outerRing}
      />
      <PulseRing
        size={WRAPPER_SIZE - RING_INSET * 2}
        fillOpacity={0.1}
        color={colors.primary}
        {...innerRing}
      />
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!disabled, busy: isRequesting }}
        style={({ pressed }) => [pressed && styles.corePressed]}
      >
        <Animated.View style={[styles.core, { opacity: coreOpacity }]}>
          <MicIcon size={ICON_SIZE} color={colors.white} />
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
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 15,
      elevation: 8,
    },
    corePressed: {
      opacity: 0.9,
    },
  });
}
