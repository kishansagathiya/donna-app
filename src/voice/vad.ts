import { computeRms } from './pcm';

export type VadOptions = {
  silenceMs: number;
  energyThreshold: number;
  minSpeechMs: number;
  sampleRate?: number;
};

export class EnergyVad {
  private hadSpeech = false;
  private lastSpeechAt = 0;
  private speechMs = 0;
  private paused = false;

  constructor(private readonly options: VadOptions) {}

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.hadSpeech = false;
    this.lastSpeechAt = 0;
    this.speechMs = 0;
  }

  reset(): void {
    this.hadSpeech = false;
    this.lastSpeechAt = 0;
    this.speechMs = 0;
  }

  process(samples: Float32Array): boolean {
    if (this.paused) return false;

    const sampleRate = this.options.sampleRate ?? 16_000;
    const frameMs = (samples.length / sampleRate) * 1000;
    const rms = computeRms(samples);
    const now = Date.now();

    if (rms >= this.options.energyThreshold) {
      this.hadSpeech = true;
      this.lastSpeechAt = now;
      this.speechMs += frameMs;
      return false;
    }

    if (
      this.hadSpeech &&
      now - this.lastSpeechAt >= this.options.silenceMs
    ) {
      if (this.speechMs >= this.options.minSpeechMs) {
        this.hadSpeech = false;
        this.speechMs = 0;
        return true;
      }
      this.hadSpeech = false;
      this.speechMs = 0;
      return false;
    }

    return false;
  }
}
