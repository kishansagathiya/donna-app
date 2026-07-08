import {
  AudioBuffer,
  AudioBufferSourceNode,
  AudioContext,
  AudioManager,
} from 'react-native-audio-api';
import { base64ToBytes } from './pcm';

let audioContext: AudioContext | null = null;
let activeSession: StreamingPlayback | null = null;

/** ~100ms of mono PCM16 at 24 kHz — batch small network chunks before scheduling. */
const MIN_PCM_SCHEDULE_BYTES = 4_800;
const PCM_FADE_SAMPLES = 128;
const PCM_GAP_FADE_SECONDS = 0.003;

type OwnedBytes = Uint8Array<ArrayBuffer>;

async function getAudioContext(): Promise<AudioContext> {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  await AudioManager.setAudioSessionActivity(true);
  return audioContext;
}

export type EncodedChunk = {
  data: string;
  format: 'mp3' | 'wav' | 'pcm16';
  sampleRate?: number;
  channels?: number;
};

function copyBytes(bytes: Uint8Array<ArrayBufferLike>): OwnedBytes {
  const out = new Uint8Array(bytes.length);
  out.set(bytes);
  return out;
}

function emptyBytes(): OwnedBytes {
  return new Uint8Array(0);
}

function appendBytes(
  existing: OwnedBytes,
  chunk: Uint8Array<ArrayBufferLike>,
): OwnedBytes {
  if (existing.length === 0) {
    return copyBytes(chunk);
  }
  const out = new Uint8Array(existing.length + chunk.length);
  out.set(existing);
  out.set(chunk, existing.length);
  return out;
}

function applyFadeIn(samples: Float32Array, fadeSamples: number): void {
  const count = Math.min(fadeSamples, samples.length);
  for (let i = 0; i < count; i++) {
    samples[i] *= (i + 1) / count;
  }
}

class StreamingPlayback {
  private encodedChunks: OwnedBytes[] = [];
  private pendingPcm = emptyBytes();
  private format: EncodedChunk['format'] | null = null;
  private pcmSampleRate = 24_000;
  private pcmChannels = 1;
  private scheduledDuration = 0;
  private scheduledEndTime = 0;
  private lastSource: AudioBufferSourceNode | null = null;
  private finished = false;
  private stopped = false;
  private pumping = false;
  private pumpAgain = false;
  private startedPlayback = false;
  private doneResolve: (() => void) | null = null;
  private doneReject: ((err: Error) => void) | null = null;
  private donePromise: Promise<void> | null = null;
  private onPlaybackStart: (() => void) | null = null;

  setOnPlaybackStart(handler: () => void): void {
    this.onPlaybackStart = handler;
  }

  enqueue(chunk: EncodedChunk): void {
    if (this.stopped) return;
    if (!this.format) {
      this.format = chunk.format;
      if (chunk.format === 'pcm16') {
        this.pcmSampleRate = chunk.sampleRate ?? 24_000;
        this.pcmChannels = chunk.channels ?? 1;
      }
    }

    const bytes = base64ToBytes(chunk.data);
    if (chunk.format === 'pcm16') {
      this.pendingPcm = appendBytes(this.pendingPcm, bytes);
      void this.pumpPcm();
      return;
    }

    this.encodedChunks.push(copyBytes(bytes));
    void this.pumpEncoded();
  }

  finish(): Promise<void> {
    if (this.stopped) {
      return Promise.resolve();
    }
    if (this.donePromise) {
      return this.donePromise;
    }
    this.finished = true;
    this.donePromise = new Promise<void>((resolve, reject) => {
      this.doneResolve = resolve;
      this.doneReject = reject;
    });
    if (this.format === 'pcm16') {
      void this.pumpPcm();
    } else {
      void this.pumpEncoded();
    }
    return this.donePromise;
  }

  stop(): void {
    this.stopped = true;
    this.finished = true;
    if (this.lastSource) {
      try {
        this.lastSource.stop();
      } catch {
        // already stopped
      }
      this.lastSource = null;
    }
    this.doneResolve?.();
    this.doneResolve = null;
    this.doneReject = null;
    this.encodedChunks = [];
    this.pendingPcm = emptyBytes();
  }

  private markPlaybackStarted(): void {
    if (this.startedPlayback) return;
    this.startedPlayback = true;
    this.onPlaybackStart?.();
  }

  private maybeResolveDone(): void {
    if (!this.finished || this.pendingPcm.length > 0 || this.pumping) {
      return;
    }
    if (this.lastSource) {
      return;
    }
    this.resolveDone();
  }

  private concatEncoded(): OwnedBytes {
    const total = this.encodedChunks.reduce(
      (sum, chunk) => sum + chunk.length,
      0,
    );
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this.encodedChunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }

  private pcmFrameBytes(): number {
    return 2 * this.pcmChannels;
  }

