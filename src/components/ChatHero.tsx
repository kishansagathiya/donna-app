import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { ThemeColors } from '../theme/colors';
import { MicButton, type MicState } from './MicButton';

type Props = {
  micState: MicState;
  onMicPress: () => void;
  micDisabled?: boolean;
};

export function ChatHero({
  micState,
  onMicPress,
  micDisabled,
}: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <MicButton state={micState} onPress={onMicPress} disabled={micDisabled} />
      <Text style={styles.title}>Ask Donna anything</Text>
      <Text style={styles.subtitle}>
        Donna remembers what you save — links, files, and past conversations.
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    title: {
      marginTop: 32,
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    subtitle: {
      marginTop: 10,
      fontSize: 15,
      lineHeight: 22,
      color: colors.muted,
      textAlign: 'center',
      maxWidth: 320,
    },
  });
}
