import React, { useMemo, useState } from 'react';
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
import { useRouter } from 'expo-router';
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
  getPagePoints,
  getQuestionColumns,
  scannerSupportsItemCount,
} from '../../services/omr/sheetLayout';
import { useExamStore } from '../../store/useExamStore';
import { AnswerKeyItem } from '../../types';

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

function MiniSheet({ config }: { config: AnswerSheetConfig }) {
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
              <View key={question} style={styles.previewQuestionRow}>
                <Text style={styles.previewQuestionNumber}>{`${question}.`}</Text>
                <View style={styles.previewBubbles}>
                  {options.map((option) => (
                    <View key={option} style={styles.previewBubble}>
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
  const { activeExam, activeAnswerKeys, setActiveAnswerKeys } = useExamStore();
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

  const isPreset = ITEM_PRESETS.includes(config.itemCount as (typeof ITEM_PRESETS)[number]);
  const scannerReady = scannerSupportsItemCount(config.itemCount);
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ChevronLeft size={17} color="#CBD5E1" />
          <Text style={styles.backText}>Exam manager</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sheet layout</Text>

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
                options={[{ label: 'One', value: 1 }, { label: 'Two', value: 2 }]}
                value={config.sheetsPerPage}
                onChange={(value) => updateConfig('sheetsPerPage', Number(value) as 1 | 2)}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Student information</Text>
          <View style={styles.fieldToggleGrid}>
            {metadataFields.map((key) => (
              <View key={key} style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{FIELD_LABELS[key]}</Text>
                <Switch
                  value={config.fields[key]}
                  onValueChange={(value) => updateField(key, value)}
                  trackColor={{ false: '#334155', true: '#0891B2' }}
                  thumbColor="#F8FAFC"
                />
              </View>
            ))}
          </View>

          <View style={styles.textFieldGrid}>
            <TextInput
              style={styles.textInput}
              placeholder="Test title"
              placeholderTextColor="#64748B"
              value={config.testTitle}
              onChangeText={(value) => updateConfig('testTitle', value)}
            />
            <TextInput
              style={styles.textInput}
              placeholder="Subject / section"
              placeholderTextColor="#64748B"
              value={config.subject}
              onChangeText={(value) => updateConfig('subject', value)}
            />
            <TextInput
              style={styles.textInput}
              placeholder="Teacher"
              placeholderTextColor="#64748B"
              value={config.teacher}
              onChangeText={(value) => updateConfig('teacher', value)}
            />
            <TextInput
              style={styles.textInput}
              placeholder="Sheet / test code"
              placeholderTextColor="#64748B"
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
              trackColor={{ false: '#334155', true: '#0891B2' }}
              thumbColor="#F8FAFC"
            />
          </View>
        </View>

        <View style={styles.previewSection}>
          <View style={styles.previewHeadingRow}>
            <View>
              <Text style={styles.sectionTitle}>Print preview</Text>
              <Text style={styles.previewCaption}>{`${config.paperSize === 'a4' ? 'A4' : 'US Letter'} · ${config.orientation} · ${config.sheetsPerPage} sheet${config.sheetsPerPage === 2 ? 's' : ''}`}</Text>
            </View>
            <View style={[styles.compatibilityBadge, scannerReady ? styles.readyBadge : styles.manualBadge]}>
              <Text style={styles.compatibilityText}>{scannerReady ? 'Scanner ready' : 'Print only'}</Text>
            </View>
          </View>
          {!scannerReady && (
            <Text style={styles.compatibilityNote}>The current camera scanner recognizes 25- and 50-item CheckMate layouts. Other counts can be printed and graded manually.</Text>
          )}
          <SheetPreview config={config} />
        </View>

        {Boolean(message || error) && (
          <View style={[styles.feedback, error ? styles.feedbackError : styles.feedbackSuccess]}>
            <Text style={styles.feedbackText}>{error || message}</Text>
          </View>
        )}

        <View style={styles.actionRow}>
          <Pressable style={styles.secondaryAction} onPress={() => setPreviewOpen(true)}>
            <Eye size={17} color="#E2E8F0" />
            <Text style={styles.secondaryActionText}>Preview</Text>
          </Pressable>
          <Pressable style={styles.keyAction} onPress={openAnswerKeyEditor}>
            <KeyRound size={17} color="#FFFFFF" />
            <Text style={styles.primaryActionText}>Answer Key</Text>
          </Pressable>
          <Pressable disabled={busyAction !== null} style={styles.secondaryAction} onPress={() => runAction('download')}>
            {busyAction === 'download' ? <ActivityIndicator size="small" color="#E2E8F0" /> : <Download size={17} color="#E2E8F0" />}
            <Text style={styles.secondaryActionText}>Save PDF</Text>
          </Pressable>
          <Pressable disabled={busyAction !== null} style={styles.primaryAction} onPress={() => runAction('print')}>
            {busyAction === 'print' ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Printer size={17} color="#FFFFFF" />}
            <Text style={styles.primaryActionText}>Print</Text>
          </Pressable>
          <Pressable disabled={busyAction !== null} style={styles.shareAction} onPress={() => runAction('share')}>
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
              <X size={20} color="#F8FAFC" />
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
              <X size={20} color="#F8FAFC" />
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
              {keyPdfBusy ? <ActivityIndicator size="small" color="#E2E8F0" /> : <FileDown size={17} color="#E2E8F0" />}
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
  screen: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 16, paddingBottom: 36, gap: 14 },
  backButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  backText: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  section: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 14 },
  sectionTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  label: { color: '#CBD5E1', fontSize: 11, fontWeight: '600', marginTop: 14, marginBottom: 7 },
  optionGroup: { flexDirection: 'row', borderWidth: 1, borderColor: '#475569', borderRadius: 7, overflow: 'hidden', minHeight: 36 },
  optionButton: { flex: 1, minWidth: 48, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A', borderRightWidth: 1, borderRightColor: '#334155' },
  optionButtonActive: { backgroundColor: '#0891B2' },
  optionText: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  optionTextActive: { color: '#FFFFFF' },
  customRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  customLabel: { color: '#CBD5E1', fontSize: 11, fontWeight: '600' },
  customInput: { width: 68, height: 36, borderWidth: 1, borderColor: '#475569', borderRadius: 7, color: '#F8FAFC', backgroundColor: '#0F172A', textAlign: 'center', fontSize: 12 },
  inputSuffix: { color: '#64748B', fontSize: 10 },
  settingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  settingBlock: { width: '48%', minWidth: 150, flexGrow: 1 },
  fieldToggleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  toggleRow: { width: '48%', minWidth: 155, flexGrow: 1, height: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, backgroundColor: '#0F172A', borderRadius: 7, borderWidth: 1, borderColor: '#334155' },
  toggleLabel: { color: '#E2E8F0', fontSize: 11, fontWeight: '600' },
  textFieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  textInput: { width: '48%', minWidth: 155, flexGrow: 1, height: 40, borderWidth: 1, borderColor: '#475569', borderRadius: 7, color: '#F8FAFC', backgroundColor: '#0F172A', paddingHorizontal: 10, fontSize: 11 },
  toggleRowWide: { marginTop: 12, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, backgroundColor: '#0F172A', borderRadius: 7, borderWidth: 1, borderColor: '#334155' },
  toggleCopy: { flex: 1, paddingVertical: 8, paddingRight: 8 },
  toggleHint: { color: '#64748B', fontSize: 9, marginTop: 2 },
  previewSection: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#334155', borderRadius: 8, paddingVertical: 14 },
  previewHeadingRow: { paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewCaption: { color: '#94A3B8', fontSize: 10, marginTop: 3, textTransform: 'capitalize' },
  compatibilityBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
  readyBadge: { backgroundColor: '#065F46' },
  manualBadge: { backgroundColor: '#854D0E' },
  compatibilityText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  compatibilityNote: { color: '#FDE68A', fontSize: 10, lineHeight: 14, marginHorizontal: 14, marginTop: 8 },
  previewScroller: { padding: 14, alignItems: 'flex-start' },
  paperPreview: { backgroundColor: '#FFFFFF', padding: 10, flexDirection: 'row', borderWidth: 1, borderColor: '#94A3B8', elevation: 3 },
  miniSheet: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#111827', paddingHorizontal: 12, paddingTop: 11, paddingBottom: 10, position: 'relative', overflow: 'hidden' },
  previewCutLine: { width: 1, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: '#64748B', marginHorizontal: 8 },
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
  previewQuestionNumber: { color: '#000000', width: 19, fontSize: 5.5, fontWeight: '700', textAlign: 'right', marginRight: 3 },
  previewBubbles: { flex: 1, flexDirection: 'row', justifyContent: 'space-evenly' },
  previewBubble: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  previewBubbleText: { color: '#000000', fontSize: 4, fontWeight: '700' },
  previewLayoutId: { position: 'absolute', bottom: 2, left: 12, right: 12, color: '#000000', fontSize: 4 },
  feedback: { borderRadius: 7, borderWidth: 1, padding: 10 },
  feedbackSuccess: { backgroundColor: '#064E3B', borderColor: '#10B981' },
  feedbackError: { backgroundColor: '#7F1D1D', borderColor: '#EF4444' },
  feedbackText: { color: '#FFFFFF', fontSize: 11, lineHeight: 16 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secondaryAction: { minWidth: 120, flex: 1, height: 42, borderRadius: 7, borderWidth: 1, borderColor: '#475569', backgroundColor: '#1E293B', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  secondaryActionText: { color: '#E2E8F0', fontSize: 11, fontWeight: '700' },
  keyAction: { minWidth: 120, flex: 1, height: 42, borderRadius: 7, backgroundColor: '#7C3AED', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  primaryAction: { minWidth: 110, flex: 1, height: 42, borderRadius: 7, backgroundColor: '#4F46E5', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  shareAction: { minWidth: 120, flex: 1, height: 42, borderRadius: 7, backgroundColor: '#0891B2', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  modalScreen: { flex: 1, backgroundColor: '#0F172A' },
  modalHeader: { minHeight: 78, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#334155' },
  modalHeaderCopy: { flex: 1, paddingRight: 12 },
  modalTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },
  modalSubtitle: { color: '#94A3B8', fontSize: 10, marginTop: 3, maxWidth: 430 },
  iconButton: { width: 38, height: 38, borderRadius: 7, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' },
  modalPreview: { flex: 1, justifyContent: 'center' },
  keyEditorContent: { padding: 14, paddingBottom: 24 },
  keyEditorRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#0F172A', backgroundColor: '#1E293B', paddingHorizontal: 14 },
  keyEditorNumber: { color: '#F8FAFC', fontSize: 13, fontWeight: '800', width: 42 },
  keyEditorOptions: { flexDirection: 'row', gap: 8 },
  keyEditorOption: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#475569', backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
  keyEditorOptionActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  keyEditorOptionText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  keyEditorOptionTextActive: { color: '#FFFFFF', fontWeight: '800' },
  keyEditorFooter: { padding: 14, borderTopWidth: 1, borderTopColor: '#334155', backgroundColor: '#111827', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  saveKeyAction: { minWidth: 150, flex: 1, height: 42, borderRadius: 7, backgroundColor: '#10B981', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
});
