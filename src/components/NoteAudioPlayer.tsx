import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AudioBuffer,
  AudioBufferSourceNode,
  AudioContext,
  AudioManager,
} from 'react-native-audio-api';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { ThemeColors } from '../theme/colors';

type Props = {
  url: string;
};

type State = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

/**
 * Plays back a dictated note's stored WAV. Uses the same react-native-audio-api
 * AudioContext the voice session uses, but kept isolated here so the note flow
 * never touches the live mic/streaming pipeline. We fetch+decode the whole
 * file once (notes are short) and toggle the same AudioBufferSourceNode between
 * play/pause.
 */
export function NoteAudioPlayer({ url }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const ctxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startedAtRef = useRef<number>(0);
  const offsetRef = useRef<number>(0);
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState('loading');
      setError(null);
      try {
        if (!ctxRef.current) {
          ctxRef.current = new AudioContext();
        }
        await AudioManager.setAudioSessionActivity?.(true);

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Audio fetch failed (${res.status})`);
        }
        const arrayBuffer = await res.arrayBuffer();
        if (cancelled) return;

        const ctx = ctxRef.current;
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        if (cancelled) return;
        bufferRef.current = decoded;
        setState('idle');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load audio');
        setState('error');
      }
    }

    void load();

    return () => {
      cancelled = true;
      stopSource();
      void AudioManager.setAudioSessionActivity?.(false).catch(() => {});
    };
    // We intentionally load once per URL — flipping the URL refreshes via key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  function stopSource() {
    const src = sourceRef.current;
    if (src) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      src.onEnded = null;
      sourceRef.current = null;
    }
  }

  function play() {
    const ctx = ctxRef.current;
    const buffer = bufferRef.current;
    if (!ctx || !buffer) {
      return;
    }
    stopSource();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.onEnded = () => {
      if (sourceRef.current === src) {
        sourceRef.current = null;
        offsetRef.current = 0;
        setState('idle');
      }
    };
    const offset = Math.min(offsetRef.current, buffer.duration);
    startedAtRef.current = ctx.currentTime;
    src.start(0, offset);
    sourceRef.current = src;
    setState('playing');
  }

  function pause() {
    const ctx = ctxRef.current;
    const src = sourceRef.current;
    const buffer = bufferRef.current;
    if (!ctx || !src || !buffer) {
      return;
    }
    offsetRef.current += ctx.currentTime - startedAtRef.current;
    stopSource();
    setState('paused');
  }

  function toggle() {
    if (state === 'playing') {
      pause();
    } else {
      play();
    }
  }

  const label = (() => {
    switch (state) {
      case 'loading':
        return 'Loading…';
      case 'playing':
        return 'Pause';
      case 'paused':
        return 'Resume';
      case 'error':
        return error ?? 'Unavailable';
      default:
        return 'Play';
    }
  })();

  return (
    <View style={styles.container}>
      <Pressable
        style={[
          styles.button,
          state === 'error' && styles.buttonError,
        ]}
        onPress={toggle}
        disabled={state === 'loading' || state === 'error' || !bufferRef.current}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {state === 'loading' ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginVertical: 8,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    buttonError: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.destructive,
    },
    label: {
      color: colors.white,
      fontSize: 15,
      fontWeight: '600',
    },
  });
}