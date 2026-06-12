import AsyncStorage from '@react-native-async-storage/async-storage';

const AI_DATA_CONSENT_KEY = 'donna.ai_data_consent.v1';

export async function hasAiDataConsent(): Promise<boolean> {
  const value = await AsyncStorage.getItem(AI_DATA_CONSENT_KEY);
  return value === 'true';
}

export async function grantAiDataConsent(): Promise<void> {
  await AsyncStorage.setItem(AI_DATA_CONSENT_KEY, 'true');
}
