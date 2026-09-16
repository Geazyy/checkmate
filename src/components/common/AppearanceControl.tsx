import React from 'react';
import { Text, View } from 'react-native';
import { Moon, Sun } from 'lucide-react-native';
import { ActionButton } from './Controls';
import { useAppTheme } from '../../constants/theme';
import { useAppearanceStore } from '../../store/useAppearanceStore';

export function AppearanceControl() {
  const { ClayColors: colors, mode } = useAppTheme();
  const setMode = useAppearanceStore(state => state.setMode);
  return <View style={{ gap: 8, marginVertical: 12 }}>
    <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>Appearance</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="Appearance" style={{ flexDirection: 'row', gap: 8 }}>
      {(['light', 'dark'] as const).map(value => {
        const selected = mode === value;
        const Icon = value === 'light' ? Sun : Moon;
        const color = selected ? colors.onPrimary : colors.textPrimary;
        return <ActionButton key={value} accessibilityRole="radio" accessibilityLabel={`${value === 'light' ? 'Light' : 'Dark'} mode`}
          accessibilityState={{ checked: selected }} onPress={() => setMode(value)}
          style={{ flex: 1, minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: selected ? colors.primary : colors.borderDarker,
            backgroundColor: selected ? colors.primary : colors.surfaceMuted, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color={color} />
          <Text style={{ color, fontWeight: '700' }}>{value === 'light' ? 'Light' : 'Dark'}</Text>
        </ActionButton>;
      })}
    </View>
  </View>;
}
