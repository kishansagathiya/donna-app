import React, { useRef, useSyncExternalStore } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { ThemeColors } from '../theme/colors';
import {
  formatSpeakTime,
  getSpeakSnapshot,
  seekSpeak,
  speakText,
  subscribeSpeaking,
} from '../lib/speak';
import { PauseIcon, PlayIcon } from './icons';

type Props = {
  messageId: string;
  content: string;
  busy?: boolean;
  onError?: (message: string) => void;
};

export function ReplyAudioControls({
  messageId,
  content,
  busy = false,
  onError,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const trackWidthRef = useRef(0);
  const snapshot = useSyncExternalStore(subscribeSpeaking, getSpeakSnapshot);

  const isActive = snapshot.id === messageId && snapshot.status !== 'idle';
  const isPlaying = isActive && snapshot.status === 'playing';
  const isLoading = isActive && snapshot.status === 'loading';
  const progress =
    isActive && snapshot.duration > 0
      ? Math.min(1, snapshot.currentTime / snapshot.duration)
      : 0;

  const onTrackLayout = (event: LayoutChangeEvent) => {
    trackWidthRef.current = event.nativeEvent.layout.width;
  };

  const seekFromEvent = (locationX: number) => {
    if (!isActive || snapshot.duration <= 0 || trackWidthRef.current <= 0) {
      return;
    }
    const ratio = Math.min(1, Math.max(0, locationX / trackWidthRef.current));
    seekSpeak(ratio * snapshot.duration);
  };

  return (
    <View style={[styles.wrap, isActive && styles.wrapActive]}>
      <Pressable
        style={styles.btn}
        disabled={busy || isLoading}
        accessibilityRole="button"
        accessibilityLabel={
          isLoading
            ? 'Loading audio'
            : isPlaying
              ? 'Pause'
              : isActive
                ? 'Play'
                : 'Read aloud'
        }
        accessibilityState={{ selected: isPlaying }}
        onPress={() => {
          void speakText(messageId, content).catch((err: unknown) => {
            onError?.(
              err instanceof Error ? err.message : 'Could not speak reply',
            );
          });
        }}
      >
        {isPlaying ? (
          <PauseIcon size={14} color={colors.primary} />
        ) : (
          <PlayIcon
            size={14}
            color={isActive ? colors.primary : colors.muted}
          />
        )}
      </Pressable>

      {isActive ? (
        <View style={styles.barRow}>
          <Pressable
            style={styles.trackHit}
            onLayout={onTrackLayout}
            onPress={event => seekFromEvent(event.nativeEvent.locationX)}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={event =>
              seekFromEvent(event.nativeEvent.locationX)
            }
            onResponderMove={event =>
              seekFromEvent(event.nativeEvent.locationX)
            }
            accessibilityRole="adjustable"
            accessibilityLabel="Audio position"
          >
            <View style={styles.track}>
              <View style={[styles.fill, { flex: progress }]} />
              <View style={{ flex: Math.max(0.0001, 1 - progress) }} />
            </View>
            <View
              style={[
                styles.thumb,
                { left: `${Math.min(100, Math.max(0, progress * 100))}%` },
              ]}
            />
          </Pressable>
          <Text style={styles.time}>
            {formatSpeakTime(snapshot.currentTime)}
            {snapshot.duration > 0
              ? ` / ${formatSpeakTime(snapshot.duration)}`
              : ''}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    wrapActive: {
      flex: 1,
      minWidth: 140,
      maxWidth: 280,
    },
    btn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
    },
    barRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
    },
    trackHit: {
      flex: 1,
      height: 24,
      justifyContent: 'center',
      position: 'relative',
    },
    track: {
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.border,
      flexDirection: 'row',
      overflow: 'hidden',
    },
    fill: {
      backgroundColor: colors.primary,
    },
    thumb: {
      position: 'absolute',
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary,
      marginLeft: -6,
      top: 6,
    },
    time: {
      fontSize: 11,
      color: colors.muted,
      fontVariant: ['tabular-nums'],
      fontFamily: colors.fontFamily,
    },
  });
}
