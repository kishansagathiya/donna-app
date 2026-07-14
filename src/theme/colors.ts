export type ThemeColors = {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryRing: string;
  surface: string;
  background: string;
  border: string;
  text: string;
  muted: string;
  destructive: string;
  white: string;
  /** Custom face for e-ink; omit for system default. */
  fontFamily?: string;
  shadowEnabled: boolean;
};

export const indigoPalette: ThemeColors = {
  primary: '#5046E5',
  primaryHover: '#4338CA',
  primaryLight: '#EDE9FE',
  primaryRing: '#6366F1',
  surface: '#F3F4F6',
  background: '#FFFFFF',
  border: '#E5E7EB',
  text: '#111827',
  muted: '#6B7280',
  destructive: '#DC2626',
  white: '#FFFFFF',
  shadowEnabled: true,
};

/** Matches donna-web html[data-theme="eink"] tokens in app-shell.css. */
export const einkPalette: ThemeColors = {
  primary: '#1A1A1A',
  primaryHover: '#000000',
  primaryLight: '#E8E6DF',
  primaryRing: '#333333',
  surface: '#F4F1EA',
  background: '#F4F1EA',
  border: '#D8D4C8',
  text: '#1A1A1A',
  muted: '#5C564E',
  destructive: '#1A1A1A',
  white: '#FFFFFF',
  fontFamily: 'Literata',
  shadowEnabled: false,
};
