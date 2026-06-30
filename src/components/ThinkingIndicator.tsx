import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../hooks/useThemedStyles';
import {
  DONNA_THINKING_VERBS,
  randomThinkingVerbIndex,
} from '../lib/thinkingPhrases';
import type { ThemeColors } from '../theme/colors';

const ROTATE_MS = 2800;

type Props = {
  style?: object;
};

function BouncingDot({ delay, color }: { delay: number; color: string }) {
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
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: color,
        marginHorizontal: 1,
        transform: [{ translateY }],
      }}
    />
  );
}

export function ThinkingIndicator({ style }: Props) {
  const styles = useThemedStyles(createStyles);
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

  return (
    <View style={[styles.container, style]} accessibilityRole="text">
      <Text style={[styles.text, { opacity: visible ? 1 : 0 }]}>
        Donna is {DONNA_THINKING_VERBS[verbIndex]}
      </Text>
      <View style={styles.dots} importantForAccessibility="no-hide-descendants">
        <BouncingDot delay={0} color={styles.dotColor.color} />
        <BouncingDot delay={150} color={styles.dotColor.color} />
        <BouncingDot delay={300} color={styles.dotColor.color} />
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 6,
    },
    text: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
    },
    dots: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingBottom: 3,
    },
    dotColor: {
      color: colors.muted,
    },
  });
}
