import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Download, Eye, FileDown, KeyRound, Printer, Save, Share2, X } from 'lucide-react-native';

import { AppHeader } from '../../components/common/Header';
import {
  GeneratedAnswerSheet,
  generateAnswerSheetPdf,
  printAnswerSheet,
  shareAnswerSheet,
} from '../../services/export/answerSheetGenerator';
import { generateAnswerKeyMatrixPDF } from '../../services/export/pdfGenerator';
import {
  AnswerSheetConfig,
  DEFAULT_ANSWER_SHEET_CONFIG,
  SheetFieldKey,
  buildLayoutId,
  clampItemCount,
  getFourSheetWarning,
  getPagePoints,
  getQuestionColumns,
  scannerSupportsItemCount,
} from '../../services/omr/sheetLayout';
import { useExamStore } from '../../store/useExamStore';
import { AnswerKeyItem } from '../../types';
import { ClayCardStyle, ClayColors } from '../../constants/theme';

const ITEM_PRESETS = [10, 20, 25, 30, 40, 50] as const;
const FIELD_LABELS: Record<SheetFieldKey, string> = {
  studentName: 'Student name',
  studentId: 'Student ID',
  gradeSection: 'Grade & section',
  subject: 'Subject',
  teacher: 'Teacher',
  date: 'Date',
  testTitle: 'Test title',
  testCode: 'Sheet / test code',
};

type BusyAction = 'download' | 'print' | 'share' | null;
type SegmentValue = string | number;

