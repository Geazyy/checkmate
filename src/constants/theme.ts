import { Platform, TextStyle, ViewStyle } from 'react-native';

export const Colors = {
  light: {
    text: '#0F172A',
    background: '#F0F4F8',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EEF2FF',
    textSecondary: '#475569',
  },
  dark: {
    text: '#0F172A',
    background: '#F0F4F8',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EEF2FF',
    textSecondary: '#475569',
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
