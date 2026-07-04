import { NativeModules, Platform } from 'react-native';
import {
  ENV_VOICE_DEV_HOST,
  ENV_VOICE_TARGET,
  ENV_VOICE_WS_URL_OVERRIDE,
  ENV_PRIVACY_POLICY_URL,
} from './env.generated';

/** Public privacy policy (hosted on donna-web). Override via DONNA_PRIVACY_POLICY_URL in .env */
export const PRIVACY_POLICY_URL = ENV_PRIVACY_POLICY_URL;

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
  'wss://donna-server-go-production.up.railway.app/voice';

/** Production REST API (release builds always use this). */
const PRODUCTION_API_BASE_URL =
  'https://donna-server-go-production.up.railway.app';

/**
 * Voice backend is configured via repo-root `.env` (synced on npm start).
 *
 * DONNA_VOICE_TARGET=local       → local dev server (host auto-detected on npm start)
 * DONNA_VOICE_TARGET=production  → Railway URL while debugging
 * DONNA_VOICE_WS_URL=…           → full WebSocket URL override (escape hatch)
 */

function isIOSSimulator(): boolean {
  if (Platform.OS !== 'ios') {
    return false;
  }
  const model = (
    NativeModules.PlatformConstants as { model?: string } | undefined
  )?.model;
  return typeof model === 'string' && /simulator/i.test(model);
}

function isLocalHost(host: string): boolean {
  return (
    host === '127.0.0.1' ||
    host === '10.0.2.2' ||
    host.endsWith('.local') ||
    host.startsWith('192.168.') ||
    host.startsWith('10.')
  );
}

function resolveVoiceHost(): string {
  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }
  if (Platform.OS === 'ios') {
    if (isIOSSimulator()) {
      return '127.0.0.1';
    }
    if (ENV_VOICE_DEV_HOST) {
      return ENV_VOICE_DEV_HOST;
    }
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

function httpBaseFromVoiceUrl(wsUrl: string): string {
  const normalized = wsUrl.replace(/^ws/, 'http').replace(/^wss/, 'https');
  const url = new URL(normalized);
  return `${url.protocol}//${url.host}`;
}

export const API_BASE_URL = __DEV__
  ? httpBaseFromVoiceUrl(VOICE_WS_URL)
  : PRODUCTION_API_BASE_URL;

export const AUDIO_SAMPLE_RATE = 16_000;
export const AUDIO_CHANNELS = 1;
export const VAD_SILENCE_MS = 350;
export const VAD_ENERGY_THRESHOLD = 0.02;
export const VAD_MIN_SPEECH_MS = 400;
