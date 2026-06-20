import { EnergyVad } from '../vad';

describe('EnergyVad', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('detects end of turn after speech and silence', () => {
    const vad = new EnergyVad({
      silenceMs: 500,
      energyThreshold: 0.01,
      minSpeechMs: 200,
      sampleRate: 16_000,
    });

    const loud = new Float32Array(320).fill(0.5);
    const quiet = new Float32Array(320).fill(0);

    for (let i = 0; i < 12; i++) {
      expect(vad.process(loud)).toBe(false);
    }

    jest.advanceTimersByTime(600);
    expect(vad.process(quiet)).toBe(true);
  });

  it('does not end turn when speech is too short', () => {
    const vad = new EnergyVad({
      silenceMs: 200,
      energyThreshold: 0.01,
      minSpeechMs: 500,
      sampleRate: 16_000,
    });

    const loud = new Float32Array(320).fill(0.5);
    const quiet = new Float32Array(320).fill(0);

    vad.process(loud);
    jest.advanceTimersByTime(100);
    vad.process(quiet);
    jest.advanceTimersByTime(300);
    expect(vad.process(quiet)).toBe(false);
  });

  it('resets state on resume', () => {
    const vad = new EnergyVad({
      silenceMs: 200,
      energyThreshold: 0.01,
      minSpeechMs: 100,
      sampleRate: 16_000,
    });

    vad.pause();
    expect(vad.process(new Float32Array(320).fill(0.5))).toBe(false);

    vad.resume();
    const loud = new Float32Array(320).fill(0.5);
    expect(vad.process(loud)).toBe(false);
  });
});
