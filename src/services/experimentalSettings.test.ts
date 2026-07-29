import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getExperimentalUiEnabled,
  setExperimentalUiEnabled,
} from './experimentalSettings';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('experimentalSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults to false when unset', async () => {
    mockedStorage.getItem.mockResolvedValueOnce(null);
    await expect(getExperimentalUiEnabled()).resolves.toBe(false);
  });

  it('reads true from storage', async () => {
    mockedStorage.getItem.mockResolvedValueOnce('true');
    await expect(getExperimentalUiEnabled()).resolves.toBe(true);
  });

  it.each([
    [true, 'true'],
    [false, 'false'],
  ] as const)('writes %s to AsyncStorage', async (enabled, stored) => {
    await setExperimentalUiEnabled(enabled);
    expect(mockedStorage.setItem).toHaveBeenCalledWith(
      'donna.experimental_ui.v1',
      stored,
    );
  });
});
