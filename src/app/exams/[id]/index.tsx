import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BarChart3, ChevronRight, ClipboardCheck, FileText, ScanLine, Users } from 'lucide-react-native';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { AppShell } from '../../../components/common/AppShell';
import { useExamStore } from '../../../store/useExamStore';
import { useScanStore } from '../../../store/useScanStore';

export default function ExamWorkspaceScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { exams, answerKeysByExamId, setActiveExam } = useExamStore();
  const scannedResults = useScanStore((state) => state.scannedResults);
  const exam = exams.find((item) => item.id === id);

  useEffect(() => {
    if (exam) setActiveExam(exam);
  }, [exam, setActiveExam]);

  if (!exam) {
    return (
      <AppShell title="Exam workspace">
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Exam not found</Text>
          <Text style={styles.emptyText}>Return to the exam catalog and choose an available exam.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/exams')}>
            <Text style={styles.primaryButtonText}>Open exams</Text>
          </TouchableOpacity>
        </View>
      </AppShell>
    );
  }

  const keys = answerKeysByExamId[exam.id] ?? [];
  const completedKeys = keys.filter((key) => key.correct_options.length > 0).length;
  const examScans = scannedResults.filter((scan) => scan.exam_id === exam.id);

  const actions = [
    {
      title: 'Scan answer sheet',
      detail: 'Capture or upload a completed sheet',
      icon: ScanLine,
      color: '#4F46E5',
      onPress: () => router.push({ pathname: '/scan', params: { examId: exam.id } }),
    },
    {
      title: 'Edit answer key',
      detail: `${completedKeys}/${exam.total_questions} answers configured`,
      icon: ClipboardCheck,
      color: '#0891B2',
      onPress: () => router.push(`/exams/${exam.id}/answer-key` as Href),
    },
    {
      title: 'Print answer sheets',
      detail: 'Preview, save, print, or share PDF',
      icon: FileText,
      color: '#059669',
      onPress: () => router.push({ pathname: '/answer-sheets', params: { examId: exam.id } }),
    },
    {
      title: 'Open class roster',
      detail: exam.class_name ?? 'Manage students for this exam',
      icon: Users,
      color: '#475569',
      onPress: () => router.push('/rosters'),
    },
  ];

  return (
    <AppShell title="Exam workspace">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.breadcrumbRow}>
          <TouchableOpacity onPress={() => router.replace('/exams')}>
            <Text style={styles.breadcrumbLink}>Exams</Text>
          </TouchableOpacity>
          <ChevronRight size={14} color="#64748B" />
          <Text style={styles.breadcrumbCurrent} numberOfLines={1}>{exam.title}</Text>
        </View>

        <View style={styles.examHeader}>
          <View style={styles.examHeading}>
            <Text style={styles.examTitle}>{exam.title}</Text>
            <Text style={styles.examDescription}>{exam.description || exam.class_name || 'General assessment'}</Text>
          </View>
          <View style={styles.itemBadge}>
            <Text style={styles.itemBadgeValue}>{exam.total_questions}</Text>
            <Text style={styles.itemBadgeLabel}>items</Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metric}><Text style={styles.metricValue}>{completedKeys}</Text><Text style={styles.metricLabel}>Key answers</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{examScans.length}</Text><Text style={styles.metricLabel}>Scans saved</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{exam.passing_score}%</Text><Text style={styles.metricLabel}>Passing score</Text></View>
        </View>

        <Text style={styles.sectionTitle}>Exam tools</Text>
        <View style={styles.actionGrid}>
          {actions.map(({ title, detail, icon: Icon, color, onPress }) => (
            <TouchableOpacity key={title} style={styles.actionCard} onPress={onPress}>
              <View style={[styles.actionIcon, { backgroundColor: color }]}><Icon size={22} color="#FFFFFF" /></View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>{title}</Text>
                <Text style={styles.actionDetail}>{detail}</Text>
              </View>
              <ChevronRight size={19} color="#64748B" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.resultsBand}>
          <BarChart3 size={22} color="#94A3B8" />
          <View style={styles.resultsCopy}>
            <Text style={styles.resultsTitle}>Results and analytics</Text>
            <Text style={styles.resultsDetail}>Review saved scans when you are ready.</Text>
          </View>
          <TouchableOpacity onPress={() => router.push(`/exams/${exam.id}/analytics`)}>
            <Text style={styles.resultsLink}>View results</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 1040, alignSelf: 'center', padding: 20, paddingBottom: 28 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '700' },
  emptyText: { color: '#94A3B8', fontSize: 13, marginTop: 8, marginBottom: 20, textAlign: 'center' },
  primaryButton: { backgroundColor: '#4F46E5', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 11 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700' },
  breadcrumbRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  breadcrumbLink: { color: '#22D3EE', fontSize: 12, fontWeight: '600' },
  breadcrumbCurrent: { color: '#94A3B8', fontSize: 12, flex: 1 },
  examHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18 },
  examHeading: { flex: 1 },
  examTitle: { color: '#F8FAFC', fontSize: 24, fontWeight: '800' },
  examDescription: { color: '#94A3B8', fontSize: 13, marginTop: 5 },
  itemBadge: { minWidth: 62, padding: 9, borderRadius: 8, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  itemBadgeValue: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
  itemBadgeLabel: { color: '#94A3B8', fontSize: 10 },
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 26 },
  metric: { flex: 1, minHeight: 70, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 12 },
  metricValue: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
  metricLabel: { color: '#94A3B8', fontSize: 10, marginTop: 4 },
  sectionTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  actionGrid: { gap: 9 },
  actionCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 12 },
  actionIcon: { width: 42, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1 },
  actionTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  actionDetail: { color: '#94A3B8', fontSize: 11, marginTop: 3 },
  resultsBand: { marginTop: 22, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultsCopy: { flex: 1 },
  resultsTitle: { color: '#CBD5E1', fontSize: 13, fontWeight: '700' },
  resultsDetail: { color: '#64748B', fontSize: 10, marginTop: 2 },
  resultsLink: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
});
