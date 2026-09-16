import { useAppTheme, useThemedStyles, AppTheme } from '../../constants/theme';
import React, { forwardRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, TextInputProps, TouchableOpacity, TouchableOpacityProps } from 'react-native';


export function ActionButton({ style, disabled, accessibilityState, onFocus, onBlur, ...props }: TouchableOpacityProps) {
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);
  return <TouchableOpacity {...props} accessibilityRole={props.accessibilityRole ?? 'button'}
    {...(Platform.OS === 'web' && typeof accessibilityState?.selected === 'boolean'
      ? { 'aria-pressed': accessibilityState.selected } : {})}
    {...(Platform.OS === 'web' && typeof accessibilityState?.checked === 'boolean'
      ? { 'aria-checked': accessibilityState.checked } : {})}
    activeOpacity={0.7} disabled={disabled} accessibilityState={{ ...accessibilityState, disabled: Boolean(disabled) }}
    onFocus={(event) => { setFocused(true); onFocus?.(event); }}
    onBlur={(event) => { setFocused(false); onBlur?.(event); }}
    style={[style, styles.touchTarget, focused && styles.focused, disabled && styles.disabled]} />;
}

export const AccessibleInput = forwardRef<TextInput, TextInputProps>(function AccessibleInput(
  { style, onFocus, onBlur, editable, ...props }, ref
) {
  const { ClayColors, ClayInputStyle } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);
  return <TextInput {...props} ref={ref} editable={editable}
    accessibilityLabel={props.accessibilityLabel ?? props.placeholder}
    placeholderTextColor={ClayColors.textMuted}
    onFocus={(event) => { setFocused(true); onFocus?.(event); }}
    onBlur={(event) => { setFocused(false); onBlur?.(event); }}
    style={[ClayInputStyle, styles.input, style, focused && styles.inputFocused, editable === false && styles.disabled]} />;
});

const createStyles = ({ ClayColors }: AppTheme) => StyleSheet.create({
  touchTarget: { minWidth: 44, minHeight: 44 },
  input: { color: ClayColors.textPrimary, paddingHorizontal: 12, paddingVertical: 10 },
  inputFocused: { borderColor: ClayColors.primary },
  focused: Platform.OS === 'web' ? { outlineColor: ClayColors.primary, outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 3 } : {},
  disabled: { opacity: 0.48 },
});
