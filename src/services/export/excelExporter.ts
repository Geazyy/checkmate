import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { ClassExamAnalytics, Exam, ScanResult } from '../../types';

export async function exportExamResultsToExcel(
  exam: Exam,
  analytics: ClassExamAnalytics,
  scans: ScanResult[]
): Promise<string | null> {
  try {
    // Sheet 1: Student Roster Scores
    const studentRows = scans.map((s) => ({
      'Student ID': s.student?.student_number || 'N/A',
      'Last Name': s.student?.last_name || 'Unassigned',
      'First Name': s.student?.first_name || '',
      'Raw Score': s.raw_score,
      'Max Score': s.max_score,
      'Percentage (%)': s.percentage_score,
      'Status': s.percentage_score >= exam.passing_score ? 'PASSED' : 'FAILED',
      'Scanned Date': new Date(s.scanned_at).toLocaleString(),
    }));

    // Sheet 2: Item Analysis Breakdown
    const itemRows = analytics.items.map((item) => ({
      'Question #': item.question_number,
      'Correct Answer': item.correct_option,
      'Difficulty Index (P)': item.difficulty_index,
      'Difficulty Level': item.difficulty_label,
      'Discrimination Index (D)': item.discrimination_index,
      'Discrimination Quality': item.discrimination_label,
      'A Count': item.option_frequencies['A'] || 0,
      'B Count': item.option_frequencies['B'] || 0,
      'C Count': item.option_frequencies['C'] || 0,
      'D Count': item.option_frequencies['D'] || 0,
      'E Count': item.option_frequencies['E'] || 0,
    }));

    // Sheet 3: Class Summary Metrics
    const summaryRows = [
      { Metric: 'Exam Title', Value: exam.title },
      { Metric: 'Total Questions', Value: exam.total_questions },
      { Metric: 'Total Scanned Students', Value: analytics.total_scans },
      { Metric: 'Class Mean Score', Value: analytics.mean_score },
      { Metric: 'Class Median Score', Value: analytics.median_score },
      { Metric: 'Standard Deviation', Value: analytics.std_deviation },
      { Metric: 'Highest Score', Value: analytics.highest_score },
      { Metric: 'Lowest Score', Value: analytics.lowest_score },
      { Metric: 'Passing Rate (%)', Value: `${analytics.passing_rate}%` },
      { Metric: 'KR-20 Reliability Coefficient', Value: analytics.kr20_reliability },
    ];

    // Create workbook and append worksheets
    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    const wsStudents = XLSX.utils.json_to_sheet(studentRows);
    const wsItems = XLSX.utils.json_to_sheet(itemRows);

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Class Summary');
    XLSX.utils.book_append_sheet(wb, wsStudents, 'Student Results');
    XLSX.utils.book_append_sheet(wb, wsItems, 'Item Analysis');

    // Generate base64 output string
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const baseDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
    const fileUri = `${baseDir}${exam.title.replace(/\s+/g, '_')}_Results.xlsx`;

    await FileSystem.writeAsStringAsync(fileUri, wbout, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Export CheckMate Results to Excel',
    });

    return fileUri;
  } catch (error) {
    console.error('Excel Export Error:', error);
    return null;
  }
}
