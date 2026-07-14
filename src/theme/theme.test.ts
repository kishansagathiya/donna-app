import AsyncStorage from '@react-native-async-storage/async-storage';
import { einkPalette, indigoPalette } from './colors';
import {
  getStoredTheme,
  isAppTheme,
  nextTheme,
  storeTheme,
  THEME_ORDER,
  THEME_PALETTES,
  THEME_STORAGE_KEY,
  type AppTheme,
} from './theme';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('isAppTheme', () => {
  it.each(['indigo', 'eink'])('returns true for "%s"', value => {
    expect(isAppTheme(value)).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isAppTheme('cream')).toBe(false);
    expect(isAppTheme('dark')).toBe(false);
    expect(isAppTheme('')).toBe(false);
    expect(isAppTheme(null)).toBe(false);
  });
});

describe('THEME_PALETTES', () => {
  it('registers indigo and eink', () => {
    expect(THEME_PALETTES.indigo).toBe(indigoPalette);
    expect(THEME_PALETTES.eink).toBe(einkPalette);
  });

  it('matches web e-ink token values', () => {
    expect(einkPalette.primary).toBe('#1A1A1A');
    expect(einkPalette.primaryHover).toBe('#000000');
    expect(einkPalette.primaryLight).toBe('#E8E6DF');
    expect(einkPalette.primaryRing).toBe('#333333');
    expect(einkPalette.surface).toBe('#F4F1EA');
    expect(einkPalette.background).toBe('#F4F1EA');
    expect(einkPalette.border).toBe('#D8D4C8');
    expect(einkPalette.text).toBe('#1A1A1A');
    expect(einkPalette.muted).toBe('#5C564E');
    expect(einkPalette.destructive).toBe('#1A1A1A');
    expect(einkPalette.fontFamily).toBe('Literata');
    expect(einkPalette.shadowEnabled).toBe(false);
  });

  it('keeps indigo shadows and system font', () => {
    expect(indigoPalette.shadowEnabled).toBe(true);
    expect(indigoPalette.fontFamily).toBeUndefined();
  });
});

describe('nextTheme', () => {
  it('cycles indigo → eink → indigo', () => {
    expect(THEME_ORDER).toEqual(['indigo', 'eink']);
    expect(nextTheme('indigo')).toBe('eink');
    expect(nextTheme('eink')).toBe('indigo');
  });
});

describe('getStoredTheme', () => {
  beforeEach(() => {
    mockedStorage.getItem.mockReset();
  });

  it.each<AppTheme>(['indigo', 'eink'])(
    'returns "%s" when it is stored',
    async theme => {
      mockedStorage.getItem.mockResolvedValue(theme);
      await expect(getStoredTheme()).resolves.toBe(theme);
      expect(mockedStorage.getItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
    },
  );

  it('falls back to eink for legacy cream storage', async () => {
    mockedStorage.getItem.mockResolvedValue('cream');
    await expect(getStoredTheme()).resolves.toBe('eink');
  });

  it('falls back to eink for invalid stored values', async () => {
    mockedStorage.getItem.mockResolvedValue('neon');
    await expect(getStoredTheme()).resolves.toBe('eink');
  });

  it('falls back to eink when nothing is stored', async () => {
    mockedStorage.getItem.mockResolvedValue(null);
    await expect(getStoredTheme()).resolves.toBe('eink');
  });
});

describe('storeTheme', () => {
  beforeEach(() => {
    mockedStorage.setItem.mockReset();
  });

  it.each<AppTheme>(['indigo', 'eink'])(
    'writes "%s" to AsyncStorage',
    async theme => {
      mockedStorage.setItem.mockResolvedValue(undefined);
      await storeTheme(theme);
      expect(mockedStorage.setItem).toHaveBeenCalledWith(
        THEME_STORAGE_KEY,
        theme,
      );
    },
  );
});
