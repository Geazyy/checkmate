import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useIsFocused, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { CameraOverlay } from '../../components/scanner/CameraOverlay';
import { useScanStore } from '../../store/useScanStore';
import { useExamStore } from '../../store/useExamStore';
import { scoreScanResults } from '../../services/omr/scannerEngine';
import { analyzeAnswerSheetImageDetailed } from '../../services/omr/imageScanner';

export default function CameraScanScreen() {
  const router = useRouter();
  const { exams, activeExam, activeAnswerKeys } = useExamStore();
  const { isAligned, torchEnabled, setIsAligned, setTorchEnabled, setLastScannedResult } =
    useScanStore();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanMessage, setScanMessage] = useState('Align answer sheet inside the frame...');
  const [isProcessing, setIsProcessing] = useState(false);
  const [webCamActive, setWebCamActive] = useState(false);
  const [camError, setCamError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string>();

  const videoRef = useRef<any>(null);
  const cameraRef = useRef<CameraView>(null);
  const isFocused = useIsFocused();
  const currentExam = activeExam || exams[0];

  const startWebCamera = async () => {
    setCamError('');
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setCamError(
        '🔒 Mobile Chrome restricts live video to HTTPS. To use live camera feed on your phone, restart with: npx expo start --web --tunnel'
      );
    }
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });
        setWebCamActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e1) {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
          setWebCamActive(true);
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
          }
        } catch (e2: any) {
          console.warn('Web camera stream blocked or unavailable:', e2);
          setWebCamActive(false);
          setCamError(
            '🔒 Mobile Chrome blocks live camera video over plain HTTP (http://10.99.46.94). Use HTTPS tunnel or Instant Scan below!'
          );
        }
      }
    } else {
      setCamError(
        '🔒 Mobile Chrome blocks live camera video over plain HTTP (http://10.99.46.94). Use HTTPS tunnel or Instant Scan below!'
      );
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web') {
      startWebCamera();
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      setCameraReady(false);
      setScanMessage(
        currentExam?.total_questions === 25
          ? 'Frame only questions 1-25 from the left column...'
          : 'Align answer sheet inside the frame...'
      );
    }
  }, [currentExam?.total_questions, isFocused]);

  const captureWebFrame = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight || typeof document === 'undefined') {
      return undefined;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const handlePerformScan = async (imageUri: string) => {
    if (!currentExam || isProcessing) return;

    setIsProcessing(true);
    setScanMessage('Preparing and reading the answer rows...');

    try {
      setScanMessage(
        currentExam.total_questions === 25
          ? 'Reading questions 1-25 from the left column...'
          : `Reading ${currentExam.total_questions} answer rows...`
      );
      const analysis = await analyzeAnswerSheetImageDetailed(
        imageUri,
        currentExam.total_questions,
        currentExam.options_per_question
      );
      const bubbleResults = analysis.results;
      const score = scoreScanResults(bubbleResults, activeAnswerKeys);

      const newScanResult = {
        id: `scan-${Date.now()}`,
        exam_id: currentExam.id,
        raw_score: score.rawScore,
        max_score: score.maxScore,
        percentage_score: score.percentageScore,
        status: bubbleResults.some((item) => item.isAmbiguous)
          ? ('flagged_manual' as const)
          : ('graded' as const),
        cropped_sheet_image_url: analysis.previewImageUri,
        scanned_at: new Date().toISOString(),
        student: {
          id: `stud-${Math.floor(Math.random() * 900 + 100)}`,
          teacher_id: currentExam.teacher_id,
          student_number: `2026-${Math.floor(Math.random() * 90 + 10)}`,
          first_name: 'Jordan',
          last_name: 'Taylor',
          created_at: new Date().toISOString(),
        },
        items: score.itemDetails,
      };

      setLastScannedResult(newScanResult);
      router.push('/scan/review');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to capture the sheet.';
      setScanMessage(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCapturePhoto = async () => {
    if (isProcessing) return;
    setScanMessage('Capturing answer sheet...');
    try {
      const imageUri = Platform.OS === 'web'
        ? captureWebFrame()
        : (await cameraRef.current?.takePictureAsync({
            quality: 0.9,
            skipProcessing: false,
          }))?.uri;
      if (!imageUri) throw new Error('The camera did not return an image.');
      setPendingImageUri(imageUri);
      setScanMessage('Check that rows 1-25 and all A-D circles are visible.');
    } catch (error) {
      setScanMessage(error instanceof Error ? error.message : 'Unable to capture the sheet.');
    }
  };

  const handlePickImage = async () => {
    if (isProcessing) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setScanMessage('Photo access is required to choose an answer-sheet image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setPendingImageUri(result.assets[0].uri);
      setScanMessage('Check that rows 1-25 and all A-D circles are visible.');
    }
  };

  const handleWebFileChange = (e: any) => {
    if (e.target?.files?.[0]) {
      const imageUri = URL.createObjectURL(e.target.files[0]);
      setPendingImageUri(imageUri);
      setScanMessage('Check that rows 1-25 and all A-D circles are visible.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Live Embedded Camera Viewfinder (Native or Web) */}
      {pendingImageUri ? (
        <Image source={{ uri: pendingImageUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
      ) : Platform.OS === 'web' ? (
        <View style={StyleSheet.absoluteFill}>
          {/* Always render <video> tag in Web DOM so ref is connected */}
          {/* @ts-ignore */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: webCamActive ? 'block' : 'none',
            }}
          />

          {!webCamActive && (
            <View style={styles.permissionContainer}>
              <Text style={styles.permissionTitle}>📷 In-App Camera Viewfinder</Text>
              <Text style={styles.permissionSub}>
                {camError ||
                  'Press below to activate the live camera stream inside the CheckMate scanner app:'}
              </Text>

              <TouchableOpacity style={styles.grantBtn} onPress={startWebCamera}>
                <Text style={styles.grantBtnText}>▶️ Enable Live Camera Stream</Text>
              </TouchableOpacity>

              {/* Direct Photo Upload */}
              <label style={webBtnStyle}>
                📁 Upload Answer Sheet Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleWebFileChange}
                  style={{ display: 'none' }}
                />
              </label>

              <TouchableOpacity
                style={styles.demoScanBtn}
                onPress={() => void handleCapturePhoto()}>
                <Text style={styles.demoScanText}>⚡ Instant In-App OMR Scan</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : !isFocused ? (
        <View style={StyleSheet.absoluteFill} />
      ) : permission?.granted ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torchEnabled}
          onCameraReady={() => {
            setCameraReady(true);
            setScanMessage(
              currentExam?.total_questions === 25
                ? 'Frame only questions 1-25 from the left column...'
                : 'Align answer sheet inside the frame...'
            );
          }}
          onMountError={({ message }) => {
            setCameraReady(false);
            setScanMessage(`Camera unavailable: ${message}`);
          }}
        />
      ) : (
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>📷 Camera Permission Required</Text>
          <Text style={styles.permissionSub}>
            CheckMate needs camera access to scan and grade OMR bubble answer sheets.
          </Text>
          <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
            <Text style={styles.grantBtnText}>Grant Camera Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.demoScanBtn}
            onPress={() => void handlePickImage()}>
            <Text style={styles.demoScanText}>Choose Answer Sheet Photo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Top Header Controls */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>✕ Close</Text>
        </TouchableOpacity>
        <Text style={styles.examTitle}>{currentExam?.title || 'OMR Scanner'}</Text>
        <TouchableOpacity style={styles.simAlignBtn} onPress={() => setIsAligned(!isAligned)}>
          <Text style={styles.simAlignText}>{isAligned ? 'Target Lock: ON' : 'Align Target'}</Text>
        </TouchableOpacity>
      </View>

      {/* Visual Reticle Overlay */}
      {pendingImageUri ? (
        <View style={styles.confirmOverlay} pointerEvents="box-none">
          <View style={styles.confirmPanel}>
            <Text style={styles.confirmText}>{scanMessage}</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                disabled={isProcessing}
                style={styles.chooseAgainBtn}
                onPress={() => {
                  setPendingImageUri(undefined);
                  setScanMessage('Frame only questions 1-25 from the left column...');
                }}>
                <Text style={styles.chooseAgainText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={isProcessing}
                style={[styles.usePhotoBtn, isProcessing && styles.disabledBtn]}
                onPress={() => void handlePerformScan(pendingImageUri)}>
                <Text style={styles.usePhotoText}>{isProcessing ? 'Reading...' : 'Use Photo'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (Platform.OS !== 'web' || webCamActive) ? (
        <CameraOverlay
          isAligned={isAligned}
          torchEnabled={torchEnabled}
          onToggleTorch={() => setTorchEnabled(!torchEnabled)}
          onPickImage={() => void handlePickImage()}
          onManualCapture={() => void handleCapturePhoto()}
          pickDisabled={isProcessing}
          captureDisabled={isProcessing || (Platform.OS !== 'web' && !cameraReady)}
          statusText={scanMessage}
        />
      ) : null}
    </View>
  );
}

const webBtnStyle: React.CSSProperties = {
  backgroundColor: '#4F46E5',
  color: '#FFFFFF',
  padding: '14px 24px',
  borderRadius: '16px',
  width: '100%',
  textAlign: 'center',
  fontWeight: '700',
  fontSize: '14px',
  cursor: 'pointer',
  marginBottom: '12px',
  boxSizing: 'border-box',
  display: 'block',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    justifyContent: 'flex-end',
    padding: 20,
    paddingBottom: 36,
  },
  confirmPanel: {
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 16,
  },
  confirmText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 14,
  },
  confirmActions: { flexDirection: 'row', gap: 10 },
  chooseAgainBtn: {
    flex: 1,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  chooseAgainText: { color: '#F8FAFC', fontWeight: '700' },
  usePhotoBtn: {
    flex: 2,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: 8,
  },
  usePhotoText: { color: '#FFFFFF', fontWeight: '700' },
  disabledBtn: { opacity: 0.55 },
  permissionContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    zIndex: 1,
  },
  permissionTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionSub: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  grantBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  grantBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  demoScanBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  demoScanText: {
    color: '#06B6D4',
    fontSize: 13,
    fontWeight: '600',
  },
  topHeader: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#334155',
  },
  backBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
  examTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  simAlignBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#4F46E5',
  },
  simAlignText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
