import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../components/ThemedText';
import { useLiveVoiceSession } from '../hooks/useLiveVoiceSession';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { ThemeColors } from '../theme/colors';
import { MicIcon, StopIcon } from '../components/icons';

export function VoiceScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { state, errorMsg, lines, toggle } = useLiveVoiceSession();

  const live = state === 'live';
  const connecting = state === 'connecting';
  const statusLabel = connecting
    ? 'Connecting…'
    : live
      ? 'Listening — talk naturally'
      : 'Tap to start a realtime conversation';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Voice</Text>
        <Text style={styles.subtitle}>
          Realtime conversation with Donna — natural turn-taking, like Gemini
          Live.
        </Text>
      </View>

      <ScrollView
        style={styles.transcript}
        contentContainerStyle={styles.transcriptContent}
      >
        {lines.length === 0 ? (
          <Text style={styles.empty}>
            Your conversation captions will appear here.
          </Text>
        ) : (
          lines.map(line => (
            <View
              key={line.id}
              style={[
                styles.bubble,
                line.role === 'user' ? styles.userBubble : styles.asstBubble,
              ]}
            >
              <Text style={styles.role}>
                {line.role === 'user' ? 'You' : 'Donna'}
              </Text>
              <Text style={styles.bubbleText}>{line.text}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
      <Text style={styles.status}>{statusLabel}</Text>

      <Pressable
        style={({ pressed }) => [
          styles.cta,
          live && styles.ctaLive,
          pressed && styles.ctaPressed,
        ]}
        onPress={() => void toggle()}
        accessibilityRole="button"
        accessibilityLabel={live || connecting ? 'End Voice' : 'Start Voice'}
      >
        {connecting ? (
          <ActivityIndicator color="#fff" />
        ) : live ? (
          <StopIcon size={28} color="#fff" />
        ) : (
          <MicIcon size={28} color="#fff" />
        )}
        <Text style={styles.ctaLabel}>
          {connecting ? 'Connecting' : live ? 'End' : 'Voice'}
        </Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    header: {
      paddingTop: 8,
      paddingBottom: 12,
      gap: 6,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    transcript: {
      flex: 1,
    },
    transcriptContent: {
      paddingVertical: 12,
      gap: 10,
    },
    empty: {
      color: colors.muted,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 40,
      fontFamily: colors.fontFamily,
    },
    bubble: {
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      maxWidth: '92%',
    },
    userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primaryLight,
    },
    asstBubble: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    role: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.muted,
      marginBottom: 4,
      fontFamily: colors.fontFamily,
    },
    bubbleText: {
      fontSize: 15,
      lineHeight: 21,
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    error: {
      color: colors.destructive,
      fontSize: 13,
      textAlign: 'center',
      marginBottom: 8,
      fontFamily: colors.fontFamily,
    },
    status: {
      textAlign: 'center',
      color: colors.muted,
      fontSize: 13,
      marginBottom: 12,
      fontFamily: colors.fontFamily,
    },
    cta: {
      alignSelf: 'center',
      minWidth: 160,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 28,
      paddingVertical: 16,
      marginBottom: 8,
    },
    ctaLive: {
      backgroundColor: '#c0392b',
    },
    ctaPressed: {
      opacity: 0.88,
    },
    ctaLabel: {
      color: '#fff',
      fontSize: 17,
      fontWeight: '700',
      fontFamily: colors.fontFamily,
    },
  });
}
