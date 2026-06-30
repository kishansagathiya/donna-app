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

const HERO_WRAPPER_SIZE = 112;
const HERO_CORE_SIZE = 80;
const HERO_ICON_SIZE = 32;
const INLINE_SIZE = 36;
const INLINE_ICON_SIZE = 18;
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
  variant?: 'hero' | 'inline';
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
    case 'processing':
      return colors.muted;
    case 'error':
      return colors.primary;
    default:
      return colors.primary;
  }
}

function ringColor(state: MicState, colors: ThemeColors): string {
  if (state === 'processing') {
    return colors.muted;
  }
  return colors.primary;
}

export function MicButton({
  state,
  onPress,
  disabled,
  variant = 'hero',
}: MicButtonProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const isInline = variant === 'inline';
  const wrapperSize = isInline ? INLINE_SIZE : HERO_WRAPPER_SIZE;
  const coreSize = isInline ? INLINE_SIZE : HERO_CORE_SIZE;
  const iconSize = isInline ? INLINE_ICON_SIZE : HERO_ICON_SIZE;
  const pulseEnabled =
    !isInline && (state === 'listening' || state === 'processing');
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
    <View
      style={[styles.wrapper, { width: wrapperSize, height: wrapperSize }]}
      testID="mic-toggle"
    >
      {pulseEnabled ? (
        <>
          <PulseRing
            size={HERO_WRAPPER_SIZE}
            fillOpacity={0.15}
            color={ring}
            {...outerRing}
          />
          <PulseRing
            size={HERO_WRAPPER_SIZE - RING_INSET * 2}
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
            {
              width: coreSize,
              height: coreSize,
              borderRadius: coreSize / 2,
              backgroundColor: coreBg,
            },
            !isInline && styles.coreHero,
            isInline && state === 'listening' && styles.coreInlineActive,
            state === 'error' && styles.coreError,
            { opacity: coreOpacity },
          ]}
        >
          {isProcessing ? (
            <ActivityIndicator
              size={isInline ? 'small' : 'large'}
              color={colors.white}
            />
          ) : isListening ? (
            <StopIcon size={iconSize} color={colors.white} />
          ) : (
            <MicIcon size={iconSize} color={colors.white} />
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    core: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    coreHero: {
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 15,
      elevation: 8,
    },
    coreInlineActive: {
      borderWidth: 2,
      borderColor: colors.primaryRing,
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
