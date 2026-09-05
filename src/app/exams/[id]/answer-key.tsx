import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
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
          <ChevronLeft size={18} color="#4F46E5" />
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
            <Check size={16} color="#10B981" />
            <Text style={styles.savedText}>Current key loaded</Text>
          </View>
          <View style={styles.toolbarActions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push({ pathname: '/answer-sheets', params: { examId: exam.id } })}>
              <FileText size={16} color="#4F46E5" />
              <Text style={styles.secondaryButtonText}>Print Sheet</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={isExporting} style={[styles.primaryButton, isExporting && styles.disabled]} onPress={exportPdf}>
              <Download size={16} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>{isExporting ? 'Preparing...' : 'Key PDF'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        {!!message && <Text style={styles.message}>{message}</Text>}

        <View style={[styles.keyGrid, wide && styles.keyGridWide]}>
          {activeAnswerKeys.slice(0, exam.total_questions).map((key) => (
            <View key={key.question_number} style={[styles.keyRow, wide && styles.keyRowWide]}>
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
  emptyTitle: { color: '#0F172A', fontSize: 20, fontWeight: '800' },
  backLink: { alignSelf: 'flex-start', minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backText: { color: '#4F46E5', fontSize: 13, fontWeight: '800' },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 20 },
  headingCopy: { flex: 1 },
  eyebrowChip: {
    backgroundColor: '#EEF2FF',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: 6,
  },
  eyebrow: { color: '#4F46E5', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  title: { color: '#0F172A', fontSize: 25, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { color: '#64748B', fontSize: 12, lineHeight: 18, marginTop: 4 },
  progressBadge: {
    minWidth: 84,
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    borderRadius: 18,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#8CA0BA',
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  progressValue: { color: '#4F46E5', fontSize: 18, fontWeight: '800' },
  progressLabel: { color: '#64748B', fontSize: 10, fontWeight: '700', marginTop: 2 },
  toolbar: {
    minHeight: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
    shadowColor: '#8CA0BA',
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
  savedText: { color: '#047857', fontSize: 12, fontWeight: '700' },
  toolbarActions: { flexDirection: 'row', gap: 10 },
  secondaryButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  secondaryButtonText: { color: '#4F46E5', fontSize: 12, fontWeight: '800' },
  primaryButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#4F46E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 3,
    borderBottomColor: '#3730A3',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  message: { color: '#047857', fontSize: 12, fontWeight: '700', marginBottom: 14 },
  keyGrid: {
    ...ClayCardStyle,
    paddingHorizontal: 18,
  },
  keyGridWide: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24 },
  keyRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1.5, borderBottomColor: '#E2E8F0' },
  keyRowWide: { width: '48.5%' },
  questionNumber: { color: '#0F172A', fontSize: 14, fontWeight: '800', width: 44 },
  optionsGroup: { flexDirection: 'row', gap: 10 },
  optionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#EBF0F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionButtonSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 3,
    borderBottomColor: '#3730A3',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  optionText: { color: '#64748B', fontSize: 13, fontWeight: '700' },
  optionTextSelected: { color: '#FFFFFF', fontWeight: '800' },
});
