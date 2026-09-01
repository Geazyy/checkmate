import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { AppHeader } from '../components/common/Header';
import { useExamStore } from '../store/useExamStore';
import { useScanStore } from '../store/useScanStore';

export default function DashboardScreen() {
  const router = useRouter();
  const { exams, classes, setActiveExam, setSelectedClass } = useExamStore();
  const { scannedResults } = useScanStore();

  return (
    <View style={styles.screen}>
      <AppHeader title="CheckMate Dashboard" />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Quick Action Navigation Grid */}
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#4F46E5' }]}
            onPress={() => router.push('/scan')}>
            <Text style={styles.actionIcon}>📸</Text>
            <Text style={styles.actionTitle}>Scan Answers</Text>
            <Text style={styles.actionSub}>Instant OMR Scoring</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#06B6D4' }]}
            onPress={() => router.push('/exams')}>
            <Text style={styles.actionIcon}>📝</Text>
            <Text style={styles.actionTitle}>Create Exam</Text>
            <Text style={styles.actionSub}>Set Answer Key</Text>
          </TouchableOpacity>
        </View>

        {/* Overview Stats Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{exams.length}</Text>
            <Text style={styles.statLbl}>Active Exams</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{scannedResults.length}</Text>
            <Text style={styles.statLbl}>Sheets Graded</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>0.4s</Text>
            <Text style={styles.statLbl}>Avg Scan Speed</Text>
          </View>
        </View>

        {/* Recent Exams Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Exams</Text>
          <TouchableOpacity onPress={() => router.push('/exams')}>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {exams.map((exam) => (
          <TouchableOpacity
            key={exam.id}
            style={styles.examCard}
            onPress={() => router.push(`/exams/${exam.id}/analytics`)}>
            <View style={styles.examCardLeft}>
              <Text style={styles.examTitle}>{exam.title}</Text>
              <Text style={styles.examSub}>
                {exam.class_name} • {exam.total_questions} Questions
              </Text>
            </View>
            <View style={styles.examCardRight}>
              <View style={styles.scoreBadge}>
                <Text style={styles.scoreText}>{exam.average_score}%</Text>
                <Text style={styles.scoreLbl}>Avg Score</Text>
              </View>
              <TouchableOpacity
                accessibilityLabel={`Scan ${exam.title}`}
                style={styles.scanExamButton}
                onPress={() => {
                  setActiveExam(exam);
                  router.push('/scan');
                }}>
                <Camera size={14} color="#FFFFFF" />
                <Text style={styles.scanExamText}>Scan</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}

        {/* Roster / Class Summary */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Class Sections</Text>
        </View>

        {classes.map((cls) => (
          <View key={cls.id} style={styles.classCard}>
            <View>
              <Text style={styles.className}>{cls.name}</Text>
              <Text style={styles.classSub}>
                {cls.subject} • {cls.student_count} Students
              </Text>
            </View>
            <TouchableOpacity
              style={styles.manageBtn}
              onPress={() => {
                setSelectedClass(cls.id);
                router.push('/rosters');
              }}>
              <Text style={styles.manageBtnText}>Roster</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 20,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    borderRadius: 20,
    padding: 18,
    elevation: 4,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  actionSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statVal: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  statLbl: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  seeAllText: {
    color: '#06B6D4',
    fontSize: 12,
    fontWeight: '600',
  },
  examCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  examCardLeft: {
    flex: 1,
  },
  examTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  examSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 4,
  },
  examCardRight: {
    marginLeft: 10,
    gap: 8,
  },
  scanExamButton: {
    minHeight: 32,
    borderRadius: 8,
    backgroundColor: '#4F46E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
  },
  scanExamText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  scoreBadge: {
    backgroundColor: 'rgba(79, 70, 229, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
  },
  scoreText: {
    color: '#818CF8',
    fontSize: 13,
    fontWeight: '700',
  },
  scoreLbl: {
    color: '#94A3B8',
    fontSize: 9,
  },
  classCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  className: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  classSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  manageBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  manageBtnText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '600',
  },
});
