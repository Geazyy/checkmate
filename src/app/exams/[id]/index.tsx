import React, { useEffect } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BarChart3, ChevronRight, ClipboardCheck, FileText, ScanLine, Users } from 'lucide-react-native';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { AppShell } from '../../../components/common/AppShell';
import { useExamStore } from '../../../store/useExamStore';
import { useScanStore } from '../../../store/useScanStore';
import { ClayCardStyle, ClayColors } from '../../../constants/theme';

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
      <AppShell title="Exam Workspace">
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Exam Not Found</Text>
          <Text style={styles.emptyText}>Return to the exam catalog and choose an available exam.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/exams')}>
            <Text style={styles.primaryButtonText}>Open Exam Catalog</Text>
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
      title: 'Scan Answer Sheet',
      detail: 'Capture or upload a completed sheet',
      icon: ScanLine,
      color: '#4F46E5',
      onPress: () => router.push({ pathname: '/scan', params: { examId: exam.id } }),
    },
    {
      title: 'Edit Answer Key',
      detail: `${completedKeys}/${exam.total_questions} answers configured`,
      icon: ClipboardCheck,
      color: '#06B6D4',
      onPress: () => router.push(`/exams/${exam.id}/answer-key` as Href),
    },
    {
      title: 'Print Answer Sheets',
      detail: 'Preview, save, print, or share PDF',
      icon: FileText,
      color: '#10B981',
      onPress: () => router.push({ pathname: '/answer-sheets', params: { examId: exam.id } }),
    },
    {
      title: 'Open Class Roster',
      detail: exam.class_name ?? 'Manage students for this exam',
      icon: Users,
      color: '#8B5CF6',
      onPress: () => router.push('/rosters'),
    },
  ];

  return (
    <AppShell title="Exam Workspace">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
          <View style={[styles.metric, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}>
            <Text style={styles.metricValue}>{completedKeys}</Text>
            <Text style={styles.metricLabel}>Key answers</Text>
          </View>
          <View style={[styles.metric, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
            <Text style={styles.metricValue}>{examScans.length}</Text>
            <Text style={styles.metricLabel}>Scans saved</Text>
          </View>
          <View style={[styles.metric, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
            <Text style={styles.metricValue}>{exam.passing_score}%</Text>
            <Text style={styles.metricLabel}>Passing score</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Exam Tools</Text>
        <View style={styles.actionGrid}>
          {actions.map(({ title, detail, icon: Icon, color, onPress }) => (
            <TouchableOpacity key={title} style={styles.actionCard} onPress={onPress}>
              <View style={[styles.actionIcon, { backgroundColor: color }]}>
                <Icon size={22} color="#FFFFFF" strokeWidth={2.4} />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>{title}</Text>
                <Text style={styles.actionDetail}>{detail}</Text>
              </View>
              <ChevronRight size={19} color="#64748B" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.resultsBand}>
          <BarChart3 size={24} color="#4F46E5" />
          <View style={styles.resultsCopy}>
            <Text style={styles.resultsTitle}>Results and Analytics</Text>
            <Text style={styles.resultsDetail}>Review saved scans and item analysis when ready.</Text>
          </View>
          <TouchableOpacity style={styles.resultsBtn} onPress={() => router.push(`/exams/${exam.id}/analytics`)}>
            <Text style={styles.resultsLink}>View Results</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 1040, alignSelf: 'center', padding: 20, paddingBottom: 60 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyTitle: { color: '#0F172A', fontSize: 20, fontWeight: '800' },
  emptyText: { color: '#64748B', fontSize: 13, marginTop: 8, marginBottom: 20, textAlign: 'center' },
  primaryButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 3.5,
    borderBottomColor: '#3730A3',
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  breadcrumbRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  breadcrumbLink: { color: '#4F46E5', fontSize: 13, fontWeight: '800' },
  breadcrumbCurrent: { color: '#64748B', fontSize: 13, flex: 1, fontWeight: '600' },
  examHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20 },
  examHeading: { flex: 1 },
  examTitle: { color: '#0F172A', fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  examDescription: { color: '#64748B', fontSize: 13, marginTop: 4, fontWeight: '600' },
  itemBadge: {
    minWidth: 68,
    padding: 10,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    shadowColor: '#8CA0BA',
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  itemBadgeValue: { color: '#4F46E5', fontSize: 20, fontWeight: '800' },
  itemBadgeLabel: { color: '#64748B', fontSize: 10, fontWeight: '700' },
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  metric: {
    flex: 1,
    minHeight: 82,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 14,
    shadowColor: '#8CA0BA',
    shadowOffset: { width: 3, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  metricValue: { color: '#0F172A', fontSize: 22, fontWeight: '800' },
  metricLabel: { color: '#475569', fontSize: 11, fontWeight: '700', marginTop: 4 },
  sectionTitle: { color: '#0F172A', fontSize: 18, fontWeight: '800', marginBottom: 14, letterSpacing: -0.3 },
  actionGrid: { gap: 12 },
  actionCard: {
    ...ClayCardStyle,
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
  },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  actionCopy: { flex: 1 },
  actionTitle: { color: '#0F172A', fontSize: 15, fontWeight: '800' },
  actionDetail: { color: '#64748B', fontSize: 12, marginTop: 2, fontWeight: '600' },
  resultsBand: {
    ...ClayCardStyle,
    marginTop: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultsCopy: { flex: 1 },
  resultsTitle: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
  resultsDetail: { color: '#64748B', fontSize: 11, marginTop: 2 },
  resultsBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
  },
  resultsLink: { color: '#4F46E5', fontSize: 12, fontWeight: '800' },
});
