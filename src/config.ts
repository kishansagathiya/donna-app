import { Platform } from 'react-native';

/** Supabase project URL */
export const SUPABASE_URL = 'https://eghhxjlhautsikejocze.supabase.co';

/** Supabase publishable key — safe to embed in the app */
export const SUPABASE_ANON_KEY =
  'sb_publishable_sFpDOcCxs9aKq283JIQPBg_eZRIpUTB';

/** Optional dev email/password for simulator testing without Apple Sign In */
export const DEV_EMAIL: string | null = null;
export const DEV_PASSWORD: string | null = null;

/**
 * Voice backend — set a full WebSocket URL to use production, or null for local dev.
 *
 * Local dev (iOS Simulator): null → ws://127.0.0.1:8787/voice
 * Local dev (Android emulator): null → ws://10.0.2.2:8787/voice
 * Physical iPhone on LAN: set VOICE_SERVER_HOST_OVERRIDE to your Mac's LAN IP
 * Production (Railway): set VOICE_WS_URL_OVERRIDE below
 */
export const VOICE_WS_URL_OVERRIDE: string | null =
  'wss://donna-server-production.up.railway.app/voice';

/** LAN host override for local dev on a physical device (no protocol, no port). */
export const VOICE_SERVER_HOST_OVERRIDE: string | null = null;

function isLocalHost(host: string): boolean {
  return (
    host === '127.0.0.1' ||
    host === '10.0.2.2' ||
    host.startsWith('192.168.') ||
    host.startsWith('10.')
  );
}

function resolveVoiceHost(): string {
  if (VOICE_SERVER_HOST_OVERRIDE) {
    return VOICE_SERVER_HOST_OVERRIDE;
  }
  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }
  return '127.0.0.1';
}

function resolveVoiceWsUrl(): string {
  if (VOICE_WS_URL_OVERRIDE) {
    return VOICE_WS_URL_OVERRIDE;
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
export const VAD_ENERGY_THRESHOLD = 0.015;
