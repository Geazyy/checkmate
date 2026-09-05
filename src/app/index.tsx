import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { ArrowRight, BookOpen, CheckCircle2, Plus, ScanLine, Users } from 'lucide-react-native';
import { Href, useRouter } from 'expo-router';
import { AppShell } from '../components/common/AppShell';
import { useExamStore } from '../store/useExamStore';
import { useScanStore } from '../store/useScanStore';
import { ClayCardStyle, ClayColors } from '../constants/theme';

export default function DashboardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { exams, classes, setActiveExam, setSelectedClass } = useExamStore();
  const scannedResults = useScanStore((state) => state.scannedResults);
  const wide = width >= 760;
  const gradedCount = scannedResults.filter((scan) => scan.status === 'graded' || scan.status === 'overridden').length;
  const activeExams = exams.filter((exam) => exam.status !== 'archived' && !exam.archived_at);

  const startScan = () => {
    router.push('/scan');
  };

  return (
    <AppShell title="Dashboard">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introRow}>
          <View style={styles.introCopy}>
            <View style={styles.eyebrowChip}>
              <Text style={styles.eyebrow}>OFFLINE OMR WORKSPACE</Text>
            </View>
            <Text style={styles.title}>Ready to grade?</Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              Choose an exam, then capture or upload its completed answer sheet.
            </Text>
          </View>
          <TouchableOpacity style={styles.scanPrimary} onPress={startScan}>
            <ScanLine size={20} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.scanPrimaryText}>Scan sheet</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.quickRow, wide && styles.quickRowWide]}>
          <TouchableOpacity style={[styles.quickAction, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]} onPress={() => router.push('/exams')}>
            <View style={[styles.quickIcon, { backgroundColor: '#4F46E5' }]}>
              <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
            </View>
            <View style={styles.quickCopy}>
              <Text style={styles.quickTitle}>Create Exam</Text>
              <Text style={styles.quickSub}>Build a new answer key</Text>
            </View>
            <ArrowRight size={18} color="#4F46E5" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.quickAction, { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' }]} onPress={() => router.push('/rosters')}>
            <View style={[styles.quickIcon, { backgroundColor: '#0284C7' }]}>
              <Users size={20} color="#FFFFFF" strokeWidth={2.5} />
            </View>
            <View style={styles.quickCopy}>
              <Text style={styles.quickTitle}>Manage Classes</Text>
              <Text style={styles.quickSub}>Review student rosters</Text>
            </View>
            <ArrowRight size={18} color="#0284C7" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}>
            <View style={[styles.statIconBadge, { backgroundColor: '#4F46E5' }]}>
              <BookOpen size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.statValue}>{activeExams.length}</Text>
            <Text style={styles.statLabel}>Exams</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
            <View style={[styles.statIconBadge, { backgroundColor: '#10B981' }]}>
              <CheckCircle2 size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.statValue}>{gradedCount}</Text>
            <Text style={styles.statLabel}>Graded sheets</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' }]}>
            <View style={[styles.statIconBadge, { backgroundColor: '#0284C7' }]}>
              <Users size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.statValue}>{classes.length}</Text>
            <Text style={styles.statLabel}>Classes</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Recent Exams</Text>
            <Text style={styles.sectionSub}>Continue setup or start scanning.</Text>
          </View>
          <TouchableOpacity style={styles.textButton} onPress={() => router.push('/exams')}>
            <Text style={styles.textButtonLabel}>View all</Text>
            <ArrowRight size={15} color="#4F46E5" />
          </TouchableOpacity>
        </View>

        <View style={[styles.examGrid, wide && styles.examGridWide]}>
          {activeExams.map((exam) => (
            <View key={exam.id} style={[styles.examCard, wide && styles.examCardWide]}>
              <View style={styles.examHeadingRow}>
                <View style={styles.examIconBadge}>
                  <BookOpen size={18} color="#4F46E5" />
                </View>
                <View style={styles.itemBadge}>
                  <Text style={styles.itemCount}>{exam.total_questions} items</Text>
                </View>
              </View>
              <Text style={styles.examTitle} numberOfLines={2}>{exam.title}</Text>
              <Text style={styles.examSub} numberOfLines={1}>{exam.class_name || exam.description || 'General'}</Text>
              <View style={styles.examFooter}>
                <TouchableOpacity
                  style={styles.openExam}
                  onPress={() => {
                    setActiveExam(exam);
                    router.push(`/exams/${exam.id}` as Href);
                  }}>
                  <Text style={styles.openExamText}>Open workspace</Text>
                  <ArrowRight size={15} color="#4F46E5" />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel={`Scan ${exam.title}`}
                  style={styles.iconButton}
                  onPress={() => {
                    setActiveExam(exam);
                    router.push({ pathname: '/scan', params: { examId: exam.id } });
                  }}>
                  <ScanLine size={18} color="#FFFFFF" strokeWidth={2.4} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Classes & Rosters</Text>
            <Text style={styles.sectionSub}>Quick access to student lists.</Text>
          </View>
        </View>
        <View style={styles.classList}>
          {classes.map((classSection) => (
            <TouchableOpacity
              key={classSection.id}
              style={styles.classRow}
              onPress={() => {
                setSelectedClass(classSection.id);
                router.push('/rosters');
              }}>
              <View style={styles.classAvatar}>
                <Text style={styles.classInitial}>{classSection.subject.slice(0, 1)}</Text>
              </View>
              <View style={styles.classCopy}>
                <Text style={styles.className}>{classSection.name}</Text>
                <Text style={styles.classSub}>{classSection.subject} · {classSection.student_count ?? 0} students</Text>
              </View>
              <ArrowRight size={18} color="#64748B" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 1080, alignSelf: 'center', padding: 20, paddingBottom: 40 },
  introRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20 },
  introCopy: { flex: 1 },
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
  title: { color: '#0F172A', fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { color: '#64748B', fontSize: 13, lineHeight: 19, marginTop: 4, maxWidth: 520 },
  scanPrimary: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: '#4F46E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 4,
    borderBottomColor: '#3730A3',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  scanPrimaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  quickRow: { gap: 12, marginBottom: 16 },
  quickRowWide: { flexDirection: 'row' },
  quickAction: {
    flex: 1,
    minHeight: 70,
    borderRadius: 20,
    borderWidth: 2,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#8CA0BA',
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '4px 4px 12px rgba(160, 175, 195, 0.3), -3px -3px 10px rgba(255, 255, 255, 0.9)',
        } as any)
      : {}),
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
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
  quickCopy: { flex: 1 },
  quickTitle: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
  quickSub: { color: '#64748B', fontSize: 11, fontWeight: '600', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  statCard: {
    flex: 1,
    minHeight: 105,
    borderRadius: 22,
    borderWidth: 2,
    padding: 14,
    justifyContent: 'space-between',
    shadowColor: '#8CA0BA',
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '5px 5px 14px rgba(160, 175, 195, 0.35), -4px -4px 10px rgba(255, 255, 255, 0.9)',
        } as any)
      : {}),
  },
  statIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { color: '#0F172A', fontSize: 24, fontWeight: '800', marginTop: 8 },
  statLabel: { color: '#475569', fontSize: 11, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 14, marginTop: 6 },
  sectionTitle: { color: '#0F172A', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { color: '#64748B', fontSize: 11, marginTop: 2 },
  textButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 4 },
  textButtonLabel: { color: '#4F46E5', fontSize: 12, fontWeight: '800' },
  examGrid: { gap: 14, marginBottom: 30 },
  examGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  examCard: {
    ...ClayCardStyle,
    padding: 18,
  },
  examCardWide: { width: '49%' },
  examHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  examIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemCount: { color: '#64748B', fontSize: 10, fontWeight: '800' },
  examTitle: { color: '#0F172A', fontSize: 16, fontWeight: '800', marginTop: 14 },
  examSub: { color: '#64748B', fontSize: 11, fontWeight: '600', marginTop: 3 },
  examFooter: { flexDirection: 'row', gap: 10, marginTop: 18 },
  openExam: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  openExamText: { color: '#4F46E5', fontSize: 12, fontWeight: '800' },
  iconButton: {
    width: 44,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
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
  classList: { gap: 10 },
  classRow: {
    ...ClayCardStyle,
    minHeight: 66,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  classAvatar: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  classInitial: { color: '#0284C7', fontSize: 16, fontWeight: '800' },
  classCopy: { flex: 1 },
  className: { color: '#0F172A', fontSize: 13, fontWeight: '800' },
  classSub: { color: '#64748B', fontSize: 11, marginTop: 2 },
});
