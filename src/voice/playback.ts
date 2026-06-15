import { AudioContext, AudioManager } from 'react-native-audio-api';
import { base64ToBytes } from './pcm';

let audioContext: AudioContext | null = null;
let activeSession: StreamingPlayback | null = null;

async function getAudioContext(): Promise<AudioContext> {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  await AudioManager.setAudioSessionActivity(true);
  return audioContext;
}

type EncodedChunk = { data: string; format: 'mp3' | 'wav' };

class StreamingPlayback {
  private chunks: Uint8Array[] = [];
  private format: 'mp3' | 'wav' | null = null;
  private scheduledDuration = 0;
  private scheduledEndTime = 0;
  private lastSource: AudioBufferSourceNode | null = null;
  private finished = false;
  private stopped = false;
  private pumping = false;
  private pumpAgain = false;
  private doneResolve: (() => void) | null = null;
  private doneReject: ((err: Error) => void) | null = null;
  private donePromise: Promise<void> | null = null;

  enqueue(chunk: EncodedChunk): void {
    if (this.stopped) return;
    if (!this.format) {
      this.format = chunk.format;
    }
    this.chunks.push(base64ToBytes(chunk.data));
    void this.pump();
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
    void this.pump();
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
    this.chunks = [];
  }

  private bytesBuffered(): number {
    return this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  }

  private concatChunks(): Uint8Array {
    const total = this.bytesBuffered();
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }

  private async pump(): Promise<void> {
    if (this.stopped) return;
    if (this.pumping) {
      this.pumpAgain = true;
      return;
    }

    this.pumping = true;
    try {
      do {
        this.pumpAgain = false;

        const byteCount = this.bytesBuffered();
        if (byteCount === 0) {
          if (this.finished) {
            this.resolveDone();
          }
          break;
        }

        const ctx = await getAudioContext();
        const bytes = this.concatChunks();
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
        void this.pump();
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
export async function playEncodedAudio(
  chunks: Array<{ data: string; format: 'mp3' | 'wav' }>,
): Promise<void> {
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
