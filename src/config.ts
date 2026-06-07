import { Platform } from 'react-native';
import {
  ENV_VOICE_HOST_OVERRIDE,
  ENV_VOICE_TARGET,
  ENV_VOICE_WS_URL_OVERRIDE,
} from './env.generated';

/** Supabase project URL */
export const SUPABASE_URL = 'https://eghhxjlhautsikejocze.supabase.co';

/** Supabase publishable key — safe to embed in the app */
export const SUPABASE_ANON_KEY =
  'sb_publishable_sFpDOcCxs9aKq283JIQPBg_eZRIpUTB';

/** Optional dev email/password for simulator testing without Apple Sign In */
export const DEV_EMAIL: string | null = null;
export const DEV_PASSWORD: string | null = null;

/**
 * App Store screenshot capture — set to a screen name, run in Simulator, Cmd+S.
 * Set back to null before release builds.
 */
export type ScreenshotMode = 'login' | 'voice-idle' | 'voice-listening' | null;
export const SCREENSHOT_MODE: ScreenshotMode = null;

/** Production voice WebSocket (release builds always use this). */
const PRODUCTION_VOICE_WS_URL =
  'wss://donna-server-production.up.railway.app/voice';

/**
 * Voice backend is configured via repo-root `.env` (synced on npm start).
 *
 * DONNA_VOICE_TARGET=local       → ws://127.0.0.1:8787/voice (default in dev)
 * DONNA_VOICE_TARGET=production  → Railway URL while debugging
 * DONNA_VOICE_HOST_OVERRIDE=…    → Mac LAN IP for a physical iPhone
 * DONNA_VOICE_WS_URL=…           → full WebSocket URL override
 */

function isLocalHost(host: string): boolean {
  return (
    host === '127.0.0.1' ||
    host === '10.0.2.2' ||
    host.startsWith('192.168.') ||
    host.startsWith('10.')
  );
}

function resolveVoiceHost(): string {
  if (ENV_VOICE_HOST_OVERRIDE) {
    return ENV_VOICE_HOST_OVERRIDE;
  }
  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }
  return '127.0.0.1';
}

function resolveVoiceWsUrl(): string {
  if (!__DEV__) {
    return PRODUCTION_VOICE_WS_URL;
  }

  if (ENV_VOICE_WS_URL_OVERRIDE) {
    return ENV_VOICE_WS_URL_OVERRIDE;
  }

  if (ENV_VOICE_TARGET === 'production') {
    return PRODUCTION_VOICE_WS_URL;
  }

  const host = resolveVoiceHost();
  if (isLocalHost(host)) {
    return `ws://${host}:8787/voice`;
  }
  return `wss://${host}/voice`;
}

export const VOICE_SERVER_HOST = resolveVoiceHost();
export const VOICE_WS_URL = resolveVoiceWsUrl();

export const AUDIO_SAMPLE_RATE = 16_000;
export const AUDIO_CHANNELS = 1;
export const VAD_SILENCE_MS = 500;
export const VAD_ENERGY_THRESHOLD = 0.02;
export const VAD_MIN_SPEECH_MS = 400;
