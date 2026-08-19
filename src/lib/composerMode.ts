import AsyncStorage from '@react-native-async-storage/async-storage';

export const COMPOSER_MODE_STORAGE_KEY = 'donna.composerMode';

export type ComposerMode = 'chat' | 'agent';

export function isComposerMode(value: unknown): value is ComposerMode {
  return value === 'chat' || value === 'agent';
}

export function parseComposerMode(value: unknown): ComposerMode {
  return isComposerMode(value) ? value : 'chat';
}

export async function getStoredComposerMode(): Promise<ComposerMode> {
  try {
    return parseComposerMode(
      await AsyncStorage.getItem(COMPOSER_MODE_STORAGE_KEY),
    );
  } catch {
    return 'chat';
  }
}

export async function storeComposerMode(mode: ComposerMode): Promise<void> {
  try {
    await AsyncStorage.setItem(COMPOSER_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage failures; toggle still works in-session.
  }
}
