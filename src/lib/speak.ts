/**
 * Read-aloud helper for assistant replies via POST /tts + AudioContext.
 */

import {
  AudioBufferSourceNode,
  AudioContext,
  AudioManager,
} from 'react-native-audio-api';
import { authorizedFetch } from '../services/http';

type Listener = () => void;

let speakingId: string | null = null;
let listeners = new Set<Listener>();
let audioContext: AudioContext | null = null;
let sourceNode: AudioBufferSourceNode | null = null;
let abortController: AbortController | null = null;

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
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

export function getSpeakingId(): string | null {
  return speakingId;
}

export function subscribeSpeaking(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function stopSource(): void {
  if (sourceNode) {
    try {
      sourceNode.stop();
    } catch {
      // already stopped
    }
    sourceNode = null;
  }
}

export function stopSpeaking(): void {
  abortController?.abort();
  abortController = null;
  stopSource();
  speakingId = null;
  notify();
  void AudioManager.setAudioSessionActivity?.(false).catch(() => {});
}

export async function speakText(id: string, text: string): Promise<void> {
  const cleaned = prepareTextForSpeech(text);
  if (!cleaned) return;

  if (speakingId === id) {
    stopSpeaking();
    return;
  }

  stopSpeaking();
  speakingId = id;
  notify();

  const controller = new AbortController();
  abortController = controller;

  try {
    const res = await authorizedFetch('/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleaned }),
      signal: controller.signal,
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

    if (controller.signal.aborted || speakingId !== id) {
      return;
    }

    const arrayBuffer = await res.arrayBuffer();
    if (controller.signal.aborted || speakingId !== id) {
      return;
    }

    if (!audioContext) {
      audioContext = new AudioContext();
    }
    await AudioManager.setAudioSessionActivity?.(true);

    const buffer = await audioContext.decodeAudioData(arrayBuffer);
    if (controller.signal.aborted || speakingId !== id) {
      return;
    }

    stopSource();
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    sourceNode = source;
    source.onEnded = () => {
      if (sourceNode === source) {
        sourceNode = null;
      }
      if (speakingId === id) {
        speakingId = null;
        notify();
        void AudioManager.setAudioSessionActivity?.(false).catch(() => {});
      }
    };
    source.start(0);
  } catch (err) {
    if (controller.signal.aborted) {
      return;
    }
    speakingId = null;
    notify();
    void AudioManager.setAudioSessionActivity?.(false).catch(() => {});
    throw err;
  } finally {
    if (abortController === controller) {
      abortController = null;
    }
  }
}
