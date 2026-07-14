import { Platform } from 'react-native';
import {
  LITERATA_REGULAR,
  LITERATA_SEMIBOLD,
  resolveThemeFontFamily,
  themeFontStyle,
} from './font';

describe('resolveThemeFontFamily', () => {
  it('returns undefined when theme has no custom font', () => {
    expect(resolveThemeFontFamily(undefined, { fontSize: 16 })).toBeUndefined();
  });

  it('picks Literata regular for e-ink body text', () => {
    expect(resolveThemeFontFamily('Literata', { fontSize: 16 })).toBe(
      LITERATA_REGULAR,
    );
  });

  it('picks Literata semibold for bold weights', () => {
    expect(
      resolveThemeFontFamily('Literata', { fontSize: 16, fontWeight: '700' }),
    ).toBe(LITERATA_SEMIBOLD);
  });
});

describe('themeFontStyle', () => {
  it('returns undefined without a theme font', () => {
    expect(themeFontStyle(undefined)).toBeUndefined();
  });

  it('returns a fontFamily style for e-ink', () => {
    expect(themeFontStyle('Literata', { fontSize: 14 })).toEqual({
      fontFamily: LITERATA_REGULAR,
    });
  });

  it('normalizes weight on Android when using SemiBold file', () => {
    if (Platform.OS !== 'android') {
      return;
    }
    expect(
      themeFontStyle('Literata', { fontSize: 14, fontWeight: '600' }),
    ).toEqual({
      fontFamily: LITERATA_SEMIBOLD,
      fontWeight: '400',
    });
  });
});
