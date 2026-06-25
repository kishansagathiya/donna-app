import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  creamPalette,
  indigoPalette,
  type ThemeColors,
} from './colors';

export type AppTheme = 'cream' | 'indigo';

export const THEME_STORAGE_KEY = 'donna.app_theme.v1';

export const APP_THEMES: Record<
  AppTheme,
  { label: string; description: string }
> = {
  cream: { label: 'Cream & gold', description: 'Warm, calm palette' },
  indigo: { label: 'Indigo', description: 'Classic blue accent' },
};

export const THEME_PALETTES: Record<AppTheme, ThemeColors> = {
  cream: creamPalette,
  indigo: indigoPalette,
};

export function isAppTheme(value: string | null): value is AppTheme {
  return value === 'cream' || value === 'indigo';
}

export async function getStoredTheme(): Promise<AppTheme> {
  const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
  return isAppTheme(stored) ? stored : 'indigo';
}

export async function storeTheme(theme: AppTheme): Promise<void> {
  await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
}
