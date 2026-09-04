// CheckMate Core TypeScript Data Models

export type UserRole = 'teacher' | 'instructor' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  institution?: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
}

export interface ClassSection {
  id: string;
  teacher_id: string;
  name: string;
  subject: string;
  academic_year: string;
  created_at: string;
  student_count?: number;
}

export interface Student {
  id: string;
  teacher_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  email?: string;
  created_at: string;
}

export type QuestionCount = 10 | 20 | 25 | 30 | 40 | 50 | 100;
export type OptionCount = 4 | 5;
export type ExamStatus = 'draft' | 'ready' | 'in_progress' | 'completed' | 'archived';

export interface Exam {
  id: string;
  teacher_id: string;
  class_id?: string;
  title: string;
  description?: string;
  total_questions: QuestionCount;
  options_per_question: OptionCount;
  passing_score: number;
  status?: ExamStatus;
  sheet_code?: string;
  archived_at?: string;
  created_at: string;
  updated_at: string;
  class_name?: string;
  scanned_count?: number;
  average_score?: number;
}

export interface AnswerKeyItem {
  id?: string;
  exam_id: string;
  question_number: number;
  correct_options: string[]; // e.g. ['A'] or ['A', 'C']
  points: number;
}

export type ScanStatus = 'graded' | 'flagged_manual' | 'overridden';

export interface ScanResult {
  id: string;
  exam_id: string;
  student_id?: string;
  raw_score: number;
  max_score: number;
  percentage_score: number;
  status: ScanStatus;
  cropped_sheet_image_url?: string;
  scanned_at: string;
  synced_at?: string;
  student?: Student;
  items?: ScanItemDetail[];
}

export interface ScanItemDetail {
  id?: string;
  scan_result_id?: string;
  question_number: number;
  detected_options: string[];
  is_correct: boolean;
  is_ambiguous: boolean;
  fill_ratios: Record<string, number>; // e.g. { A: 0.05, B: 0.82, C: 0.01, D: 0.03 }
  detection_status?: AnswerDetectionStatus;
  confidence?: number;
  source_region?: NormalizedRegion;
}

// Analytics Models
export interface QuestionItemAnalysis {
  question_number: number;
  correct_option: string;
  correct_count: number;
  total_responses: number;
  difficulty_index: number; // 0.0 to 1.0
  difficulty_label: 'Very Hard' | 'Hard' | 'Moderate' | 'Easy' | 'Very Easy';
  discrimination_index: number; // -1.0 to +1.0
  discrimination_label: 'Flawed' | 'Poor' | 'Acceptable' | 'Good' | 'Excellent';
  option_frequencies: Record<string, number>; // How many students picked A, B, C, D
}

export interface ClassExamAnalytics {
  exam_id: string;
  total_scans: number;
  mean_score: number;
  median_score: number;
  std_deviation: number;
  highest_score: number;
  lowest_score: number;
  passing_rate: number; // percentage
  kr20_reliability: number; // Kuder-Richardson 20 (0.0 - 1.0)
  items: QuestionItemAnalysis[];
  score_histogram: { range: string; count: number }[];
}

// OMR Processing Payload
export interface Point2D {
  x: number;
  y: number;
}

export interface FiducialAnchors {
  topLeft: Point2D;
  topRight: Point2D;
  bottomLeft: Point2D;
  bottomRight: Point2D;
}

export interface OMRGridConfig {
  totalQuestions: number;
  optionsCount: number;
  columns: number; // e.g., 2 columns for 50 questions
  rowsPerColumn: number;
}

export type AnswerDetectionStatus = 'detected' | 'blank' | 'multiple' | 'uncertain';

export interface NormalizedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BubbleAnalysisResult {
  questionNumber: number;
  detectedOptions: string[];
  fillRatios: Record<string, number>;
  isAmbiguous: boolean;
  status: AnswerDetectionStatus;
  confidence: number;
  sourceRegion: NormalizedRegion;
}

export interface LocalScanQueueItem {
  local_id: string;
  exam_id: string;
  student_id?: string;
  raw_score: number;
  max_score: number;
  percentage_score: number;
  items_json: string;
  scanned_at: string;
  is_synced: boolean;
}