  private schedulePcmBuffer(ctx: AudioContext, pcm: OwnedBytes): void {
    const frameBytes = this.pcmFrameBytes();
    const alignedLength = pcm.length - (pcm.length % frameBytes);
    if (alignedLength === 0) {
      return;
    }

    const aligned =
      alignedLength === pcm.length ? pcm : pcm.slice(0, alignedLength);
    const frameSamples = alignedLength / frameBytes;
    const duration = frameSamples / this.pcmSampleRate;
    const startTime = Math.max(ctx.currentTime, this.scheduledEndTime);
    const gap = startTime - this.scheduledEndTime;
    const needsFadeIn = this.startedPlayback && gap > PCM_GAP_FADE_SECONDS;

    const buffer = ctx.createBuffer(
      this.pcmChannels,
      frameSamples,
      this.pcmSampleRate,
    );
    const view = new DataView(
      aligned.buffer,
      aligned.byteOffset,
      aligned.byteLength,
    );
    for (let ch = 0; ch < this.pcmChannels; ch++) {
      const channel = buffer.getChannelData(ch);
      for (let i = 0; i < frameSamples; i++) {
        channel[i] =
          view.getInt16((i * this.pcmChannels + ch) * 2, true) / 32768;
      }
      if (needsFadeIn) {
        applyFadeIn(channel, PCM_FADE_SAMPLES);
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(startTime);

    this.scheduledEndTime = startTime + duration;
    this.lastSource = source;
    this.markPlaybackStarted();

    source.onEnded = () => {
      if (this.lastSource === source) {
        this.lastSource = null;
      }
      this.maybeResolveDone();
    };
  }

  private async pumpPcm(): Promise<void> {
    if (this.stopped) return;
    if (this.pumping) {
      this.pumpAgain = true;
      return;
    }

    this.pumping = true;
    try {
      const ctx = await getAudioContext();
      const frameBytes = this.pcmFrameBytes();

      while (this.pendingPcm.length >= frameBytes) {
        const canFlushAll =
          this.finished || this.pendingPcm.length >= MIN_PCM_SCHEDULE_BYTES;
        if (!canFlushAll) {
          break;
        }

        let scheduleBytes = this.pendingPcm.length;
        scheduleBytes -= scheduleBytes % frameBytes;
        if (scheduleBytes === 0) {
          break;
        }

        const pcm = copyBytes(this.pendingPcm.slice(0, scheduleBytes));
        this.pendingPcm = copyBytes(this.pendingPcm.slice(scheduleBytes));
        this.schedulePcmBuffer(ctx, pcm);
      }

      this.maybeResolveDone();
    } finally {
      this.pumping = false;
      if (this.pumpAgain && !this.stopped) {
        this.pumpAgain = false;
        void this.pumpPcm();
      }
    }
  }

  private async pumpEncoded(): Promise<void> {
    if (this.stopped) return;
    if (this.pumping) {
      this.pumpAgain = true;
      return;
    }

    this.pumping = true;
    try {
      do {
        this.pumpAgain = false;

        const byteCount = this.encodedChunks.reduce(
          (sum, chunk) => sum + chunk.length,
          0,
        );
        if (byteCount === 0) {
          if (this.finished) {
            this.resolveDone();
          }
          break;
        }

        const ctx = await getAudioContext();
        const bytes = this.concatEncoded();
        const arrayBuffer = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer;

        let audioBuffer: AudioBuffer;
        try {
          audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        } catch {
          if (this.finished) {
            this.rejectDone(new Error('Could not decode assistant audio'));
          }
          break;
        }

        const totalDuration = audioBuffer.duration;
        if (totalDuration > this.scheduledDuration + 0.02) {
          const offset = this.scheduledDuration;
          const duration = totalDuration - this.scheduledDuration;
          const startTime = Math.max(ctx.currentTime, this.scheduledEndTime);

          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          source.start(startTime, offset, duration);

          this.scheduledDuration = totalDuration;
          this.scheduledEndTime = startTime + duration;
          this.lastSource = source;
          this.markPlaybackStarted();

          source.onEnded = () => {
            if (this.lastSource === source && this.finished) {
              this.resolveDone();
            }
          };
        } else if (this.finished) {
          this.resolveDone();
        }
      } while (this.pumpAgain);
    } finally {
      this.pumping = false;
      if (this.pumpAgain && !this.stopped) {
        void this.pumpEncoded();
      }
    }
  }

  private resolveDone(): void {
    if (!this.doneResolve) return;
    this.doneResolve();
    this.doneResolve = null;
    this.doneReject = null;
  }

  private rejectDone(err: Error): void {
    if (!this.doneReject) return;
    this.doneReject(err);
    this.doneResolve = null;
    this.doneReject = null;
  }
}

export function createStreamingPlayback(): StreamingPlayback {
  stopActivePlayback();
  const session = new StreamingPlayback();
  activeSession = session;
  return session;
}

/** @deprecated Use createStreamingPlayback for turn audio. */
export async function playEncodedAudio(chunks: EncodedChunk[]): Promise<void> {
  if (chunks.length === 0) return;
  const session = createStreamingPlayback();
  for (const chunk of chunks) {
    session.enqueue(chunk);
  }
  await session.finish();
}

export function stopActivePlayback(): void {
  if (activeSession) {
    activeSession.stop();
    activeSession = null;
  }
}

export async function resetPlaybackSession(): Promise<void> {
  stopActivePlayback();
  await AudioManager.setAudioSessionActivity(false);
}
