import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Href, useRouter } from 'expo-router';
import { AppHeader } from '../../components/common/Header';
import { useExamStore } from '../../store/useExamStore';
import { OPTION_LETTERS } from '../../services/omr/scannerEngine';
import { generateAnswerKeyMatrixPDF } from '../../services/export/pdfGenerator';
import { QuestionCount } from '../../types';

export default function ExamsManagerScreen() {
  const router = useRouter();
  const { exams, activeExam, activeAnswerKeys, setActiveExam, addExam, updateAnswerKeyOption } =
    useExamStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [questionCount, setQuestionCount] = useState<QuestionCount>(50);
  const [isExporting, setIsExporting] = useState(false);

  const handleCreateExam = () => {
    if (!newTitle.trim()) return;

    const newExamId = `exam-${Date.now()}`;
    const createdExam = {
      id: newExamId,
      teacher_id: 'demo-teacher-id',
      title: newTitle,
      description: newSubject,
      total_questions: questionCount,
      options_per_question: 4 as const,
      passing_score: 60,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      scanned_count: 0,
      average_score: 0,
      class_name: newSubject || 'General',
    };

    const newKeys = Array.from({ length: questionCount }, (_, i) => ({
      exam_id: newExamId,
      question_number: i + 1,
      correct_options: ['A'],
      points: 1.0,
    }));

    addExam(createdExam, newKeys);
    setIsCreating(false);
    setNewTitle('');
    setNewSubject('');
  };

  const handleExportKeyPdf = async () => {
    if (!activeExam) return;
    setIsExporting(true);
    await generateAnswerKeyMatrixPDF(activeExam, activeAnswerKeys);
    setIsExporting(false);
  };

  const handleOpenSheetGenerator = () => {
    if (!activeExam) return;
    router.push('/answer-sheets' as Href);
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="Exam & Key Manager" />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Create Exam Toggle */}
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>My Exam Catalog</Text>
          <TouchableOpacity style={styles.createBtn} onPress={() => setIsCreating(!isCreating)}>
            <Text style={styles.createBtnText}>{isCreating ? '✕ Cancel' : '＋ New Exam'}</Text>
          </TouchableOpacity>
        </View>

        {/* Create Exam Form Modal Card */}
        {isCreating && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Configure New Exam</Text>
            <TextInput
              style={styles.input}
              placeholder="Exam Title (e.g. Midterm Physics)"
              placeholderTextColor="#64748B"
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <TextInput
              style={styles.input}
              placeholder="Subject / Section"
              placeholderTextColor="#64748B"
              value={newSubject}
              onChangeText={setNewSubject}
            />

            <Text style={styles.label}>Question Count:</Text>
            <View style={styles.countRow}>
              {([25, 50, 100] as QuestionCount[]).map((count) => (
                <TouchableOpacity
                  key={count}
                  style={[styles.countPill, questionCount === count && styles.countPillActive]}
                  onPress={() => setQuestionCount(count)}>
                  <Text
                    style={[
                      styles.countPillText,
                      questionCount === count && { color: '#FFFFFF' },
                    ]}>
                    {count} Questions
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateExam}>
              <Text style={styles.submitText}>Save & Build Answer Key</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Exam List */}
        {exams.map((exam) => {
          const isSelected = activeExam?.id === exam.id;
          return (
            <View key={exam.id} style={[styles.examCard, isSelected && styles.examCardActive]}>
              <TouchableOpacity style={styles.examMainInfo} onPress={() => setActiveExam(exam)}>
                <Text style={styles.examTitle}>{exam.title}</Text>
                <Text style={styles.examSub}>
                  {exam.class_name} • {exam.total_questions} Questions
                </Text>
              </TouchableOpacity>

              <View style={styles.examActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => router.push(`/exams/${exam.id}/analytics`)}>
                  <Text style={styles.actionBtnText}>Analytics</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#4F46E5' }]}
                  onPress={() => {
                    setActiveExam(exam);
                    router.push('/scan');
                  }}>
                  <Text style={styles.actionBtnText}>Scan</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Active Answer Key Setup Grid */}
        {activeExam && (
          <View style={styles.keySection}>
            <View style={styles.keySectionHeader}>
              <Text style={styles.keyTitle}>
                Answer Key Matrix for: <Text style={{ color: '#06B6D4' }}>{activeExam.title}</Text>
              </Text>
              <View style={styles.exportGroup}>
                <TouchableOpacity
                  style={[styles.exportPdfBtn, isExporting && { opacity: 0.6 }]}
                  disabled={isExporting}
                  onPress={handleExportKeyPdf}>
                  <Text style={styles.exportPdfText}>📄 Download Key PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.exportSheetBtn}
                  onPress={handleOpenSheetGenerator}>
                  <Text style={styles.exportSheetText}>Blank Bubble Sheet</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.keyGrid}>
              {activeAnswerKeys.slice(0, activeExam.total_questions).map((key) => (
                <View key={key.question_number} style={styles.keyRow}>
                  <Text style={styles.keyNum}>Q{key.question_number}</Text>
                  <View style={styles.optionsGroup}>
                    {OPTION_LETTERS.slice(0, 4).map((opt) => {
                      const isPicked = key.correct_options.includes(opt);
                      return (
                        <TouchableOpacity
                          key={opt}
                          style={[styles.keyOptionBtn, isPicked && styles.keyOptionActive]}
                          onPress={() => updateAnswerKeyOption(key.question_number, [opt])}>
                          <Text
                            style={[
                              styles.keyOptionText,
                              isPicked && { color: '#FFFFFF', fontWeight: '700' },
                            ]}>
                            {opt}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  createBtn: { backgroundColor: '#4F46E5', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
  createBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  formCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  formTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '700', marginBottom: 12 },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    color: '#F8FAFC',
    fontSize: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  label: { color: '#94A3B8', fontSize: 11, marginBottom: 6 },
  countRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  countPill: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  countPillActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  countPillText: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  submitBtn: { backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  submitText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  examCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#334155',
  },
  examCardActive: { borderColor: '#4F46E5', borderWidth: 1.5 },
  examMainInfo: { flex: 1 },
  examTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  examSub: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  examActions: { flexDirection: 'row', gap: 6 },
  actionBtn: { backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  actionBtnText: { color: '#F8FAFC', fontSize: 10, fontWeight: '600' },
  keySection: { marginTop: 20 },
  keySectionHeader: {
    marginBottom: 12,
  },
  keyTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  exportGroup: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  exportPdfBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  exportPdfText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  exportSheetBtn: {
    backgroundColor: '#06B6D4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  exportSheetText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  keyGrid: { backgroundColor: '#1E293B', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#334155' },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  keyNum: { color: '#F8FAFC', fontSize: 12, fontWeight: '700', width: 36 },
  optionsGroup: { flexDirection: 'row', gap: 6 },
  keyOptionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  keyOptionActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  keyOptionText: { color: '#94A3B8', fontSize: 11 },
});
