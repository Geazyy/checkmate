import { ActionButton as TouchableOpacity } from '../../../components/common/Controls';
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Check, ChevronLeft, Download, FileText } from 'lucide-react-native';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { AppShell } from '../../../components/common/AppShell';
import { generateAnswerKeyMatrixPDF } from '../../../services/export/pdfGenerator';
import { OPTION_LETTERS } from '../../../services/omr/scannerEngine';
import { useExamStore } from '../../../store/useExamStore';
import { ClayCardStyle, ClayColors } from '../../../constants/theme';

export default function AnswerKeyScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { exams, activeAnswerKeys, setActiveExam, updateAnswerKeyOption } = useExamStore();
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState('');
  const exam = exams.find((item) => item.id === id);
  const wide = width >= 820;

  useEffect(() => {
    if (exam) setActiveExam(exam);
  }, [exam, setActiveExam]);

  if (!exam) {
    return (
      <AppShell title="Answer Key">
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Exam Not Found</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/exams')}>
            <Text style={styles.primaryButtonText}>Return to Exams</Text>
          </TouchableOpacity>
        </View>
      </AppShell>
    );
  }

  const configured = activeAnswerKeys.filter((key) => key.correct_options.length > 0).length;
  const options = OPTION_LETTERS.slice(0, exam.options_per_question);

  const exportPdf = async () => {
    setIsExporting(true);
    setMessage('');
    try {
      await generateAnswerKeyMatrixPDF(exam, activeAnswerKeys);
      setMessage('Answer key PDF is ready.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create the answer key PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppShell title="Answer Key">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backLink} onPress={() => router.replace(`/exams/${exam.id}` as Href)}>
          <ChevronLeft size={18} color={ClayColors.primary} />
          <Text style={styles.backText}>Exam Workspace</Text>
        </TouchableOpacity>

        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <View style={styles.eyebrowChip}>
              <Text style={styles.eyebrow}>ANSWER KEY EDITOR</Text>
            </View>
            <Text style={styles.title}>{exam.title}</Text>
            <Text style={styles.subtitle}>Tap one option for each question. Changes apply immediately.</Text>
          </View>
          <View style={styles.progressBadge}>
            <Text style={styles.progressValue}>{configured}/{exam.total_questions}</Text>
            <Text style={styles.progressLabel}>configured</Text>
          </View>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.savedState}>
            <Check size={16} color={ClayColors.success} />
            <Text style={styles.savedText}>Current key loaded</Text>
          </View>
          <View style={styles.toolbarActions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push({ pathname: '/answer-sheets', params: { examId: exam.id } })}>
              <FileText size={16} color={ClayColors.primary} />
              <Text style={styles.secondaryButtonText}>Print Sheet</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={isExporting} style={[styles.primaryButton, isExporting && styles.disabled]} onPress={exportPdf}>
              <Download size={16} color={ClayColors.onPrimary} />
              <Text style={styles.primaryButtonText}>{isExporting ? 'Preparing...' : 'Key PDF'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        {!!message && <Text style={styles.message}>{message}</Text>}

        <View style={[styles.keyGrid, wide && styles.keyGridWide]}>
          {activeAnswerKeys.slice(0, exam.total_questions).map((key) => (
            <View key={key.question_number} style={[styles.keyRow, wide && styles.keyRowWide, width < 480 && styles.keyRowCompact]}>
              <Text style={styles.questionNumber}>Q{key.question_number}</Text>
              <View style={styles.optionsGroup}>
                {options.map((option) => {
                  const selected = key.correct_options.includes(option);
                  return (
                    <TouchableOpacity
                      accessibilityLabel={`Question ${key.question_number}, answer ${option}`}
                      accessibilityState={{ selected }}
                      key={option}
                      style={[styles.optionButton, selected && styles.optionButtonSelected]}
                      onPress={() => updateAnswerKeyOption(key.question_number, [option])}>
                      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 1000, alignSelf: 'center', padding: 20, paddingBottom: 60 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 28 },
  emptyTitle: { color: ClayColors.textPrimary, fontSize: 20, fontWeight: '800' },
  backLink: { alignSelf: 'flex-start', minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backText: { color: ClayColors.primary, fontSize: 13, fontWeight: '800' },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 20 },
  headingCopy: { flex: 1 },
  eyebrowChip: {
    backgroundColor: ClayColors.cardIndigo,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ClayColors.indigoBorder,
    marginBottom: 6,
  },
  eyebrow: { color: ClayColors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0 },
  title: { color: ClayColors.textPrimary, fontSize: 25, fontWeight: '800', letterSpacing: 0 },
  subtitle: { color: ClayColors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  progressBadge: {
    minWidth: 84,
    backgroundColor: ClayColors.cardIndigo,
    borderWidth: 1.5,
    borderColor: ClayColors.indigoBorder,
    borderRadius: 18,
    padding: 12,
    alignItems: 'center',
    shadowColor: ClayColors.shadow,
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  progressValue: { color: ClayColors.primary, fontSize: 18, fontWeight: '800' },
  progressLabel: { color: ClayColors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 2 },
  toolbar: {
    flexWrap: 'wrap',
    minHeight: 60,
    backgroundColor: ClayColors.onPrimary,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
    shadowColor: ClayColors.shadow,
    shadowOffset: { width: 3, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '4px 4px 12px rgba(160, 175, 195, 0.3), -3px -3px 10px rgba(255, 255, 255, 0.9)',
        } as any)
      : {}),
  },
  savedState: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6 },
  savedText: { color: ClayColors.success, fontSize: 12, fontWeight: '700' },
  toolbarActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  secondaryButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: ClayColors.cardIndigo,
    borderWidth: 1.5,
    borderColor: ClayColors.indigoBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  secondaryButtonText: { color: ClayColors.primary, fontSize: 12, fontWeight: '800' },
  primaryButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: ClayColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 3,
    borderBottomColor: ClayColors.primaryBevel,
    shadowColor: ClayColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryButtonText: { color: ClayColors.onPrimary, fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  message: { color: ClayColors.success, fontSize: 12, fontWeight: '700', marginBottom: 14 },
  keyGrid: {
    ...ClayCardStyle,
    paddingHorizontal: 18,
  },
  keyGridWide: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24 },
  keyRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1.5, borderBottomColor: ClayColors.borderSubtle },
  keyRowWide: { width: '48.5%' },
  keyRowCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 10, paddingVertical: 12 },
  questionNumber: { color: ClayColors.textPrimary, fontSize: 14, fontWeight: '800', width: 44 },
  optionsGroup: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  optionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: ClayColors.borderDarker,
    backgroundColor: ClayColors.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionButtonSelected: {
    backgroundColor: ClayColors.primary,
    borderColor: ClayColors.primary,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 3,
    borderBottomColor: ClayColors.primaryBevel,
    shadowColor: ClayColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  optionText: { color: ClayColors.textMuted, fontSize: 13, fontWeight: '700' },
  optionTextSelected: { color: ClayColors.onPrimary, fontWeight: '800' },
});
