import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { ArrowRight, CheckCircle2, FileText, Plus, ScanLine, X } from 'lucide-react-native';
import { Href, useRouter } from 'expo-router';
import { AppShell } from '../../components/common/AppShell';
import { useExamStore } from '../../store/useExamStore';
import { QuestionCount } from '../../types';

export default function ExamsManagerScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { exams, answerKeysByExamId, setActiveExam, addExam } = useExamStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [questionCount, setQuestionCount] = useState<QuestionCount>(25);
  const [formError, setFormError] = useState('');
  const wide = width >= 760;

  const closeForm = () => { setIsCreating(false); setFormError(''); };
  const handleCreateExam = () => {
    if (!newTitle.trim()) { setFormError('Enter an exam title to continue.'); return; }
    const id = `exam-${Date.now()}`;
    const exam = {
      id, teacher_id: 'demo-teacher-id', title: newTitle.trim(), description: newSubject.trim(),
      total_questions: questionCount, options_per_question: 4 as const, passing_score: 60,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      scanned_count: 0, average_score: 0, class_name: newSubject.trim() || 'General',
    };
    const keys = Array.from({ length: questionCount }, (_, index) => ({
      exam_id: id, question_number: index + 1, correct_options: ['A'], points: 1,
    }));
    addExam(exam, keys);
    setNewTitle(''); setNewSubject(''); closeForm();
    router.push(`/exams/${id}` as Href);
  };

  return (
    <AppShell title="Exams">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.pageHeading}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>ASSESSMENTS</Text>
            <Text style={styles.pageTitle}>Exam catalog</Text>
            <Text style={styles.pageSub}>Set up keys, print sheets, and start grading from one place.</Text>
          </View>
          <TouchableOpacity style={styles.createButton} onPress={() => isCreating ? closeForm() : setIsCreating(true)}>
            {isCreating ? <X size={18} color="#FFFFFF" /> : <Plus size={18} color="#FFFFFF" />}
            <Text style={styles.createButtonText}>{isCreating ? 'Close' : 'New exam'}</Text>
          </TouchableOpacity>
        </View>

        {isCreating && (
          <View style={styles.formPanel}>
            <Text style={styles.formTitle}>Create an exam</Text>
            <Text style={styles.formSub}>You can edit the answer key after creating it.</Text>
            <View style={[styles.formFields, wide && styles.formFieldsWide]}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Exam title</Text>
                <TextInput autoFocus style={[styles.input, formError && !newTitle.trim() ? styles.inputError : undefined]}
                  placeholder="Example: Chemistry Quiz 3" placeholderTextColor="#64748B" value={newTitle}
                  onChangeText={(value) => { setNewTitle(value); setFormError(''); }} />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Subject or class</Text>
                <TextInput style={styles.input} placeholder="Example: Chem 202 - Sec B" placeholderTextColor="#64748B"
                  value={newSubject} onChangeText={setNewSubject} />
              </View>
            </View>
            <Text style={styles.label}>Number of questions</Text>
            <View style={styles.segmentedControl}>
              {([25, 50, 100] as QuestionCount[]).map((count) => (
                <TouchableOpacity key={count} style={[styles.segment, questionCount === count && styles.segmentActive]}
                  onPress={() => setQuestionCount(count)}>
                  <Text style={[styles.segmentText, questionCount === count && styles.segmentTextActive]}>{count}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {!!formError && <Text style={styles.errorText}>{formError}</Text>}
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={closeForm}><Text style={styles.secondaryButtonText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={handleCreateExam}>
                <Text style={styles.primaryButtonText}>Create exam</Text><ArrowRight size={17} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.listHeader}><Text style={styles.sectionTitle}>Your exams</Text><Text style={styles.countText}>{exams.length} total</Text></View>
        <View style={[styles.examGrid, wide && styles.examGridWide]}>
          {exams.map((exam) => {
            const configured = (answerKeysByExamId[exam.id] ?? []).filter((key) => key.correct_options.length > 0).length;
            const keyReady = configured === exam.total_questions;
            return (
              <View key={exam.id} style={[styles.examCard, wide && styles.examCardWide]}>
                <View style={styles.examTopRow}>
                  <View style={styles.documentIcon}><FileText size={21} color="#67E8F9" /></View>
                  <View style={[styles.statusBadge, keyReady && styles.statusBadgeReady]}>
                    <CheckCircle2 size={13} color={keyReady ? '#34D399' : '#FBBF24'} />
                    <Text style={[styles.statusText, keyReady && styles.statusTextReady]}>{keyReady ? 'Key ready' : `${configured}/${exam.total_questions} keyed`}</Text>
                  </View>
                </View>
                <Text style={styles.examTitle} numberOfLines={2}>{exam.title}</Text>
                <Text style={styles.examSub} numberOfLines={1}>{exam.class_name || exam.description || 'General'}</Text>
                <View style={styles.examMeta}>
                  <Text style={styles.metaText}>{exam.total_questions} questions</Text><View style={styles.metaDot} /><Text style={styles.metaText}>{exam.scanned_count ?? 0} scans</Text>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity accessibilityLabel={`Open ${exam.title}`} style={styles.openButton}
                    onPress={() => { setActiveExam(exam); router.push(`/exams/${exam.id}` as Href); }}>
                    <Text style={styles.openButtonText}>Open exam</Text><ArrowRight size={16} color="#E2E8F0" />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityLabel={`Scan ${exam.title}`} style={styles.scanButton}
                    onPress={() => { setActiveExam(exam); router.push({ pathname: '/scan', params: { examId: exam.id } }); }}>
                    <ScanLine size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 1080, alignSelf: 'center', padding: 20, paddingBottom: 30 },
  pageHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 },
  headingCopy: { flex: 1 }, eyebrow: { color: '#22D3EE', fontSize: 10, fontWeight: '800' },
  pageTitle: { color: '#F8FAFC', fontSize: 24, fontWeight: '800', marginTop: 4 },
  pageSub: { color: '#94A3B8', fontSize: 12, lineHeight: 18, marginTop: 5, maxWidth: 500 },
  createButton: { minHeight: 42, paddingHorizontal: 15, borderRadius: 8, backgroundColor: '#4F46E5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  createButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  formPanel: { backgroundColor: '#182438', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 18, marginBottom: 26 },
  formTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' }, formSub: { color: '#94A3B8', fontSize: 11, marginTop: 3, marginBottom: 16 },
  formFields: { gap: 12 }, formFieldsWide: { flexDirection: 'row' }, fieldGroup: { flex: 1 },
  label: { color: '#CBD5E1', fontSize: 11, fontWeight: '700', marginBottom: 7 },
  input: { minHeight: 44, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#3B4A61', borderRadius: 8, color: '#F8FAFC', fontSize: 13, paddingHorizontal: 12, marginBottom: 14 },
  inputError: { borderColor: '#F87171' }, segmentedControl: { width: '100%', maxWidth: 330, flexDirection: 'row', borderRadius: 8, padding: 3, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155' },
  segment: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 6 }, segmentActive: { backgroundColor: '#334155' },
  segmentText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' }, segmentTextActive: { color: '#FFFFFF' }, errorText: { color: '#FCA5A5', fontSize: 11, marginTop: 8 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 18 },
  secondaryButton: { minHeight: 40, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#475569', alignItems: 'center', justifyContent: 'center' }, secondaryButtonText: { color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
  primaryButton: { minHeight: 40, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#059669', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }, sectionTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' }, countText: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  examGrid: { gap: 11 }, examGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  examCard: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 15 }, examCardWide: { width: '48.8%' },
  examTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }, documentIcon: { width: 38, height: 38, borderRadius: 8, backgroundColor: 'rgba(8,145,178,0.15)', alignItems: 'center', justifyContent: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: 8, paddingVertical: 5 }, statusBadgeReady: { backgroundColor: 'rgba(16,185,129,0.12)' },
  statusText: { color: '#FBBF24', fontSize: 9, fontWeight: '800' }, statusTextReady: { color: '#34D399' },
  examTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '800', lineHeight: 21 }, examSub: { color: '#94A3B8', fontSize: 11, marginTop: 5 },
  examMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 }, metaText: { color: '#64748B', fontSize: 10, fontWeight: '600' }, metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#475569' },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 16 }, openButton: { flex: 1, minHeight: 40, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#29364A', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  openButtonText: { color: '#E2E8F0', fontSize: 12, fontWeight: '700' }, scanButton: { width: 42, height: 40, borderRadius: 8, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
});
