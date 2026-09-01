import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Flashlight, FlashlightOff, Images } from 'lucide-react-native';

interface CameraOverlayProps {
  isAligned: boolean;
  torchEnabled: boolean;
  onToggleTorch: () => void;
  onManualCapture: () => void;
  onPickImage: () => void;
  captureDisabled?: boolean;
  pickDisabled?: boolean;
  statusText?: string;
}

export const CameraOverlay: React.FC<CameraOverlayProps> = ({
  isAligned,
  torchEnabled,
  onToggleTorch,
  onManualCapture,
  onPickImage,
  captureDisabled = false,
  pickDisabled = false,
  statusText = 'Align 4 corner anchors with answer sheet...',
}) => {
  return (
    <View style={styles.overlayContainer} pointerEvents="box-none">
      {/* 4 Animated Corner Fiducial Guides */}
      <View style={[styles.corner, styles.topLeft, isAligned && styles.cornerAligned]} />
      <View style={[styles.corner, styles.topRight, isAligned && styles.cornerAligned]} />
      <View style={[styles.corner, styles.bottomLeft, isAligned && styles.cornerAligned]} />
      <View style={[styles.corner, styles.bottomRight, isAligned && styles.cornerAligned]} />

      {/* Alignment Center Target Grid */}
      <View style={[styles.targetFrame, isAligned && styles.targetFrameAligned]}>
        <Text style={styles.guidanceText}>{statusText}</Text>
      </View>

      {/* Control Floating Toolbar */}
      <View style={styles.controlsBar}>
        <View style={styles.secondaryControls}>
          <TouchableOpacity style={styles.toolBtn} onPress={onToggleTorch}>
            {torchEnabled
              ? <Flashlight size={17} color="#F8FAFC" />
              : <FlashlightOff size={17} color="#F8FAFC" />}
            <Text style={styles.toolBtnText}>{torchEnabled ? 'Torch on' : 'Torch off'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityLabel="Choose answer sheet from photos"
            disabled={pickDisabled}
            style={[styles.toolBtn, pickDisabled && styles.captureBtnDisabled]}
            onPress={onPickImage}>
            <Images size={17} color="#F8FAFC" />
            <Text style={styles.toolBtnText}>Photos</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          accessibilityLabel="Capture answer sheet"
          disabled={captureDisabled}
          style={[styles.captureBtn, captureDisabled && styles.captureBtnDisabled]}
          onPress={onManualCapture}>
          <View style={styles.innerCaptureBtn} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    padding: 30,
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#06B6D4', // Cyan guide default
    borderWidth: 4,
  },
  cornerAligned: {
    borderColor: '#10B981', // Emerald green when aligned
  },
  topLeft: {
    top: 60,
    left: 30,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 60,
    right: 30,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 120,
    left: 30,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 120,
    right: 30,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  targetFrame: {
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  targetFrameAligned: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderColor: '#10B981',
  },
  guidanceText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  secondaryControls: {
    gap: 8,
  },
  toolBtn: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    minWidth: 102,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  toolBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
  captureBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  captureBtnDisabled: {
    opacity: 0.45,
  },
  innerCaptureBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#4F46E5',
  },
});
