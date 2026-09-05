import { Platform, ViewStyle } from 'react-native';

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

  primary: '#4F46E5',
  primaryBevel: '#3730A3',
  primaryLight: '#818CF8',

  success: '#10B981',
  successBevel: '#047857',

  warning: '#F59E0B',
  warningBevel: '#B45309',

  danger: '#EF4444',
  dangerBevel: '#B91C1C',

  accent: '#06B6D4',
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
  backgroundColor: '#FFFFFF',
  borderRadius: 22,
  borderWidth: 2,
  borderColor: 'rgba(255, 255, 255, 0.9)',
  shadowColor: '#8CA0BA',
  shadowOffset: { width: 5, height: 7 },
  shadowOpacity: 0.28,
  shadowRadius: 10,
  elevation: 6,
  ...(Platform.OS === 'web'
    ? ({
        boxShadow:
          '6px 6px 16px rgba(160, 175, 195, 0.4), -5px -5px 14px rgba(255, 255, 255, 0.95), inset 2px 2px 4px rgba(255, 255, 255, 0.8)',
      } as any)
    : {}),
};

export const ClayButtonStyle: ViewStyle = {
  backgroundColor: '#4F46E5',
  borderRadius: 18,
  borderTopWidth: 2,
  borderTopColor: 'rgba(255, 255, 255, 0.4)',
  borderBottomWidth: 4,
  borderBottomColor: '#3730A3',
  shadowColor: '#4F46E5',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.35,
  shadowRadius: 8,
  elevation: 5,
};

export const ClayInputStyle: ViewStyle = {
  backgroundColor: '#EBF0F6',
  borderRadius: 16,
  borderWidth: 1.5,
  borderColor: '#CBD5E1',
};

