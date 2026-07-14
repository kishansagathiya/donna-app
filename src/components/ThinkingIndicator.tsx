import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Text } from './ThemedText';
import { useThemedStyles } from '../hooks/useThemedStyles';
import {
  DONNA_THINKING_VERBS,
  randomThinkingVerbIndex,
} from '../lib/thinkingPhrases';
import type { ThemeColors } from '../theme/colors';

const ROTATE_MS = 2800;

function useThinkingPhrase() {
  const [verbIndex, setVerbIndex] = useState(randomThinkingVerbIndex);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setVerbIndex(prev => (prev + 1) % DONNA_THINKING_VERBS.length);
        setVisible(true);
      }, 200);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  return {
    verb: DONNA_THINKING_VERBS[verbIndex],
    visible,
  };
}

function BouncingDot({ delay, color, size }: { delay: number; color: string; size: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.delay(Math.max(0, 560 - delay)),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        marginHorizontal: 2,
        transform: [{ translateY }],
      }}
    />
  );
}

type DotsProps = {
  size?: 'sm' | 'md';
  color: string;
};

export function BouncingDots({ size = 'sm', color }: DotsProps) {
  const dotSize = size === 'md' ? 6 : 4;

  return (
    <View style={styles.dotsRow} importantForAccessibility="no-hide-descendants">
      <BouncingDot delay={0} color={color} size={dotSize} />
      <BouncingDot delay={150} color={color} size={dotSize} />
      <BouncingDot delay={300} color={color} size={dotSize} />
    </View>
  );
}

type LabelProps = {
  style?: object;
  verb?: string;
  visible?: boolean;
  color: string;
};

export function ThinkingLabel({
  style,
  verb,
  visible = true,
  color,
}: LabelProps) {
  const phrase = useThinkingPhrase();
  const text = verb ?? phrase.verb;
  const show = verb !== undefined ? visible : phrase.visible;

  return (
    <Text
      style={[styles.label, { color, opacity: show ? 1 : 0 }, style]}
      accessibilityRole="text"
    >
      Donna is {text}
    </Text>
  );
}

type BlockProps = {
  colors: ThemeColors;
};

export function AssistantThinkingBlock({ colors }: BlockProps) {
  const styles = useThemedStyles(createStyles);
  const { verb, visible } = useThinkingPhrase();

  return (
    <View style={styles.block}>
      <View style={[styles.bubble, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <BouncingDots size="md" color={colors.muted} />
      </View>
      <ThinkingLabel
        verb={verb}
        visible={visible}
        color={colors.muted}
        style={styles.blockLabel}
      />
    </View>
  );
}

type Props = {
  style?: object;
};

export function ThinkingIndicator({ style }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <ThinkingLabel
      color={styles.labelColor.color}
      style={[styles.label, style]}
    />
  );
}

const styles = StyleSheet.create({
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 2,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
  },
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    block: {
      alignSelf: 'flex-start',
      maxWidth: '85%',
      gap: 6,
    },
    bubble: {
      borderWidth: 1,
      borderRadius: 16,
      borderBottomLeftRadius: 4,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    blockLabel: {
      paddingLeft: 4,
    },
    labelColor: {
      color: colors.muted,
    },
    label: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
    },
  });
}
