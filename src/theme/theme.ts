import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  einkPalette,
  indigoPalette,
  type ThemeColors,
} from './colors';

export type AppTheme = 'indigo' | 'eink';

export const THEME_STORAGE_KEY = 'donna.app_theme.v1';

export const APP_THEMES: Record<
  AppTheme,
  { label: string; description: string }
> = {
  indigo: { label: 'Indigo', description: 'Classic blue accent' },
  eink: { label: 'E-ink', description: 'Black & white reader' },
};

export const THEME_PALETTES: Record<AppTheme, ThemeColors> = {
  indigo: indigoPalette,
  eink: einkPalette,
};

export const THEME_ORDER: AppTheme[] = ['indigo', 'eink'];

export function isAppTheme(value: string | null): value is AppTheme {
  return value === 'indigo' || value === 'eink';
}

export async function getStoredTheme(): Promise<AppTheme> {
  const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
  return isAppTheme(stored) ? stored : 'eink';
}

export async function storeTheme(theme: AppTheme): Promise<void> {
  await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function nextTheme(current: AppTheme): AppTheme {
  const nextIndex = (THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length;
  return THEME_ORDER[nextIndex];
}
