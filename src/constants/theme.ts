import { Platform, TextStyle, ViewStyle } from 'react-native';
import { useMemo } from 'react';
import { useAppearanceStore } from '../store/useAppearanceStore';

export const Colors = {
  light: {
    text: '#0F172A',
    background: '#F0F4F8',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EEF2FF',
    textSecondary: '#475569',
  },
  dark: {
    text: '#F5F5F6',
    background: '#141416',
    backgroundElement: '#222226',
    backgroundSelected: '#303044',
    textSecondary: '#CBCBD2',
  },
} as const;

export const ClayColors = {
  bg: '#F0F4F8',
  cardBg: '#FFFFFF',
  cardIndigo: '#EEF2FF',
  cardMint: '#ECFDF5',
  cardSky: '#E0F2FE',
  cardAmber: '#FEF3C7',
  cardRose: '#FEE2E2',
  cardPurple: '#F3E8FF',
  input: '#EBF0F6',
  surfaceMuted: '#F8FAFC',
  surfaceInset: '#F1F5F9',
  indigoBorder: '#C7D2FE',
  skyBorder: '#BAE6FD',
  mintBorder: '#A7F3D0',
  skyText: '#0369A1',
  onPrimary: '#FFFFFF',
  shadow: '#8CA0BA',
  viewfinder: '#0F172A',
  overlay: 'rgba(15, 23, 42, 0.48)',

  primary: '#4F46E5',
  primaryBevel: '#3730A3',
  primaryLight: '#818CF8',

  success: '#047857',
  successBevel: '#047857',

  warning: '#B45309',
  warningBevel: '#B45309',

  danger: '#BE123C',
  dangerBevel: '#9F1239',

  accent: '#0369A1',
  accentBevel: '#0891B2',

  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',

  borderLight: 'rgba(255, 255, 255, 0.9)',
  borderSubtle: '#E2E8F0',
  borderDarker: '#CBD5E1',
} as const;

export type ThemeColor = keyof typeof Colors.light;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

export const ClayCardStyle: ViewStyle = {
  backgroundColor: ClayColors.cardBg,
  borderRadius: 22,
  borderWidth: 2,
  borderColor: 'rgba(255, 255, 255, 0.9)',
  shadowColor: '#8CA0BA',
  shadowOffset: { width: 5, height: 7 },
  shadowOpacity: 0.14,
  shadowRadius: 7,
  elevation: 2,
  ...(Platform.OS === 'web'
    ? ({
        boxShadow:
          '3px 4px 10px rgba(160, 175, 195, 0.2), -2px -2px 6px rgba(255, 255, 255, 0.8)',
      } satisfies ViewStyle)
    : {}),
};

export const ClayButtonStyle: ViewStyle = {
  backgroundColor: ClayColors.primary,
  minHeight: 44,
  borderRadius: 18,
  borderTopWidth: 2,
  borderTopColor: 'rgba(255, 255, 255, 0.4)',
  borderBottomWidth: 4,
  borderBottomColor: '#3730A3',
  shadowColor: '#4F46E5',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.18,
  shadowRadius: 8,
  elevation: 5,
};

export const ClayInputStyle: TextStyle = {
  backgroundColor: ClayColors.input,
  minHeight: 44,
  borderRadius: 16,
  borderWidth: 1.5,
  borderColor: '#CBD5E1',
};

type Palette = { [K in keyof typeof ClayColors]: string };
const darkColors: Palette = {
  ...ClayColors,
  bg: '#141416', cardBg: '#222226', input: '#2B2B31',
  surfaceMuted: '#27272C', surfaceInset: '#303036',
  cardIndigo: '#303044', cardMint: '#193B32', cardSky: '#203744',
  cardAmber: '#40341E', cardRose: '#422630', cardPurple: '#372C45',
  indigoBorder: '#575476', skyBorder: '#38637B', mintBorder: '#316552',
  skyText: '#82D3F6', shadow: '#000000', overlay: 'rgba(0,0,0,0.65)',
  primary: '#A5A0FF', primaryBevel: '#6962D2', primaryLight: '#BDB9FF',
  onPrimary: '#17152E',
  success: '#6EE7B7', successBevel: '#23765B',
  warning: '#FBBF24', warningBevel: '#8F651B',
  danger: '#FDA4AF', dangerBevel: '#9F3550', accent: '#7DD3FC', accentBevel: '#267A94',
  textPrimary: '#F5F5F6', textSecondary: '#CBCBD2', textMuted: '#A9A9B6',
  borderLight: '#424249', borderSubtle: '#38383F', borderDarker: '#55555F',
};

export interface AppTheme {
  mode: 'light' | 'dark';
  ClayColors: Palette;
  ClayCardStyle: ViewStyle;
  ClayButtonStyle: ViewStyle;
  ClayInputStyle: TextStyle;
}

const lightTheme: AppTheme = { mode: 'light', ClayColors, ClayCardStyle, ClayButtonStyle, ClayInputStyle };
const darkTheme: AppTheme = {
  mode: 'dark', ClayColors: darkColors,
  ClayCardStyle: { ...ClayCardStyle, backgroundColor: darkColors.cardBg, borderColor: darkColors.borderSubtle,
    shadowColor: '#000000', ...(Platform.OS === 'web' ? { boxShadow: '0 4px 12px rgba(0,0,0,0.3)' } : {}) },
  ClayButtonStyle: { ...ClayButtonStyle, backgroundColor: darkColors.primary, borderTopColor: darkColors.borderLight,
    borderBottomColor: darkColors.primaryBevel, shadowColor: '#000000' },
  ClayInputStyle: { ...ClayInputStyle, backgroundColor: darkColors.input, borderColor: darkColors.borderDarker },
};

export function useAppTheme(): AppTheme {
  return useAppearanceStore(state => state.mode) === 'dark' ? darkTheme : lightTheme;
}

export function useThemedStyles<T extends Record<string, object>>(factory: (theme: AppTheme) => T): T {
  const theme = useAppTheme();
  return useMemo(() => {
    const styles = factory(theme);
    if (theme.mode === 'light') return styles;
    // Existing clay highlights are white in light mode; avoid glowing rims in dark mode.
    return Object.fromEntries(Object.entries(styles).map(([name, value]) => {
      const style = { ...value } as Record<string, unknown>;
      for (const key of Object.keys(style)) {
        if (/^border.*Color$/.test(key) && typeof style[key] === 'string'
          && /^rgba?\(255,\s*255,\s*255/.test(style[key] as string)) {
          style[key] = theme.ClayColors.borderSubtle;
        }
      }
      if (style.boxShadow) style.boxShadow = '0 3px 10px rgba(0,0,0,0.3)';
      if (style.shadowColor) style.shadowColor = '#000000';
      return [name, style];
    })) as T;
  }, [factory, theme]);
}
