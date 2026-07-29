import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPERIMENTAL_UI_KEY = 'donna.experimental_ui.v1';

/** Master Profile toggle — only controls whether experimental features are shown. */
export async function getExperimentalUiEnabled(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(EXPERIMENTAL_UI_KEY);
  return stored === 'true';
}

export async function setExperimentalUiEnabled(
  enabled: boolean,
): Promise<void> {
  await AsyncStorage.setItem(EXPERIMENTAL_UI_KEY, enabled ? 'true' : 'false');
}
