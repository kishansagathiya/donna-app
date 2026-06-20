import {
  base64ToBytes,
  computeRms,
  floatToPcm16,
  pcm16ToBase64,
} from '../pcm';

describe('computeRms', () => {
  it('returns 0 for empty input', () => {
    expect(computeRms(new Float32Array())).toBe(0);
  });

  it('computes RMS for known samples', () => {
    const samples = new Float32Array([1, -1]);
    expect(computeRms(samples)).toBeCloseTo(1, 5);
  });
});

describe('floatToPcm16', () => {
  it('encodes silence as zero bytes', () => {
    const pcm = floatToPcm16(new Float32Array([0, 0]));
    expect(Array.from(pcm)).toEqual([0, 0, 0, 0]);
  });
});

describe('pcm16 round trip', () => {
  it('preserves bytes through base64 encoding', () => {
    const original = new Uint8Array([1, 2, 3, 4]);
    const encoded = pcm16ToBase64(original);
    expect(base64ToBytes(encoded)).toEqual(original);
  });
});
