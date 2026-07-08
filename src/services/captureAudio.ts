/**
 * Decode device capture payloads into 16 kHz mono PCM16 WAV for uploadCapture.
 */

import { OpusDecoder } from 'opus-decoder';
import { AUDIO_CHANNELS, AUDIO_SAMPLE_RATE } from '../config';

export const CAPTURE_FMT_WAV = 0;
export const CAPTURE_FMT_OPUS = 1;

const WAV_HEADER_BYTES = 44;

function buildWavFromPcm(pcm: Int16Array): Uint8Array {
  const dataBytes = pcm.length * 2;
  const out = new Uint8Array(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(out.buffer);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) out[off + i] = s.charCodeAt(i);
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, AUDIO_CHANNELS, true);
  view.setUint32(24, AUDIO_SAMPLE_RATE, true);
  view.setUint32(28, AUDIO_SAMPLE_RATE * AUDIO_CHANNELS * 2, true);
  view.setUint16(32, AUDIO_CHANNELS * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < pcm.length; i++) {
    view.setInt16(WAV_HEADER_BYTES + i * 2, pcm[i], true);
  }
  return out;
}

/** Decode Donna DOP1 opus container (firmware opus_relay.cpp). */
export async function decodeOpusCapture(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes.length < 8) throw new Error('Opus capture too small.');
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== 'DOP1') throw new Error('Unknown Opus container.');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const frameCount = view.getUint32(4, true);
  let off = 8;

  const decoder = new OpusDecoder({ sampleRate: AUDIO_SAMPLE_RATE, channels: AUDIO_CHANNELS });
  await decoder.ready;
  const pcmChunks: Int16Array[] = [];

  for (let f = 0; f < frameCount && off + 2 <= bytes.length; f++) {
    const len = view.getUint16(off, true);
    off += 2;
    if (off + len > bytes.length) break;
    const packet = bytes.subarray(off, off + len);
    off += len;
    const decoded = decoder.decodeFrame(packet);
    const floats = decoded?.channelData?.[0];
    if (floats && floats.length > 0) {
      const int16 = new Int16Array(floats.length);
      for (let i = 0; i < floats.length; i++) {
        const s = Math.max(-1, Math.min(1, floats[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      pcmChunks.push(int16);
    }
  }
  decoder.free();

  let total = 0;
  for (const c of pcmChunks) total += c.length;
  const pcm = new Int16Array(total);
  let pos = 0;
  for (const c of pcmChunks) {
    pcm.set(c, pos);
    pos += c.length;
  }
  if (pcm.length === 0) throw new Error('Opus decode produced no audio.');
  return buildWavFromPcm(pcm);
}

export async function captureBytesToWav(
  bytes: Uint8Array,
  format: number,
): Promise<Uint8Array> {
  if (format === CAPTURE_FMT_OPUS) {
    return decodeOpusCapture(bytes);
  }
  return bytes;
}
