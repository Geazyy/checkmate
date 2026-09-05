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
              ? <Flashlight size={17} color="#0F172A" />
              : <FlashlightOff size={17} color="#0F172A" />}
            <Text style={styles.toolBtnText}>{torchEnabled ? 'Torch on' : 'Torch off'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityLabel="Choose answer sheet from photos"
            disabled={pickDisabled}
            style={[styles.toolBtn, pickDisabled && styles.captureBtnDisabled]}
            onPress={onPickImage}>
            <Images size={17} color="#0F172A" />
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
    width: 44,
    height: 44,
    borderColor: '#06B6D4', // Cyan guide default
    borderWidth: 4,
    borderRadius: 8,
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
    paddingHorizontal: 22,
    paddingVertical: 14,
    backgroundColor: 'rgba(240, 244, 248, 0.92)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    shadowColor: '#8CA0BA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  targetFrameAligned: {
    backgroundColor: 'rgba(236, 253, 245, 0.95)',
    borderColor: '#10B981',
  },
  guidanceText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  secondaryControls: {
    gap: 10,
  },
  toolBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    minWidth: 108,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#8CA0BA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  toolBtnText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  captureBtnDisabled: {
    opacity: 0.45,
  },
  innerCaptureBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#4F46E5',
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 4,
    borderBottomColor: '#3730A3',
  },
});
