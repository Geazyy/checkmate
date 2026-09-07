import { ActionButton as TouchableOpacity } from '../../../components/common/Controls';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader } from '../../../components/common/Header';
import { ScoreHistogram } from '../../../components/analytics/ScoreHistogram';
import { ItemAnalysisTable } from '../../../components/analytics/ItemAnalysisTable';
import { useExamStore } from '../../../store/useExamStore';
import { useScanStore } from '../../../store/useScanStore';
import { calculateExamAnalytics } from '../../../services/analytics/itemAnalysis';
import { generateClassReportPDF } from '../../../services/export/pdfGenerator';
import { exportExamResultsToExcel } from '../../../services/export/excelExporter';
import { ClayButtonStyle, ClayCardStyle, ClayColors } from '../../../constants/theme';

export default function AnalyticsDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { exams, setActiveExam } = useExamStore();
  const { scannedResults } = useScanStore();

  const exam = useMemo(() => exams.find((e) => e.id === id) || exams[0], [exams, id]);

  const analytics = useMemo(() => {
    return calculateExamAnalytics(exam.id, exam.total_questions, scannedResults);
  }, [exam, scannedResults]);

  const handleExportPDF = async () => {
    await generateClassReportPDF(exam, analytics, scannedResults);
  };

  const handleExportExcel = async () => {
    await exportExamResultsToExcel(exam, analytics, scannedResults);
  };

  const handlePrintSheet = () => {
    setActiveExam(exam);
    router.push('/answer-sheets' as Href);
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="Exam Analytics" />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Exam Title & Action Bar */}
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.examTitle}>{exam.title}</Text>
            <Text style={styles.examSub}>
              {exam.class_name || 'All Sections'} • {analytics.total_scans} Scanned Sheets
            </Text>
          </View>

          <TouchableOpacity style={styles.scanNowBtn} onPress={() => router.push('/scan')}>
            <Text style={styles.scanNowText}>📷 Scan</Text>
          </TouchableOpacity>
        </View>

        {/* Key Metrics Dashboard Row */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricVal}>{analytics.mean_score}</Text>
            <Text style={styles.metricLbl}>Class Mean</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={[styles.metricVal, { color: ClayColors.success }]}>{analytics.passing_rate}%</Text>
            <Text style={styles.metricLbl}>Pass Rate</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={[styles.metricVal, { color: ClayColors.accent }]}>
              {analytics.kr20_reliability}
            </Text>
            <Text style={styles.metricLbl}>KR-20 Reliability</Text>
          </View>
        </View>

        {/* Export Buttons Bar */}
        <View style={styles.exportBar}>
          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: '#334155' }]}
            onPress={handlePrintSheet}>
            <Text style={styles.exportBtnText}>Print OMR Sheet</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: ClayColors.primary }]}
            onPress={handleExportPDF}>
            <Text style={styles.exportBtnText}>📕 Export PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: ClayColors.success }]}
            onPress={handleExportExcel}>
            <Text style={styles.exportBtnText}>📊 Export Excel</Text>
          </TouchableOpacity>
        </View>

        {/* Score Distribution Chart */}
        <ScoreHistogram data={analytics.score_histogram} />

        {/* Item Analysis Breakdown Table */}
        <ItemAnalysisTable items={analytics.items} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ClayColors.bg,
  },
  content: {
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  examTitle: {
    color: ClayColors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  examSub: {
    color: ClayColors.textSecondary,
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  scanNowBtn: {
    ...ClayButtonStyle,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
  },
  scanNowText: {
    color: ClayColors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    ...ClayCardStyle,
    flex: 1,
    padding: 14,
    alignItems: 'center',
  },
  metricVal: {
    color: ClayColors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  metricLbl: {
    color: ClayColors.textSecondary,
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  exportBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  exportBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 3,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  exportBtnText: {
    color: ClayColors.onPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
});
