/**
 * Read-aloud player for assistant replies via POST /tts.
 * Prefetches on reply finish, persists via server cache, and supports
 * pause / resume / seek with a progress bar.
 */

import {
  AudioBuffer,
  AudioBufferSourceNode,
  AudioContext,
  AudioManager,
} from 'react-native-audio-api';
import { authorizedFetch } from '../services/http';

type Listener = () => void;

export type SpeakStatus = 'idle' | 'loading' | 'playing' | 'paused';

export type SpeakSnapshot = {
  id: string | null;
  status: SpeakStatus;
  currentTime: number;
  duration: number;
};

type CacheEntry = {
  textKey: string;
  arrayBuffer: ArrayBuffer;
  audioBuffer?: AudioBuffer;
};

const MAX_CACHE_ENTRIES = 6;

let snapshot: SpeakSnapshot = {
  id: null,
  status: 'idle',
  currentTime: 0,
  duration: 0,
};

let listeners = new Set<Listener>();
let prefetchListeners = new Set<Listener>();
let audioContext: AudioContext | null = null;
let sourceNode: AudioBufferSourceNode | null = null;
let activeBuffer: AudioBuffer | null = null;
let startedAtOffset = 0;
let contextStartedAt = 0;
let playAbortController: AbortController | null = null;
let progressTimer: ReturnType<typeof setInterval> | null = null;

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<ArrayBuffer>>();
const prefetchControllers = new Map<string, AbortController>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function notifyPrefetch(): void {
  for (const listener of prefetchListeners) {
    listener();
  }
}

function setSnapshot(next: Partial<SpeakSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  notify();
}

/** Strip markdown / URLs so TTS reads clean prose. */
export function prepareTextForSpeech(text: string): string {
  if (!text) return text;

  let out = text;
  out = out.replace(/```[\s\S]*?```/g, ' ');
  out = out.replace(/`([^`]+)`/g, '$1');
  out = out.replace(/^#{1,6}\s+/gm, '');
  out = out.replace(/\*\*([^*]+)\*\*/g, '$1');
  out = out.replace(/__([^_]+)__/g, '$1');
  out = out.replace(/\*([^*]+)\*/g, '$1');
  out = out.replace(/_([^_]+)_/g, '$1');
  out = out.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
  out = out.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  out = out.replace(/\b(?:https?:\/\/|www\.)[^\s<>"']+/gi, '');
  out = out.replace(
    /\b[a-z0-9][-a-z0-9]*(?:\.[a-z0-9][-a-z0-9]*)+(?:\/[^\s]*)?/gi,
    '',
  );
  out = out.replace(/\band\/or\b/gi, 'and or');
  let prev = '';
  while (prev !== out) {
    prev = out;
    out = out.replace(/(\w+(?:[-']\w+)*)\s*\/\s*(\w+(?:[-']\w+)*)/g, '$1 or $2');
  }
  out = out.replace(/\s{2,}/g, ' ');
  return out.trim();
}

export function getSpeakSnapshot(): SpeakSnapshot {
  return snapshot;
}

export function getSpeakingId(): string | null {
  return snapshot.status === 'idle' ? null : snapshot.id;
}

export function subscribeSpeaking(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribePrefetch(listener: Listener): () => void {
  prefetchListeners.add(listener);
  return () => {
    prefetchListeners.delete(listener);
  };
}

export function isSpeakCached(id: string, text: string): boolean {
  const cleaned = prepareTextForSpeech(text);
  const entry = cache.get(id);
  return Boolean(entry && entry.textKey === cleaned);
}

export function isSpeakPrefetching(id: string): boolean {
  return inflight.has(id);
}

function trimCache(keepId?: string): void {
  while (cache.size > MAX_CACHE_ENTRIES) {
    let evict: string | undefined;
    for (const key of cache.keys()) {
      if (key !== keepId) {
        evict = key;
        break;
      }
    }
    if (!evict) break;
    cache.delete(evict);
  }
}

async function fetchTtsAudio(
  cleaned: string,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const res = await authorizedFetch('/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: cleaned }),
    signal,
  });

  if (!res.ok) {
    let message = `TTS failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error('Empty audio from TTS');
  }
  return arrayBuffer;
}

