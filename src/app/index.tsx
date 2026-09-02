import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { ArrowRight, BookOpen, CheckCircle2, Plus, ScanLine, Users } from 'lucide-react-native';
import { Href, useRouter } from 'expo-router';
import { AppShell } from '../components/common/AppShell';
import { useExamStore } from '../store/useExamStore';
import { useScanStore } from '../store/useScanStore';

export default function DashboardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { exams, classes, activeExam, setActiveExam, setSelectedClass } = useExamStore();
  const scannedResults = useScanStore((state) => state.scannedResults);
  const wide = width >= 760;
  const gradedCount = scannedResults.filter((scan) => scan.status === 'graded' || scan.status === 'overridden').length;

  const startScan = () => {
    router.push('/scan');
  };

  return (
    <AppShell title="Dashboard">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.introRow}>
          <View style={styles.introCopy}>
            <Text style={styles.eyebrow}>TODAY'S WORKSPACE</Text>
            <Text style={styles.title}>Ready to grade?</Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              Choose an exam, then capture or upload its completed answer sheet.
            </Text>
          </View>
          <TouchableOpacity style={styles.scanPrimary} onPress={startScan}>
            <ScanLine size={20} color="#FFFFFF" />
            <Text style={styles.scanPrimaryText}>Scan sheet</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.quickRow, wide && styles.quickRowWide]}>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/exams')}>
            <View style={styles.quickIconIndigo}><Plus size={19} color="#A5B4FC" /></View>
            <View style={styles.quickCopy}><Text style={styles.quickTitle}>Create exam</Text><Text style={styles.quickSub}>Build a new answer key</Text></View>
            <ArrowRight size={17} color="#64748B" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/rosters')}>
            <View style={styles.quickIconCyan}><Users size={19} color="#67E8F9" /></View>
            <View style={styles.quickCopy}><Text style={styles.quickTitle}>Manage classes</Text><Text style={styles.quickSub}>Review student rosters</Text></View>
            <ArrowRight size={17} color="#64748B" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}><BookOpen size={18} color="#A5B4FC" /><Text style={styles.statValue}>{exams.length}</Text><Text style={styles.statLabel}>Exams</Text></View>
          <View style={styles.statCard}><CheckCircle2 size={18} color="#34D399" /><Text style={styles.statValue}>{gradedCount}</Text><Text style={styles.statLabel}>Graded sheets</Text></View>
          <View style={styles.statCard}><Users size={18} color="#67E8F9" /><Text style={styles.statValue}>{classes.length}</Text><Text style={styles.statLabel}>Classes</Text></View>
        </View>

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>Recent exams</Text><Text style={styles.sectionSub}>Continue setup or start scanning.</Text></View>
          <TouchableOpacity style={styles.textButton} onPress={() => router.push('/exams')}><Text style={styles.textButtonLabel}>View all</Text><ArrowRight size={15} color="#22D3EE" /></TouchableOpacity>
        </View>

        <View style={[styles.examGrid, wide && styles.examGridWide]}>
          {exams.map((exam) => (
            <View key={exam.id} style={[styles.examCard, wide && styles.examCardWide]}>
              <View style={styles.examHeadingRow}>
                <View style={styles.examIcon}><BookOpen size={19} color="#CBD5E1" /></View>
                <Text style={styles.itemCount}>{exam.total_questions} items</Text>
              </View>
              <Text style={styles.examTitle} numberOfLines={2}>{exam.title}</Text>
              <Text style={styles.examSub} numberOfLines={1}>{exam.class_name || exam.description || 'General'}</Text>
              <View style={styles.examFooter}>
                <TouchableOpacity style={styles.openExam} onPress={() => { setActiveExam(exam); router.push(`/exams/${exam.id}` as Href); }}>
                  <Text style={styles.openExamText}>Open workspace</Text><ArrowRight size={15} color="#CBD5E1" />
                </TouchableOpacity>
                <TouchableOpacity accessibilityLabel={`Scan ${exam.title}`} style={styles.iconButton}
                  onPress={() => { setActiveExam(exam); router.push({ pathname: '/scan', params: { examId: exam.id } }); }}>
                  <ScanLine size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Classes</Text><Text style={styles.sectionSub}>Quick access to student lists.</Text></View></View>
        <View style={styles.classList}>
          {classes.map((classSection) => (
            <TouchableOpacity key={classSection.id} style={styles.classRow} onPress={() => { setSelectedClass(classSection.id); router.push('/rosters'); }}>
              <View style={styles.classAvatar}><Text style={styles.classInitial}>{classSection.subject.slice(0, 1)}</Text></View>
              <View style={styles.classCopy}><Text style={styles.className}>{classSection.name}</Text><Text style={styles.classSub}>{classSection.subject} · {classSection.student_count ?? 0} students</Text></View>
              <ArrowRight size={17} color="#64748B" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 1080, alignSelf: 'center', padding: 20, paddingBottom: 32 },
  introRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18 },
  introCopy: { flex: 1 }, eyebrow: { color: '#22D3EE', fontSize: 10, fontWeight: '800' }, title: { color: '#F8FAFC', fontSize: 24, fontWeight: '800', marginTop: 4 },
  subtitle: { color: '#94A3B8', fontSize: 12, lineHeight: 18, marginTop: 5, maxWidth: 520 },
  scanPrimary: { minHeight: 44, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#4F46E5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  scanPrimaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  quickRow: { gap: 9, marginBottom: 12 }, quickRowWide: { flexDirection: 'row' },
  quickAction: { flex: 1, minHeight: 64, backgroundColor: '#182438', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickIconIndigo: { width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(79,70,229,0.18)', alignItems: 'center', justifyContent: 'center' },
  quickIconCyan: { width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(8,145,178,0.16)', alignItems: 'center', justifyContent: 'center' },
  quickCopy: { flex: 1 }, quickTitle: { color: '#E2E8F0', fontSize: 13, fontWeight: '800' }, quickSub: { color: '#64748B', fontSize: 10, marginTop: 3 },
  statsRow: { flexDirection: 'row', gap: 9, marginBottom: 26 },
  statCard: { flex: 1, minHeight: 82, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 11, justifyContent: 'space-between' },
  statValue: { color: '#F8FAFC', fontSize: 19, fontWeight: '800', marginTop: 6 }, statLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 11, marginTop: 3 },
  sectionTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' }, sectionSub: { color: '#64748B', fontSize: 10, marginTop: 3 },
  textButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 4 }, textButtonLabel: { color: '#22D3EE', fontSize: 11, fontWeight: '700' },
  examGrid: { gap: 10, marginBottom: 25 }, examGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  examCard: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 14 }, examCardWide: { width: '49%' },
  examHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, examIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#29364A', alignItems: 'center', justifyContent: 'center' },
  itemCount: { color: '#64748B', fontSize: 9, fontWeight: '700' }, examTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '800', marginTop: 13 }, examSub: { color: '#94A3B8', fontSize: 10, marginTop: 4 },
  examFooter: { flexDirection: 'row', gap: 8, marginTop: 15 }, openExam: { flex: 1, minHeight: 38, borderRadius: 8, backgroundColor: '#29364A', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  openExamText: { color: '#CBD5E1', fontSize: 11, fontWeight: '700' }, iconButton: { width: 40, height: 38, borderRadius: 8, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
  classList: { gap: 8 }, classRow: { minHeight: 62, backgroundColor: '#182438', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  classAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#0E7490', alignItems: 'center', justifyContent: 'center' }, classInitial: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  classCopy: { flex: 1 }, className: { color: '#E2E8F0', fontSize: 12, fontWeight: '800' }, classSub: { color: '#64748B', fontSize: 10, marginTop: 3 },
});
