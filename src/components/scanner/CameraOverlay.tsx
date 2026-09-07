import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Flashlight, FlashlightOff, Images } from 'lucide-react-native';
import { ActionButton } from '../common/Controls';
import { ClayColors } from '../../constants/theme';

export function CameraGuide() {
  return <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden>
    <View style={[styles.corner, styles.topLeft]} />
    <View style={[styles.corner, styles.topRight]} />
    <View style={[styles.corner, styles.bottomLeft]} />
    <View style={[styles.corner, styles.bottomRight]} />
  </View>;
}

interface CameraControlsProps {
  torchEnabled: boolean;
  torchAvailable: boolean;
  onToggleTorch: () => void;
  onManualCapture: () => void;
  onPickImage: () => void;
  captureDisabled: boolean;
  inputBusy: boolean;
}

export function CameraControls(props: CameraControlsProps) {
  return <View style={styles.controls}>
    <ActionButton accessibilityLabel={props.torchEnabled ? 'Turn torch off' : 'Turn torch on'}
      accessibilityState={{ selected: props.torchEnabled }}
      disabled={!props.torchAvailable || props.inputBusy}
      style={styles.tool} onPress={props.onToggleTorch}>
      {props.torchEnabled ? <Flashlight size={22} color={ClayColors.primary} /> : <FlashlightOff size={22} color={ClayColors.textSecondary} />}
      <Text style={styles.label}>Torch</Text>
    </ActionButton>
    <ActionButton accessibilityLabel="Capture answer sheet" disabled={props.captureDisabled || props.inputBusy}
      style={styles.shutter} onPress={props.onManualCapture}>
      {props.inputBusy ? <ActivityIndicator color={ClayColors.onPrimary} /> : <View style={styles.shutterCenter} />}
    </ActionButton>
    <ActionButton accessibilityLabel="Choose answer sheet from photos" disabled={props.inputBusy}
      style={styles.tool} onPress={props.onPickImage}>
      <Images size={22} color={ClayColors.textSecondary} />
      <Text style={styles.label}>Photos</Text>
    </ActionButton>
  </View>;
}

const styles = StyleSheet.create({
  corner: { position: 'absolute', width: 24, height: 24, borderColor: ClayColors.onPrimary, borderWidth: 2 },
  topLeft: { top: 14, left: 14, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 14, right: 14, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 14, left: 14, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 14, right: 14, borderLeftWidth: 0, borderTopWidth: 0 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', height: 76 },
  tool: { width: 72, height: 64, alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 14 },
  label: { fontSize: 12, fontWeight: '600', color: ClayColors.textSecondary },
  shutter: { width: 70, height: 70, borderRadius: 35, borderWidth: 3, borderColor: ClayColors.primary, backgroundColor: ClayColors.primary, alignItems: 'center', justifyContent: 'center' },
  shutterCenter: { width: 58, height: 58, borderRadius: 29, borderWidth: 3, borderColor: ClayColors.onPrimary },
});
