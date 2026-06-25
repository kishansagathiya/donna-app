import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ThemeColors } from '../theme/colors';
import {
  getStoredTheme,
  storeTheme,
  THEME_PALETTES,
  type AppTheme,
} from '../theme/theme';

type ThemeContextValue = {
  theme: AppTheme;
  colors: ThemeColors;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>('indigo');

  useEffect(() => {
    void getStoredTheme().then(setThemeState);
  }, []);

  useEffect(() => {
    void storeTheme(theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      colors: THEME_PALETTES[theme],
      setTheme: setThemeState,
      toggleTheme: () =>
        setThemeState(current => (current === 'cream' ? 'indigo' : 'cream')),
    }),
    [theme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