function OptionGroup({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: SegmentValue }[];
  value: SegmentValue;
  onChange: (value: SegmentValue) => void;
}) {
  return (
    <View style={styles.optionGroup}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => onChange(option.value)}
            style={[styles.optionButton, active && styles.optionButtonActive]}>
            <Text style={[styles.optionText, active && styles.optionTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MiniSheet({ config, compact = false }: { config: AnswerSheetConfig; compact?: boolean }) {
  const columns = getQuestionColumns(config.itemCount);
  const options = ['A', 'B', 'C', 'D', 'E'].slice(0, config.choiceCount);
  const enabledFields = (Object.keys(config.fields) as SheetFieldKey[]).filter(
    (key) => config.fields[key]
  );

  return (
    <View style={styles.miniSheet}>
      <View style={[styles.previewMarker, styles.previewMarkerTl]} />
      <View style={[styles.previewMarker, styles.previewMarkerTr]} />
      <View style={[styles.previewMarker, styles.previewMarkerBl]} />
      <View style={[styles.previewMarker, styles.previewMarkerBr]} />

      <View style={styles.previewHeader}>
        <Text style={styles.previewBrand}>CHECKMATE</Text>
        <Text numberOfLines={1} style={styles.previewTitle}>
          {config.testTitle.trim() || 'Student Answer Sheet'}
        </Text>
        <Text style={styles.previewMeta}>{config.itemCount} items</Text>
      </View>

      <View style={styles.previewFields}>
        {enabledFields.map((key) => (
          <View key={key} style={styles.previewField}>
            <Text numberOfLines={1} style={styles.previewFieldLabel}>{FIELD_LABELS[key]}</Text>
            <View style={styles.previewFieldLine} />
          </View>
        ))}
      </View>

      <Text style={styles.previewInstruction}>Shade one circle completely.</Text>
      <View style={styles.previewQuestionGrid}>
        {columns.map((questions, columnIndex) => (
          <View key={columnIndex} style={styles.previewQuestionColumn}>
            {questions.map((question) => (
              <View key={question} style={[styles.previewQuestionRow, compact && styles.previewQuestionRowCompact]}>
                <Text style={styles.previewQuestionNumber}>{`${question}.`}</Text>
                <View style={styles.previewBubbles}>
                  {options.map((option) => (
                    <View key={option} style={[styles.previewBubble, compact && styles.previewBubbleCompact]}>
                      <Text style={styles.previewBubbleText}>{option}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>

      {config.includeLayoutId && (
        <Text numberOfLines={1} style={styles.previewLayoutId}>{buildLayoutId(config)}</Text>
      )}
    </View>
  );
}

function SheetPreview({ config, large = false }: { config: AnswerSheetConfig; large?: boolean }) {
  const points = getPagePoints(config.paperSize, config.orientation);
  const width = config.orientation === 'landscape' ? (large ? 920 : 720) : large ? 660 : 500;
  const height = width * (points.height / points.width);
  const previewPadding = 10;
  const previewGap = 8;

  if (config.sheetsPerPage === 4) {
    const cellWidth = (width - previewPadding * 2 - previewGap) / 2;
    const cellHeight = (height - previewPadding * 2 - previewGap) / 2;
    const rotated = config.orientation === 'landscape';
    const sheetWidth = rotated ? cellHeight : cellWidth;
    const sheetHeight = rotated ? cellWidth : cellHeight;
    const positions = [
      { left: previewPadding, top: previewPadding },
      { left: previewPadding + cellWidth + previewGap, top: previewPadding },
      { left: previewPadding, top: previewPadding + cellHeight + previewGap },
      { left: previewPadding + cellWidth + previewGap, top: previewPadding + cellHeight + previewGap },
    ];

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.previewScroller}>
        <View style={[styles.paperPreview, { width, height }]}>
          <View style={[styles.previewCutLineFourVertical, { left: width / 2 }]} />
          <View style={[styles.previewCutLineFourHorizontal, { top: height / 2 }]} />
          {positions.map((position, index) => (
            <View key={index} style={[styles.previewSheetSlot, position, { width: cellWidth, height: cellHeight }]}>
              <View style={{ width: sheetWidth, height: sheetHeight, transform: [{ rotate: rotated ? '90deg' : '0deg' }] }}>
                <MiniSheet config={config} compact />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.previewScroller}>
      <View style={[styles.paperPreview, { width, height }]}>
        {Array.from({ length: config.sheetsPerPage }, (_, index) => (
          <React.Fragment key={index}>
            {index === 1 && <View style={styles.previewCutLine} />}
            <MiniSheet config={config} />
          </React.Fragment>
        ))}
      </View>
    </ScrollView>
  );
}

export default function AnswerSheetGeneratorScreen() {
  const router = useRouter();
  const { examId } = useLocalSearchParams<{ examId?: string }>();
  const { exams, activeExam, activeAnswerKeys, setActiveAnswerKeys, setActiveExam } = useExamStore();
  const initialCount = activeExam?.total_questions ?? DEFAULT_ANSWER_SHEET_CONFIG.itemCount;
  const [config, setConfig] = useState<AnswerSheetConfig>({
    ...DEFAULT_ANSWER_SHEET_CONFIG,
    itemCount: initialCount,
    choiceCount: activeExam?.options_per_question ?? 4,
    fields: { ...DEFAULT_ANSWER_SHEET_CONFIG.fields },
    testTitle: activeExam?.title ?? '',
    subject: activeExam?.class_name ?? activeExam?.description ?? '',
    testCode: activeExam?.id ?? '',
  });
  const [customCount, setCustomCount] = useState(String(initialCount));
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [answerKeyOpen, setAnswerKeyOpen] = useState(false);
  const [draftAnswers, setDraftAnswers] = useState<string[]>([]);
  const [keyPdfBusy, setKeyPdfBusy] = useState(false);

  useEffect(() => {
    const routeExam = exams.find((exam) => exam.id === examId);
    if (!routeExam || routeExam.id === activeExam?.id) return;
    setActiveExam(routeExam);
    setConfig((current) => ({
      ...current,
      itemCount: routeExam.total_questions,
      choiceCount: routeExam.options_per_question,
      testTitle: routeExam.title,
      subject: routeExam.class_name ?? routeExam.description ?? '',
      testCode: routeExam.id,
    }));
    setCustomCount(String(routeExam.total_questions));
  }, [activeExam?.id, examId, exams, setActiveExam]);

  const isPreset = ITEM_PRESETS.includes(config.itemCount as (typeof ITEM_PRESETS)[number]);
  const scannerReady = scannerSupportsItemCount(config.itemCount);
  const fourSheetWarning = getFourSheetWarning(config);
  const fourSheetBlocked = config.sheetsPerPage === 4 && config.itemCount > 25;
  const metadataFields = useMemo(
    () => (Object.keys(config.fields) as SheetFieldKey[]),
    [config.fields]
  );

  const updateConfig = <K extends keyof AnswerSheetConfig>(key: K, value: AnswerSheetConfig[K]) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const updateField = (key: SheetFieldKey, value: boolean) => {
    setConfig((current) => ({
      ...current,
      fields: { ...current.fields, [key]: value },
    }));
  };

  const chooseCount = (count: number) => {
    const next = clampItemCount(count);
    updateConfig('itemCount', next);
    setCustomCount(String(next));
  };

  const runAction = async (action: Exclude<BusyAction, null>) => {
    if (fourSheetBlocked) {
      setError(fourSheetWarning);
      return;
    }
    setBusyAction(action);
    setError('');
    setMessage('');
    try {
      let generated: GeneratedAnswerSheet | undefined;
      if (action === 'download') {
        if (Platform.OS === 'web') {
          await printAnswerSheet(config);
          setMessage('Print dialog opened. Choose Save as PDF to download the sheet.');
        } else {
          generated = await generateAnswerSheetPdf(config);
          setMessage(`${generated.filename} is ready. Use Share PDF to save it outside CheckMate.`);
        }
      } else if (action === 'print') {
        const result = await printAnswerSheet(config);
        setMessage(
          result === 'web-window'
            ? 'Printable sheet opened. If the dialog is hidden, press Print this sheet in the new window.'
            : 'The print dialog opened with the current sheet settings.'
        );
      } else {
        generated = await shareAnswerSheet(config);
        setMessage(`${generated.filename} is ready to share.`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The answer sheet could not be generated.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (activeExam) {
      router.replace(`/exams/${activeExam.id}` as Href);
      return;
    }
    router.replace('/exams');
  };

  const openAnswerKeyEditor = () => {
    if (!activeExam) {
      setError('Select an exam before editing its answer key.');
      return;
    }

    const allowedOptions = ['A', 'B', 'C', 'D', 'E'].slice(0, activeExam.options_per_question);
    const answers = Array.from({ length: activeExam.total_questions }, (_, index) => {
      const saved = activeAnswerKeys.find((key) => key.question_number === index + 1)?.correct_options[0];
      return saved && allowedOptions.includes(saved) ? saved : 'A';
    });

    setConfig((current) => ({
      ...current,
      itemCount: activeExam.total_questions,
      choiceCount: activeExam.options_per_question,
      testTitle: activeExam.title,
      subject: activeExam.class_name ?? activeExam.description ?? current.subject,
      testCode: activeExam.id,
    }));
    setCustomCount(String(activeExam.total_questions));
    setDraftAnswers(answers);
    setError('');
    setAnswerKeyOpen(true);
  };

  const createDraftAnswerKeys = (): AnswerKeyItem[] => {
    if (!activeExam) return [];
    return draftAnswers.map((answer, index) => {
      const saved = activeAnswerKeys.find((key) => key.question_number === index + 1);
      return {
        ...saved,
        exam_id: activeExam.id,
        question_number: index + 1,
        correct_options: [answer],
        points: saved?.points ?? 1,
      };
    });
  };

  const saveAnswerKey = () => {
    if (!activeExam) return;
    setActiveAnswerKeys(createDraftAnswerKeys());
    setAnswerKeyOpen(false);
    setError('');
    setMessage(`Answer key saved for ${activeExam.title}.`);
  };

  const downloadAnswerKey = async () => {
    if (!activeExam) return;
    const keys = createDraftAnswerKeys();
    setKeyPdfBusy(true);
    setError('');
    setActiveAnswerKeys(keys);
    try {
      const result = await generateAnswerKeyMatrixPDF(activeExam, keys);
      if (!result) throw new Error('The answer key PDF could not be generated.');
      setMessage(
        Platform.OS === 'web'
          ? 'Answer key saved. Choose Save as PDF in the print dialog to download the key.'
          : 'Answer key saved and the key PDF is ready to share or save.'
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The answer key PDF could not be generated.');
    } finally {
      setKeyPdfBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="Answer Sheet Generator" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ChevronLeft size={18} color="#4F46E5" />
          <Text style={styles.backText}>Exam Manager</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sheet Layout</Text>

          <Text style={styles.label}>Number of questions</Text>
          <OptionGroup
            options={ITEM_PRESETS.map((value) => ({ label: String(value), value }))}
            value={isPreset ? config.itemCount : 'custom'}
            onChange={(value) => chooseCount(Number(value))}
          />
          <View style={styles.customRow}>
            <Text style={styles.customLabel}>Custom</Text>
            <TextInput
              accessibilityLabel="Custom question count"
              keyboardType="number-pad"
              value={customCount}
              onChangeText={(value) => {
                setCustomCount(value);
                if (value.trim()) chooseCount(Number(value));
              }}
              onBlur={() => chooseCount(Number(customCount))}
              style={styles.customInput}
              maxLength={3}
            />
            <Text style={styles.inputSuffix}>items, up to 100</Text>
          </View>

          <View style={styles.settingGrid}>
            <View style={styles.settingBlock}>
              <Text style={styles.label}>Choices</Text>
              <OptionGroup
                options={[{ label: 'A-D', value: 4 }, { label: 'A-E', value: 5 }]}
                value={config.choiceCount}
                onChange={(value) => updateConfig('choiceCount', Number(value) as 4 | 5)}
              />
            </View>
            <View style={styles.settingBlock}>
              <Text style={styles.label}>Paper</Text>
              <OptionGroup
                options={[{ label: 'A4', value: 'a4' }, { label: 'Letter', value: 'letter' }]}
                value={config.paperSize}
                onChange={(value) => updateConfig('paperSize', value as 'a4' | 'letter')}
              />
            </View>
            <View style={styles.settingBlock}>
              <Text style={styles.label}>Orientation</Text>
              <OptionGroup
                options={[{ label: 'Portrait', value: 'portrait' }, { label: 'Landscape', value: 'landscape' }]}
                value={config.orientation}
                onChange={(value) => updateConfig('orientation', value as 'portrait' | 'landscape')}
              />
            </View>
            <View style={styles.settingBlock}>
              <Text style={styles.label}>Sheets per page</Text>
              <OptionGroup
                options={[{ label: 'One', value: 1 }, { label: 'Two', value: 2 }, { label: 'Four', value: 4 }]}
                value={config.sheetsPerPage}
                onChange={(value) => {
                  const sheetsPerPage = Number(value) as 1 | 2 | 4;
                  setConfig((current) => ({
                    ...current,
                    sheetsPerPage,
                    orientation: sheetsPerPage === 4 ? 'landscape' : current.orientation,
                  }));
                }}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Student Information</Text>
          <View style={styles.fieldToggleGrid}>
            {metadataFields.map((key) => (
              <View key={key} style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{FIELD_LABELS[key]}</Text>
                <Switch
                  value={config.fields[key]}
                  onValueChange={(value) => updateField(key, value)}
                  trackColor={{ false: '#CBD5E1', true: '#4F46E5' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ))}
          </View>

          <View style={styles.textFieldGrid}>
            <TextInput
              style={styles.textInput}
              placeholder="Test title"
              placeholderTextColor="#94A3B8"
              value={config.testTitle}
              onChangeText={(value) => updateConfig('testTitle', value)}
            />
            <TextInput
              style={styles.textInput}
              placeholder="Subject / section"
              placeholderTextColor="#94A3B8"
              value={config.subject}
              onChangeText={(value) => updateConfig('subject', value)}
            />
            <TextInput
              style={styles.textInput}
              placeholder="Teacher"
              placeholderTextColor="#94A3B8"
              value={config.teacher}
              onChangeText={(value) => updateConfig('teacher', value)}
            />
            <TextInput
              style={styles.textInput}
              placeholder="Sheet / test code"
              placeholderTextColor="#94A3B8"
              value={config.testCode}
              onChangeText={(value) => updateConfig('testCode', value)}
            />
          </View>

          <View style={styles.toggleRowWide}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleLabel}>Print layout identifier</Text>
              <Text style={styles.toggleHint}>{buildLayoutId(config)}</Text>
            </View>
            <Switch
              value={config.includeLayoutId}
              onValueChange={(value) => updateConfig('includeLayoutId', value)}
              trackColor={{ false: '#CBD5E1', true: '#4F46E5' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.previewSection}>
          <View style={styles.previewHeadingRow}>
            <View>
              <Text style={styles.sectionTitle}>Print Preview</Text>
              <Text style={styles.previewCaption}>{`${config.paperSize === 'a4' ? 'A4' : 'US Letter'} · ${config.orientation} · ${config.sheetsPerPage} sheet${config.sheetsPerPage === 1 ? '' : 's'}`}</Text>
            </View>
            <View style={[styles.compatibilityBadge, scannerReady ? styles.readyBadge : styles.manualBadge]}>
              <Text style={styles.compatibilityText}>{scannerReady ? 'Scanner ready' : 'Print only'}</Text>
            </View>
          </View>
          {!scannerReady && (
            <Text style={styles.compatibilityNote}>The current camera scanner recognizes 25- and 50-item CheckMate layouts. Other counts can be printed and graded manually.</Text>
          )}
          {!!fourSheetWarning && <Text style={styles.fourSheetWarning}>{fourSheetWarning}</Text>}
          {fourSheetBlocked ? (
            <View style={styles.unsupportedPreview}>
              <Text style={styles.unsupportedPreviewTitle}>Four sheets would be too dense</Text>
              <Text style={styles.unsupportedPreviewText}>Choose 25 questions or fewer, or switch to one or two sheets per page.</Text>
            </View>
          ) : <SheetPreview config={config} />}
        </View>

        {Boolean(message || error) && (
          <View style={[styles.feedback, error ? styles.feedbackError : styles.feedbackSuccess]}>
            <Text style={styles.feedbackText}>{error || message}</Text>
          </View>
        )}

        <View style={styles.actionRow}>
          <Pressable disabled={fourSheetBlocked} style={[styles.secondaryAction, fourSheetBlocked && styles.disabledAction]} onPress={() => setPreviewOpen(true)}>
            <Eye size={17} color="#4F46E5" />
            <Text style={styles.secondaryActionText}>Preview</Text>
          </Pressable>
          <Pressable style={styles.keyAction} onPress={openAnswerKeyEditor}>
            <KeyRound size={17} color="#FFFFFF" />
            <Text style={styles.primaryActionText}>Answer Key</Text>
          </Pressable>
          <Pressable disabled={busyAction !== null || fourSheetBlocked} style={[styles.secondaryAction, fourSheetBlocked && styles.disabledAction]} onPress={() => runAction('download')}>
            {busyAction === 'download' ? <ActivityIndicator size="small" color="#4F46E5" /> : <Download size={17} color="#4F46E5" />}
            <Text style={styles.secondaryActionText}>Save PDF</Text>
          </Pressable>
          <Pressable disabled={busyAction !== null || fourSheetBlocked} style={[styles.primaryAction, fourSheetBlocked && styles.disabledAction]} onPress={() => runAction('print')}>
            {busyAction === 'print' ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Printer size={17} color="#FFFFFF" />}
            <Text style={styles.primaryActionText}>Print</Text>
          </Pressable>
          <Pressable disabled={busyAction !== null || fourSheetBlocked} style={[styles.shareAction, fourSheetBlocked && styles.disabledAction]} onPress={() => runAction('share')}>
            {busyAction === 'share' ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Share2 size={17} color="#FFFFFF" />}
            <Text style={styles.primaryActionText}>Share PDF</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={previewOpen} animationType="slide" onRequestClose={() => setPreviewOpen(false)}>
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Answer sheet preview</Text>
              <Text style={styles.modalSubtitle}>The PDF uses the same rows, fields, markers, and page proportions.</Text>
            </View>
            <Pressable accessibilityLabel="Close preview" style={styles.iconButton} onPress={() => setPreviewOpen(false)}>
              <X size={20} color="#0F172A" />
            </Pressable>
          </View>
          <View style={styles.modalPreview}><SheetPreview config={config} large /></View>
        </View>
      </Modal>

      <Modal visible={answerKeyOpen} animationType="slide" onRequestClose={() => setAnswerKeyOpen(false)}>
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalTitle}>Set answer key</Text>
              <Text numberOfLines={2} style={styles.modalSubtitle}>
                {activeExam ? `${activeExam.title} · ${activeExam.total_questions} items · A-${String.fromCharCode(64 + activeExam.options_per_question)}` : 'No active exam'}
              </Text>
            </View>
            <Pressable accessibilityLabel="Close answer key" style={styles.iconButton} onPress={() => setAnswerKeyOpen(false)}>
              <X size={20} color="#0F172A" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.keyEditorContent}>
            {draftAnswers.map((answer, index) => (
              <View key={index} style={styles.keyEditorRow}>
                <Text style={styles.keyEditorNumber}>Q{index + 1}</Text>
                <View style={styles.keyEditorOptions}>
                  {['A', 'B', 'C', 'D', 'E'].slice(0, activeExam?.options_per_question ?? config.choiceCount).map((option) => {
                    const selected = answer === option;
                    return (
                      <Pressable
                        key={option}
                        accessibilityRole="radio"
                        accessibilityLabel={`Question ${index + 1} answer ${option}`}
                        accessibilityState={{ checked: selected }}
                        style={[styles.keyEditorOption, selected && styles.keyEditorOptionActive]}
                        onPress={() => setDraftAnswers((current) => current.map((value, answerIndex) => answerIndex === index ? option : value))}>
                        <Text style={[styles.keyEditorOptionText, selected && styles.keyEditorOptionTextActive]}>{option}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.keyEditorFooter}>
            <Pressable disabled={keyPdfBusy} style={styles.secondaryAction} onPress={downloadAnswerKey}>
              {keyPdfBusy ? <ActivityIndicator size="small" color="#4F46E5" /> : <FileDown size={17} color="#4F46E5" />}
              <Text style={styles.secondaryActionText}>Download Key PDF</Text>
            </Pressable>
            <Pressable style={styles.saveKeyAction} onPress={saveAnswerKey}>
              <Save size={17} color="#FFFFFF" />
              <Text style={styles.primaryActionText}>Save Answer Key</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0F4F8' },
  content: { padding: 18, paddingBottom: 60, gap: 16 },
  backButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  backText: { color: '#4F46E5', fontSize: 13, fontWeight: '800' },
  section: {
    ...ClayCardStyle,
    padding: 18,
  },
  sectionTitle: { color: '#0F172A', fontSize: 17, fontWeight: '800' },
  label: { color: '#0F172A', fontSize: 12, fontWeight: '800', marginTop: 14, marginBottom: 8 },
  optionGroup: { flexDirection: 'row', borderWidth: 1.5, borderColor: '#CBD5E1', borderRadius: 14, overflow: 'hidden', minHeight: 42, backgroundColor: '#EBF0F6' },
  optionButton: { flex: 1, minWidth: 48, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EBF0F6', borderRightWidth: 1.5, borderRightColor: '#CBD5E1' },
  optionButtonActive: { backgroundColor: '#4F46E5' },
  optionText: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  optionTextActive: { color: '#FFFFFF', fontWeight: '800' },
  customRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  customLabel: { color: '#0F172A', fontSize: 12, fontWeight: '800' },
  customInput: { width: 72, height: 40, borderWidth: 1.5, borderColor: '#CBD5E1', borderRadius: 12, color: '#0F172A', backgroundColor: '#EBF0F6', textAlign: 'center', fontSize: 13, fontWeight: '800' },
  inputSuffix: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  settingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  settingBlock: { width: '48%', minWidth: 150, flexGrow: 1 },
  fieldToggleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  toggleRow: { width: '48%', minWidth: 155, flexGrow: 1, height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor: '#EBF0F6', borderRadius: 14, borderWidth: 1.5, borderColor: '#CBD5E1' },
  toggleLabel: { color: '#0F172A', fontSize: 12, fontWeight: '700' },
  textFieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  textInput: { width: '48%', minWidth: 155, flexGrow: 1, height: 44, borderWidth: 1.5, borderColor: '#CBD5E1', borderRadius: 14, color: '#0F172A', backgroundColor: '#EBF0F6', paddingHorizontal: 12, fontSize: 12, fontWeight: '600' },
  toggleRowWide: { marginTop: 14, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor: '#EBF0F6', borderRadius: 14, borderWidth: 1.5, borderColor: '#CBD5E1' },
  toggleCopy: { flex: 1, paddingVertical: 8, paddingRight: 8 },
  toggleHint: { color: '#64748B', fontSize: 10, marginTop: 2, fontWeight: '600' },
  previewSection: {
    ...ClayCardStyle,
    paddingVertical: 18,
  },
  previewHeadingRow: { paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewCaption: { color: '#64748B', fontSize: 11, marginTop: 3, textTransform: 'capitalize', fontWeight: '600' },
  compatibilityBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  readyBadge: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  manualBadge: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A' },
  compatibilityText: { color: '#047857', fontSize: 10, fontWeight: '800' },
  compatibilityNote: { color: '#B45309', fontSize: 11, lineHeight: 16, marginHorizontal: 18, marginTop: 10, fontWeight: '600' },
  fourSheetWarning: { color: '#B45309', fontSize: 11, lineHeight: 16, marginHorizontal: 18, marginTop: 10, fontWeight: '600' },
  previewScroller: { padding: 18, alignItems: 'flex-start' },
  paperPreview: { backgroundColor: '#FFFFFF', padding: 12, flexDirection: 'row', borderWidth: 2, borderColor: '#CBD5E1', elevation: 4 },
  miniSheet: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#000000', paddingHorizontal: 12, paddingTop: 11, paddingBottom: 10, position: 'relative', overflow: 'hidden' },
  previewCutLine: { width: 1, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: '#64748B', marginHorizontal: 8 },
  previewSheetSlot: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  previewCutLineFourVertical: { position: 'absolute', top: 10, bottom: 10, width: 1, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: '#64748B', zIndex: 3 },
  previewCutLineFourHorizontal: { position: 'absolute', left: 10, right: 10, height: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#64748B', zIndex: 3 },
  previewMarker: { width: 8, height: 8, backgroundColor: '#000000', position: 'absolute', zIndex: 2 },
  previewMarkerTl: { top: 4, left: 4 }, previewMarkerTr: { top: 4, right: 4 },
  previewMarkerBl: { bottom: 4, left: 4 }, previewMarkerBr: { bottom: 4, right: 4 },
  previewHeader: { alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 4 },
  previewBrand: { color: '#000000', fontSize: 12, fontWeight: '900' },
  previewTitle: { color: '#000000', fontSize: 7, fontWeight: '700', maxWidth: '85%' },
  previewMeta: { color: '#000000', fontSize: 5 },
  previewFields: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginVertical: 4 },
  previewField: { width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  previewFieldLabel: { color: '#000000', fontSize: 4, maxWidth: '45%' },
  previewFieldLine: { flex: 1, borderBottomWidth: 1, borderBottomColor: '#000000', height: 4 },
  previewInstruction: { color: '#000000', fontSize: 4, textAlign: 'center', marginBottom: 2 },
  previewQuestionGrid: { flexDirection: 'row', gap: 5, flex: 1 },
  previewQuestionColumn: { flex: 1 },
  previewQuestionRow: { minHeight: 13, flex: 1, maxHeight: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB' },
  previewQuestionRowCompact: { minHeight: 8, maxHeight: 11 },
  previewQuestionNumber: { color: '#000000', width: 19, fontSize: 5.5, fontWeight: '700', textAlign: 'right', marginRight: 3 },
  previewBubbles: { flex: 1, flexDirection: 'row', justifyContent: 'space-evenly' },
  previewBubble: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  previewBubbleCompact: { width: 8, height: 8, borderRadius: 4 },
  previewBubbleText: { color: '#000000', fontSize: 4, fontWeight: '700' },
  previewLayoutId: { position: 'absolute', bottom: 2, left: 12, right: 12, color: '#000000', fontSize: 4 },
  unsupportedPreview: { minHeight: 150, margin: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#F59E0B', borderRadius: 16, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', padding: 20 },
  unsupportedPreviewTitle: { color: '#B45309', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  unsupportedPreviewText: { color: '#78350F', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 6 },
  feedback: { borderRadius: 16, borderWidth: 1.5, padding: 14 },
  feedbackSuccess: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  feedbackError: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  feedbackText: { color: '#0F172A', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  secondaryAction: {
    minWidth: 120,
    flex: 1,
    height: 46,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#EEF2FF',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justify: 'center',
  },
  secondaryActionText: { color: '#4F46E5', fontSize: 12, fontWeight: '800' },
  keyAction: {
    minWidth: 120,
    flex: 1,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#8B5CF6',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justify: 'center',
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 3.5,
    borderBottomColor: '#6D28D9',
  },
  primaryAction: {
    minWidth: 110,
    flex: 1,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#4F46E5',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justify: 'center',
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 3.5,
    borderBottomColor: '#3730A3',
  },
  shareAction: {
    minWidth: 120,
    flex: 1,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#06B6D4',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justify: 'center',
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 3.5,
    borderBottomColor: '#0891B2',
  },
  primaryActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  disabledAction: { opacity: 0.45 },
  modalScreen: { flex: 1, backgroundColor: '#F0F4F8' },
  modalHeader: { minHeight: 78, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  modalHeaderCopy: { flex: 1, paddingRight: 12 },
  modalTitle: { color: '#0F172A', fontSize: 18, fontWeight: '800' },
  modalSubtitle: { color: '#64748B', fontSize: 11, marginTop: 3, maxWidth: 430, fontWeight: '600' },
  iconButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  modalPreview: { flex: 1, justifyContent: 'center' },
  keyEditorContent: { padding: 18, paddingBottom: 30, gap: 8 },
  keyEditorRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E2E8F0', paddingHorizontal: 16 },
  keyEditorNumber: { color: '#0F172A', fontSize: 14, fontWeight: '800', width: 44 },
  keyEditorOptions: { flexDirection: 'row', gap: 10 },
  keyEditorOption: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: '#CBD5E1', backgroundColor: '#EBF0F6', alignItems: 'center', justifyContent: 'center' },
  keyEditorOptionActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  keyEditorOptionText: { color: '#64748B', fontSize: 13, fontWeight: '700' },
  keyEditorOptionTextActive: { color: '#FFFFFF', fontWeight: '800' },
  keyEditorFooter: { padding: 18, borderTopWidth: 2, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  saveKeyAction: { minWidth: 150, flex: 1, height: 46, borderRadius: 16, backgroundColor: '#10B981', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderTopWidth: 2, borderTopColor: 'rgba(255, 255, 255, 0.4)', borderBottomWidth: 3.5, borderBottomColor: '#047857' },
});
