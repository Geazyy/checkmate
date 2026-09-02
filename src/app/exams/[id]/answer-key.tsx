import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Check, ChevronLeft, Download, FileText } from 'lucide-react-native';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { AppShell } from '../../../components/common/AppShell';
import { generateAnswerKeyMatrixPDF } from '../../../services/export/pdfGenerator';
import { OPTION_LETTERS } from '../../../services/omr/scannerEngine';
import { useExamStore } from '../../../store/useExamStore';

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
      <AppShell title="Answer key">
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Exam not found</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/exams')}>
            <Text style={styles.primaryButtonText}>Return to exams</Text>
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
    <AppShell title="Answer key">
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backLink} onPress={() => router.replace(`/exams/${exam.id}` as Href)}>
          <ChevronLeft size={17} color="#94A3B8" /><Text style={styles.backText}>Exam workspace</Text>
        </TouchableOpacity>

        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>ANSWER KEY</Text>
            <Text style={styles.title}>{exam.title}</Text>
            <Text style={styles.subtitle}>Tap one option for each question. Changes apply immediately.</Text>
          </View>
          <View style={styles.progressBadge}>
            <Text style={styles.progressValue}>{configured}/{exam.total_questions}</Text>
            <Text style={styles.progressLabel}>configured</Text>
          </View>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.savedState}><Check size={15} color="#34D399" /><Text style={styles.savedText}>Current key loaded</Text></View>
          <View style={styles.toolbarActions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push({ pathname: '/answer-sheets', params: { examId: exam.id } })}>
              <FileText size={16} color="#CBD5E1" /><Text style={styles.secondaryButtonText}>Print sheet</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={isExporting} style={[styles.primaryButton, isExporting && styles.disabled]} onPress={exportPdf}>
              <Download size={16} color="#FFFFFF" /><Text style={styles.primaryButtonText}>{isExporting ? 'Preparing...' : 'Key PDF'}</Text>
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
  content: { width: '100%', maxWidth: 1000, alignSelf: 'center', padding: 20, paddingBottom: 34 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  emptyTitle: { color: '#F8FAFC', fontSize: 19, fontWeight: '800' },
  backLink: { alignSelf: 'flex-start', minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  backText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 20 },
  headingCopy: { flex: 1 }, eyebrow: { color: '#22D3EE', fontSize: 10, fontWeight: '800' },
  title: { color: '#F8FAFC', fontSize: 23, fontWeight: '800', marginTop: 4 },
  subtitle: { color: '#94A3B8', fontSize: 11, lineHeight: 17, marginTop: 5 },
  progressBadge: { minWidth: 76, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 9, alignItems: 'center' },
  progressValue: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' }, progressLabel: { color: '#64748B', fontSize: 9, marginTop: 2 },
  toolbar: { minHeight: 56, backgroundColor: '#182438', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  savedState: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 5 }, savedText: { color: '#94A3B8', fontSize: 10, fontWeight: '600' },
  toolbarActions: { flexDirection: 'row', gap: 7 },
  secondaryButton: { minHeight: 38, paddingHorizontal: 11, borderRadius: 8, backgroundColor: '#29364A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secondaryButtonText: { color: '#CBD5E1', fontSize: 10, fontWeight: '700' },
  primaryButton: { minHeight: 38, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#4F46E5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' }, disabled: { opacity: 0.55 },
  message: { color: '#67E8F9', fontSize: 11, marginBottom: 12 },
  keyGrid: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 8, paddingHorizontal: 14 },
  keyGridWide: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24 },
  keyRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#2A384C' },
  keyRowWide: { width: '48.5%' }, questionNumber: { color: '#E2E8F0', fontSize: 12, fontWeight: '800', width: 42 },
  optionsGroup: { flexDirection: 'row', gap: 8 },
  optionButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#475569', backgroundColor: '#111C30', alignItems: 'center', justifyContent: 'center' },
  optionButtonSelected: { backgroundColor: '#4F46E5', borderColor: '#818CF8' }, optionText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' }, optionTextSelected: { color: '#FFFFFF' },
});
