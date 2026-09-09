import { ActionButton as TouchableOpacity } from '../../components/common/Controls';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Href, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, CheckCircle2, FileText, RotateCw, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { CameraControls, CameraGuide } from '../../components/scanner/CameraOverlay';
import { fitCameraFrame, PORTRAIT_CAMERA_ASPECT, selectPictureSize } from '../../services/omr/captureGeometry';
import { useScanStore } from '../../store/useScanStore';
import { useExamStore } from '../../store/useExamStore';
import { scoreScanResults } from '../../services/omr/scannerEngine';
import { analyzeAnswerSheetImageDetailed, OmrScanError, OMR_SCANNER_REVISION } from '../../services/omr/imageScanner';
import { AppShell } from '../../components/common/AppShell';
import { ClayButtonStyle, ClayCardStyle, ClayColors } from '../../constants/theme';
import { beginReviewTiming, checkCancelled, createScanTimer, scanStage, ScanCancelledError } from '../../services/omr/scanTiming';

export default function CameraScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { examId } = useLocalSearchParams<{ examId?: string }>();
  const { exams, activeExam, answerKeysByExamId, setActiveExam } = useExamStore();
  const { torchEnabled, setTorchEnabled, setLastScannedResult } =
    useScanStore();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanMessage, setScanMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [webCamActive, setWebCamActive] = useState(false);
  const [camError, setCamError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string>();
  const [isPreparing, setIsPreparing] = useState(false);
  const [pictureSize, setPictureSize] = useState<string>();
  const [frameArea, setFrameArea] = useState({ width: 0, height: 0 });
  const [webAspect, setWebAspect] = useState(PORTRAIT_CAMERA_ASPECT);
  const scanController = useRef<AbortController | null>(null);
  const inputBusy = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const webCameraGeneration = useRef(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraSetup = useRef(false);
  const mounted = useRef(true);
  const cameraRef = useRef<CameraView>(null);
  const isFocused = useIsFocused();
  const availableExams = exams.filter((exam) => exam.status !== 'archived' && !exam.archived_at);
  const currentExam = availableExams.find((exam) => exam.id === examId);
  const currentAnswerKeys = currentExam ? answerKeysByExamId[currentExam.id] ?? [] : [];
  const captureGuidance = currentExam
    ? `Keep questions 1-${currentExam.total_questions} and all A-${currentExam.options_per_question === 5 ? 'E' : 'D'} bubbles visible.`
    : 'Keep the complete answer sheet visible.';
  const frame = fitCameraFrame(frameArea.width, frameArea.height, Platform.OS === 'web' ? webAspect : PORTRAIT_CAMERA_ASPECT);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      scanController.current?.abort();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  useEffect(() => () => {
    if (pendingImageUri?.startsWith('blob:')) URL.revokeObjectURL(pendingImageUri);
  }, [pendingImageUri]);

  useEffect(() => {
    if (currentExam && activeExam?.id !== currentExam.id) setActiveExam(currentExam);
  }, [activeExam?.id, currentExam, setActiveExam]);

  const startWebCamera = useCallback(async () => {
    const generation = ++webCameraGeneration.current;
    setCamError('');
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setCamError('Camera access requires HTTPS or localhost. You can still choose a photo.');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 }, height: { ideal: 1200 } },
        });
        if (!mounted.current || generation !== webCameraGeneration.current) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = stream;
        setWebCamActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        if (generation !== webCameraGeneration.current) return;
        setWebCamActive(false);
        setCamError('Camera unavailable. Allow camera access in your browser or choose a photo.');
      }
    } else {
      setCamError('Live camera is unavailable in this browser. Choose an answer-sheet photo.');
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && currentExam && isFocused && !pendingImageUri) {
      // Camera permission and stream availability are external state, including synchronous unsupported-browser errors.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void startWebCamera();
    }
    return () => {
      webCameraGeneration.current++;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [currentExam, isFocused, pendingImageUri, startWebCamera]);

  const captureWebFrame = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight || typeof document === 'undefined') {
      return undefined;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.92);
  };

  const handlePerformScan = async (imageUri: string) => {
    if (!currentExam || scanController.current || inputBusy.current) return;
    const controller = new AbortController();
    scanController.current = controller;
    const started = performance.now();

    setIsProcessing(true);
    setScanMessage('Preparing and reading the answer rows...');

    try {
      const analysis = await analyzeAnswerSheetImageDetailed(
        imageUri,
        currentExam.total_questions,
        currentExam.options_per_question,
        { onStage: setScanMessage, signal: controller.signal, preserveOrientation: true }
      );
      await scanStage('Saving results', { onStage: setScanMessage, signal: controller.signal });
      const bubbleResults = analysis.results;
      const saveStart = performance.now();
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
        items: score.itemDetails,
      };

      checkCancelled(controller.signal);
      setLastScannedResult(newScanResult);
      analysis.timings.saveResultsMs = performance.now() - saveStart;
      analysis.timings.totalMs = performance.now() - started;
      beginReviewTiming(newScanResult.id, analysis.timings);
      router.push({ pathname: '/scan/review', params: { examId: currentExam.id } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to capture the sheet.';
      if (__DEV__ && !(error instanceof ScanCancelledError)) console.info('[CheckMate OMR failed]', JSON.stringify({
        revision: OMR_SCANNER_REVISION,
        elapsedMs: Math.round(performance.now() - started),
        code: error instanceof OmrScanError ? 'alignment' : 'scan-failed',
        ...(error instanceof OmrScanError ? error.details : undefined),
      }));
      setScanMessage(error instanceof ScanCancelledError ? 'Scan cancelled. Retry or retake the photo.' : message);
    } finally {
      scanController.current = null;
      setIsProcessing(false);
    }
  };

  const handleCapturePhoto = async () => {
    if (scanController.current || inputBusy.current) return;
    inputBusy.current = true;
    setIsPreparing(true);
    setScanMessage('Capturing answer sheet...');
    const captureTimer = createScanTimer();
    try {
      let imageUri: string | undefined;
      if (Platform.OS === 'web') imageUri = captureWebFrame();
      else {
        const photo = await cameraRef.current?.takePictureAsync({ quality: 0.92, skipProcessing: false, exif: false });
        imageUri = photo?.uri;
        // Some Android sensors report landscape near a flat, top-down capture even in a portrait app.
        if (photo && photo.width > photo.height) imageUri = await renderPhoto(photo.uri, -90);
      }
      if (!imageUri) throw new Error('The camera did not return an image.');
      if (!mounted.current) return;
      setPendingImageUri(imageUri);
      setScanMessage(captureGuidance);
      if (__DEV__) console.info('[Camera timing]', { captureAndOrientationMs: captureTimer.finish().totalMs, pictureSize });
    } catch (error) {
      setScanMessage(error instanceof Error ? error.message : 'Unable to capture the sheet.');
    } finally {
      inputBusy.current = false;
      if (mounted.current) setIsPreparing(false);
    }
  };

  const renderPhoto = async (uri: string, rotation = 0) => {
    const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
    });
    const context = ImageManipulator.manipulate(uri);
    try {
      if (rotation) context.rotate(rotation);
      const width = rotation % 180 ? size.height : size.width;
      const height = rotation % 180 ? size.width : size.height;
      if (Math.max(width, height) > 2048) context.resize(width > height ? { width: 2048 } : { height: 2048 });
      const rendered = await context.renderAsync();
      try { return (await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 })).uri; }
      finally { rendered.release(); }
    } finally { context.release(); }
  };

  const prepareChosenPhoto = async (uri: string) => {
    setIsPreparing(true);
    setScanMessage('Preparing photo...');
    try {
      // Bake EXIF into pixels before review, so the preview and detector see the same orientation.
      const prepared = await renderPhoto(uri);
      if (mounted.current) { setPendingImageUri(prepared); setScanMessage(captureGuidance); }
    } catch { setScanMessage('Could not open this photo. Please choose another image.'); }
    finally { inputBusy.current = false; if (mounted.current) setIsPreparing(false); }
  };

  const handlePickImage = async () => {
    if (scanController.current || inputBusy.current) return;
    if (Platform.OS === 'web') { fileInputRef.current?.click(); return; }
    inputBusy.current = true;
    setIsPreparing(true);
    try {
      const access = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!access.granted) { setScanMessage('Photo access is required to choose an answer-sheet image.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
      if (!result.canceled && result.assets[0]?.uri) await prepareChosenPhoto(result.assets[0].uri);
    } catch { setScanMessage('Could not open your photos. Please try again.'); }
    finally { inputBusy.current = false; if (mounted.current) setIsPreparing(false); }
  };

  const handleRotatePhoto = async () => {
    if (!pendingImageUri || scanController.current || inputBusy.current) return;
    inputBusy.current = true;
    setIsPreparing(true);
    try { setPendingImageUri(await renderPhoto(pendingImageUri, 90)); }
    catch { setScanMessage('Could not rotate this photo. Please choose it again.'); }
    finally { inputBusy.current = false; setIsPreparing(false); }
  };

  const handleCameraReady = async () => {
    if (cameraSetup.current) { setCameraReady(true); return; }
    cameraSetup.current = true;
    try {
      const sizes = await cameraRef.current?.getAvailablePictureSizesAsync();
      if (mounted.current && sizes) setPictureSize(selectPictureSize(sizes));
    } catch { /* The native 4:3 default is supported even when size discovery is unavailable. */ }
    finally {
      if (mounted.current) { setCameraReady(true); setScanMessage(captureGuidance); }
    }
  };

  const handleWebFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || inputBusy.current || scanController.current) return;
    inputBusy.current = true;
    const uri = URL.createObjectURL(file);
    try { await prepareChosenPhoto(uri); }
    finally { URL.revokeObjectURL(uri); }
  };

  if (!currentExam) {
    return (
      <AppShell title="Scan">
        <View style={styles.examPickerScreen}>
          <ScrollView contentContainerStyle={styles.examPickerContent}>
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
                    <View style={styles.pickerIcon}><FileText size={21} color={ClayColors.skyText} /></View>
                    <View style={styles.pickerCopy}>
                      <Text style={styles.pickerExamTitle}>{exam.title}</Text>
                      <Text style={styles.pickerExamMeta}>{exam.class_name || 'General'} · {exam.total_questions} questions</Text>
                      <View style={styles.keyStatus}>
                        <CheckCircle2 size={13} color={keyReady ? ClayColors.success : ClayColors.warning} />
                        <Text style={[styles.keyStatusText, !keyReady && styles.keyStatusWarning]}>
                          {keyReady ? 'Answer key ready' : `${keyCount}/${exam.total_questions} answers configured`}
                        </Text>
                      </View>
                    </View>
                    <ArrowRight size={19} color={ClayColors.textMuted} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </AppShell>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topHeader, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity accessibilityLabel="Close scanner" style={styles.iconButton} onPress={() => {
          scanController.current?.abort();
          router.replace(`/exams/${currentExam.id}` as Href);
        }}><X size={22} color={ClayColors.textPrimary} /></TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.examTitle} numberOfLines={2}>{currentExam.title}</Text>
          <Text style={styles.examMeta}>{currentExam.total_questions} questions · {currentExam.options_per_question} choices</Text>
        </View>
        <View style={styles.headerTool}>
          {pendingImageUri && <TouchableOpacity accessibilityLabel="Rotate photo clockwise"
            disabled={isProcessing || isPreparing} style={styles.iconButton} onPress={() => void handleRotatePhoto()}>
            <RotateCw size={22} color={ClayColors.primary} />
          </TouchableOpacity>}
        </View>
      </View>

      <View style={styles.cameraArea} onLayout={({ nativeEvent }) => setFrameArea(nativeEvent.layout)}>
        <View testID="camera-frame" style={[styles.cameraFrame, frame]}>
          {pendingImageUri ? (
            <Image testID="captured-photo" source={{ uri: pendingImageUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
          ) : Platform.OS === 'web' ? (
            <>
              <video ref={videoRef} autoPlay playsInline muted
                onLoadedMetadata={() => {
                  const video = videoRef.current;
                  if (video?.videoWidth && video.videoHeight) setWebAspect(video.videoWidth / video.videoHeight);
                }}
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: webCamActive ? 'block' : 'none' }} />
              {!webCamActive && <View style={styles.permissionContainer}>
                <ScrollView contentContainerStyle={styles.permissionContent}>
                  <Text style={styles.permissionTitle}>Camera unavailable</Text>
                  <Text style={styles.permissionSub}>{camError || 'Waiting for camera permission...'}</Text>
                  <TouchableOpacity style={styles.grantBtn} onPress={() => void startWebCamera()}>
                    <Text style={styles.usePhotoText}>Enable camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.chooseAgainBtn} onPress={() => void handlePickImage()} disabled={isPreparing}>
                    <Text style={styles.chooseAgainText}>Choose photo</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>}
            </>
          ) : !isFocused ? null : permission?.granted ? (
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" mode="picture"
              ratio="4:3" pictureSize={pictureSize} zoom={0} autofocus="on" animateShutter={false}
              responsiveOrientationWhenOrientationLocked={false} enableTorch={torchEnabled}
              onCameraReady={() => void handleCameraReady()}
              onMountError={({ message }) => { setCameraReady(false); setScanMessage(`Camera unavailable: ${message}`); }} />
          ) : (
            <View style={styles.permissionContainer}>
              <ScrollView contentContainerStyle={styles.permissionContent}>
                <Text style={styles.permissionTitle}>Camera access</Text>
                <Text style={styles.permissionSub}>Allow camera access to photograph an answer sheet.</Text>
                <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
                  <Text style={styles.usePhotoText}>Allow camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chooseAgainBtn} onPress={() => void handlePickImage()} disabled={isPreparing}>
                  <Text style={styles.chooseAgainText}>Choose photo</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
          {!pendingImageUri && (Platform.OS === 'web' ? webCamActive : permission?.granted) && <CameraGuide />}
        </View>
      </View>

      <View style={[styles.captureFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.statusRow}>
          {(isProcessing || isPreparing) && <ActivityIndicator size="small" color={ClayColors.primary} />}
          <ScrollView contentContainerStyle={styles.statusContent}><Text accessibilityLiveRegion="polite" style={styles.statusText}>{scanMessage || captureGuidance}</Text></ScrollView>
        </View>
        <View style={styles.controlsSlot}>
          {pendingImageUri ? <View style={styles.confirmActions}>
            <TouchableOpacity style={styles.chooseAgainBtn} disabled={isPreparing}
              onPress={() => {
                if (isProcessing) { scanController.current?.abort(); setScanMessage('Cancelling...'); return; }
                setCameraReady(false);
                setPendingImageUri(undefined);
                setScanMessage(captureGuidance);
              }}>
              <Text style={styles.chooseAgainText}>{isProcessing ? 'Cancel' : 'Retake'}</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={isProcessing || isPreparing} style={styles.usePhotoBtn}
              onPress={() => void handlePerformScan(pendingImageUri)}>
              <Text style={styles.usePhotoText}>{isProcessing ? 'Reading...' : 'Use Photo'}</Text>
            </TouchableOpacity>
          </View> : <CameraControls torchEnabled={torchEnabled}
            torchAvailable={Platform.OS !== 'web' && cameraReady}
            onToggleTorch={() => setTorchEnabled(!torchEnabled)}
            onPickImage={() => void handlePickImage()} onManualCapture={() => void handleCapturePhoto()}
            inputBusy={isPreparing || isProcessing}
            captureDisabled={Platform.OS === 'web' ? !webCamActive : !cameraReady} />}
        </View>
      </View>
      {Platform.OS === 'web' && <input ref={fileInputRef} type="file" accept="image/*"
        aria-label="Answer sheet image" onChange={(event) => void handleWebFileChange(event)} style={{ display: 'none' }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  examPickerScreen: { flex: 1, backgroundColor: ClayColors.bg },
  examPickerContent: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20 },
  pickerEyebrow: { color: ClayColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0 },
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
  container: { flex: 1, backgroundColor: ClayColors.bg },
  topHeader: { paddingHorizontal: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: ClayColors.bg },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTool: { width: 44, height: 44 },
  iconButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: ClayColors.surfaceInset },
  examTitle: { fontSize: 15, fontWeight: '800', color: ClayColors.textPrimary },
  examMeta: { fontSize: 12, color: ClayColors.textSecondary, marginTop: 3 },
  cameraArea: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: ClayColors.viewfinder },
  cameraFrame: { overflow: 'hidden', backgroundColor: ClayColors.viewfinder },
  captureFooter: { paddingHorizontal: 16, paddingTop: 10, width: '100%', maxWidth: 760, alignSelf: 'center' },
  statusRow: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  statusContent: { flexGrow: 1, justifyContent: 'center' },
  statusText: { flex: 1, fontSize: 13, lineHeight: 18, textAlign: 'center', color: ClayColors.textPrimary },
  controlsSlot: { height: 76, justifyContent: 'center' },
  confirmActions: { flexDirection: 'row', gap: 12 },
  chooseAgainBtn: { flex: 1, minHeight: 48, padding: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: ClayColors.surfaceInset, borderWidth: 1, borderColor: ClayColors.borderDarker },
  chooseAgainText: { color: ClayColors.textPrimary, fontWeight: '700' },
  usePhotoBtn: { ...ClayButtonStyle, flex: 2, padding: 12, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  usePhotoText: { color: ClayColors.onPrimary, fontWeight: '700', textAlign: 'center' },
  permissionContainer: { ...StyleSheet.absoluteFill, backgroundColor: ClayColors.bg },
  permissionContent: { justifyContent: 'center', padding: 20, gap: 14 },
  permissionTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', color: ClayColors.textPrimary },
  permissionSub: { fontSize: 13, lineHeight: 19, textAlign: 'center', color: ClayColors.textSecondary },
  grantBtn: { ...ClayButtonStyle, padding: 14, borderRadius: 14, alignItems: 'center' },
});
