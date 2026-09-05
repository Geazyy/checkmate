import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Href, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, CheckCircle2, FileText } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { CameraOverlay } from '../../components/scanner/CameraOverlay';
import { useScanStore } from '../../store/useScanStore';
import { useExamStore } from '../../store/useExamStore';
import { scoreScanResults } from '../../services/omr/scannerEngine';
import { analyzeAnswerSheetImageDetailed } from '../../services/omr/imageScanner';
import { AppShell } from '../../components/common/AppShell';
import { ClayButtonStyle, ClayCardStyle, ClayColors } from '../../constants/theme';

export default function CameraScanScreen() {
  const router = useRouter();
  const { examId } = useLocalSearchParams<{ examId?: string }>();
  const { exams, activeExam, answerKeysByExamId, setActiveExam } = useExamStore();
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
  const availableExams = exams.filter((exam) => exam.status !== 'archived' && !exam.archived_at);
  const currentExam = availableExams.find((exam) => exam.id === examId);
  const currentAnswerKeys = currentExam ? answerKeysByExamId[currentExam.id] ?? [] : [];

  useEffect(() => {
    if (currentExam && activeExam?.id !== currentExam.id) setActiveExam(currentExam);
  }, [activeExam?.id, currentExam, setActiveExam]);

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
    if (Platform.OS === 'web' && currentExam) {
      startWebCamera();
    }
  }, [currentExam?.id]);

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
      const score = scoreScanResults(bubbleResults, currentAnswerKeys);

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
      router.push({ pathname: '/scan/review', params: { examId: currentExam.id } });
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

  if (!currentExam) {
    return (
      <AppShell title="Scan">
        <View style={styles.examPickerScreen}>
          <View style={styles.examPickerContent}>
            <Text style={styles.pickerEyebrow}>NEW SCAN</Text>
            <Text style={styles.pickerTitle}>Choose an exam</Text>
            <Text style={styles.pickerSubtitle}>
              The selected answer key and sheet layout will be used to grade the photo.
            </Text>

            <View style={styles.pickerList}>
              {availableExams.map((exam) => {
                const keyCount = (answerKeysByExamId[exam.id] ?? []).filter((key) => key.correct_options.length > 0).length;
                const keyReady = keyCount === exam.total_questions;
                return (
                  <TouchableOpacity
                    accessibilityLabel={`Choose ${exam.title}`}
                    key={exam.id}
                    style={styles.pickerCard}
                    onPress={() => {
                      setActiveExam(exam);
                      router.replace({ pathname: '/scan', params: { examId: exam.id } });
                    }}>
                    <View style={styles.pickerIcon}><FileText size={21} color="#67E8F9" /></View>
                    <View style={styles.pickerCopy}>
                      <Text style={styles.pickerExamTitle}>{exam.title}</Text>
                      <Text style={styles.pickerExamMeta}>{exam.class_name || 'General'} · {exam.total_questions} questions</Text>
                      <View style={styles.keyStatus}>
                        <CheckCircle2 size={13} color={keyReady ? '#34D399' : '#FBBF24'} />
                        <Text style={[styles.keyStatusText, !keyReady && styles.keyStatusWarning]}>
                          {keyReady ? 'Answer key ready' : `${keyCount}/${exam.total_questions} answers configured`}
                        </Text>
                      </View>
                    </View>
                    <ArrowRight size={19} color="#94A3B8" />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </AppShell>
    );
  }

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
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => currentExam
            ? router.replace(`/exams/${currentExam.id}` as Href)
            : router.replace('/exams')}>
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
  examPickerScreen: { flex: 1, backgroundColor: ClayColors.bg },
  examPickerContent: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20 },
  pickerEyebrow: { color: ClayColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  pickerTitle: { color: ClayColors.textPrimary, fontSize: 26, fontWeight: '800', marginTop: 4 },
  pickerSubtitle: { color: ClayColors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 6, marginBottom: 22, maxWidth: 520 },
  pickerList: { gap: 12 },
  pickerCard: { ...ClayCardStyle, minHeight: 88, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pickerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: ClayColors.cardSky, alignItems: 'center', justifyContent: 'center' },
  pickerCopy: { flex: 1, minWidth: 0 },
  pickerExamTitle: { color: ClayColors.textPrimary, fontSize: 15, fontWeight: '800' },
  pickerExamMeta: { color: ClayColors.textSecondary, fontSize: 11, marginTop: 4, fontWeight: '500' },
  keyStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  keyStatusText: { color: ClayColors.success, fontSize: 10, fontWeight: '700' },
  keyStatusWarning: { color: ClayColors.warning },
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    justifyContent: 'flex-end',
    padding: 20,
    paddingBottom: 36,
  },
  confirmPanel: {
    ...ClayCardStyle,
    padding: 18,
  },
  confirmText: {
    color: ClayColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  confirmActions: { flexDirection: 'row', gap: 10 },
  chooseAgainBtn: {
    flex: 1,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chooseAgainText: { color: ClayColors.textPrimary, fontWeight: '700' },
  usePhotoBtn: {
    ...ClayButtonStyle,
    flex: 2,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  usePhotoText: { color: '#FFFFFF', fontWeight: '700' },
  disabledBtn: { opacity: 0.55 },
  permissionContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: ClayColors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    zIndex: 1,
  },
  permissionTitle: {
    color: ClayColors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionSub: {
    color: ClayColors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  grantBtn: {
    ...ClayButtonStyle,
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
    ...ClayCardStyle,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  demoScanText: {
    color: ClayColors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  topHeader: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
    backgroundColor: 'rgba(240, 244, 248, 0.92)',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  backBtnText: {
    color: ClayColors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  examTitle: {
    color: ClayColors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  simAlignBtn: {
    ...ClayButtonStyle,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  simAlignText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