export function prefetchSpeak(id: string, text: string): void {
  const cleaned = prepareTextForSpeech(text);
  if (!cleaned) return;

  const existing = cache.get(id);
  if (existing && existing.textKey === cleaned) return;
  if (inflight.has(id)) return;

  notifyPrefetch();

  const controller = new AbortController();
  prefetchControllers.get(id)?.abort();
  prefetchControllers.set(id, controller);

  const promise = fetchTtsAudio(cleaned, controller.signal)
    .then(arrayBuffer => {
      cache.set(id, { textKey: cleaned, arrayBuffer });
      trimCache(id);
      notifyPrefetch();
      return arrayBuffer;
    })
    .finally(() => {
      if (inflight.get(id) === promise) {
        inflight.delete(id);
      }
      if (prefetchControllers.get(id) === controller) {
        prefetchControllers.delete(id);
      }
      notifyPrefetch();
    });

  inflight.set(id, promise);
  void promise.catch(() => {
    // Prefetch failures stay silent; speakText will surface errors on press.
  });
}

function stopSource(): void {
  if (sourceNode) {
    try {
      sourceNode.onEnded = null;
      sourceNode.stop();
    } catch {
      // already stopped
    }
    sourceNode = null;
  }
}

function stopProgressLoop(): void {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function readPlayingTime(): number {
  if (!audioContext || !activeBuffer) return startedAtOffset;
  if (snapshot.status !== 'playing') return startedAtOffset;
  const elapsed = audioContext.currentTime - contextStartedAt;
  return Math.min(activeBuffer.duration, Math.max(0, startedAtOffset + elapsed));
}

function startProgressLoop(): void {
  stopProgressLoop();
  progressTimer = setInterval(() => {
    if (snapshot.status !== 'playing') {
      stopProgressLoop();
      return;
    }
    const currentTime = readPlayingTime();
    if (currentTime !== snapshot.currentTime) {
      setSnapshot({ currentTime });
    }
  }, 100);
}

function clearPlayer(): void {
  playAbortController?.abort();
  playAbortController = null;
  stopProgressLoop();
  stopSource();
  activeBuffer = null;
  startedAtOffset = 0;
  contextStartedAt = 0;
  setSnapshot({
    id: null,
    status: 'idle',
    currentTime: 0,
    duration: 0,
  });
  void AudioManager.setAudioSessionActivity?.(false).catch(() => {});
}

export function stopSpeaking(): void {
  clearPlayer();
}

function startSourceAt(offset: number): void {
  if (!audioContext || !activeBuffer || !snapshot.id) return;

  stopSource();
  const clamped = Math.min(
    Math.max(0, offset),
    Math.max(0, activeBuffer.duration - 0.01),
  );
  const source = audioContext.createBufferSource();
  source.buffer = activeBuffer;
  source.connect(audioContext.destination);
  const id = snapshot.id;
  source.onEnded = () => {
    if (sourceNode !== source) return;
    sourceNode = null;
    if (snapshot.id === id && snapshot.status === 'playing') {
      stopProgressLoop();
      startedAtOffset = activeBuffer?.duration ?? 0;
      setSnapshot({
        id,
        status: 'paused',
        currentTime: activeBuffer?.duration ?? 0,
      });
    }
  };
  startedAtOffset = clamped;
  contextStartedAt = audioContext.currentTime;
  sourceNode = source;
  source.start(0, clamped);
  setSnapshot({
    status: 'playing',
    currentTime: clamped,
    duration: activeBuffer.duration,
  });
  startProgressLoop();
}

export function pauseSpeak(): void {
  if (snapshot.status !== 'playing' || !activeBuffer) return;
  const currentTime = readPlayingTime();
  stopProgressLoop();
  stopSource();
  startedAtOffset = currentTime;
  setSnapshot({ status: 'paused', currentTime });
}

export function resumeSpeak(): void {
  if (snapshot.status !== 'paused' || !activeBuffer) return;
  void (async () => {
    if (!audioContext) {
      audioContext = new AudioContext();
    }
    await AudioManager.setAudioSessionActivity?.(true);
    if (snapshot.status !== 'paused' || !activeBuffer) return;
    const atEnd = startedAtOffset >= activeBuffer.duration - 0.05;
    startSourceAt(atEnd ? 0 : startedAtOffset);
  })();
}

export function seekSpeak(time: number): void {
  if (!activeBuffer || !snapshot.id) return;
  const clamped = Math.min(Math.max(0, time), activeBuffer.duration);
  const wasPlaying = snapshot.status === 'playing';
  stopProgressLoop();
  stopSource();
  startedAtOffset = clamped;
  setSnapshot({ currentTime: clamped });
  if (wasPlaying) {
    startSourceAt(clamped);
  } else {
    setSnapshot({ status: 'paused', currentTime: clamped });
  }
}

async function ensureArrayBuffer(
  id: string,
  cleaned: string,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const cached = cache.get(id);
  if (cached && cached.textKey === cleaned) {
    return cached.arrayBuffer;
  }

  const pending = inflight.get(id);
  if (pending) {
    try {
      const arrayBuffer = await pending;
      if (signal.aborted) throw new Error('Aborted');
      const after = cache.get(id);
      if (after && after.textKey === cleaned) {
        return after.arrayBuffer;
      }
      return arrayBuffer;
    } catch {
      // Fall through.
    }
  }

  const arrayBuffer = await fetchTtsAudio(cleaned, signal);
  cache.set(id, { textKey: cleaned, arrayBuffer });
  trimCache(id);
  notifyPrefetch();
  return arrayBuffer;
}

async function decodeForId(
  id: string,
  cleaned: string,
  arrayBuffer: ArrayBuffer,
): Promise<AudioBuffer> {
  const entry = cache.get(id);
  if (entry?.textKey === cleaned && entry.audioBuffer) {
    return entry.audioBuffer;
  }
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  await AudioManager.setAudioSessionActivity?.(true);
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  cache.set(id, {
    textKey: cleaned,
    arrayBuffer,
    audioBuffer,
  });
  trimCache(id);
  return audioBuffer;
}

export async function speakText(id: string, text: string): Promise<void> {
  const cleaned = prepareTextForSpeech(text);
  if (!cleaned) return;

  if (snapshot.id === id && snapshot.status === 'playing') {
    pauseSpeak();
    return;
  }
  if (snapshot.id === id && snapshot.status === 'paused') {
    resumeSpeak();
    return;
  }

  playAbortController?.abort();
  stopProgressLoop();
  stopSource();

  const controller = new AbortController();
  playAbortController = controller;
  setSnapshot({
    id,
    status: 'loading',
    currentTime: 0,
    duration: 0,
  });

  try {
    const arrayBuffer = await ensureArrayBuffer(id, cleaned, controller.signal);
    if (controller.signal.aborted || snapshot.id !== id) return;

    const audioBuffer = await decodeForId(id, cleaned, arrayBuffer);
    if (controller.signal.aborted || snapshot.id !== id) return;

    activeBuffer = audioBuffer;
    startedAtOffset = 0;
    setSnapshot({
      id,
      status: 'paused',
      currentTime: 0,
      duration: audioBuffer.duration,
    });
    startSourceAt(0);
  } catch (err) {
    if (controller.signal.aborted) {
      return;
    }
    clearPlayer();
    throw err;
  } finally {
    if (playAbortController === controller) {
      playAbortController = null;
    }
  }
}

export function formatSpeakTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
