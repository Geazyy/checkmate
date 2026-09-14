import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AnswerKeyItem, ClassSection, Exam } from '../types';
import { appStorage, currentOwner } from './storage';
import { randomUUID } from 'expo-crypto';

interface ExamState {
  exams: Exam[];
  classes: ClassSection[];
  activeExam: Exam | null;
  activeAnswerKeys: AnswerKeyItem[];
  answerKeysByExamId: Record<string, AnswerKeyItem[]>;
  selectedClassId: string | null;
  setExams: (exams: Exam[]) => void;
  setClasses: (classes: ClassSection[]) => void;
  addClass: (classSection: ClassSection) => void;
  setActiveExam: (exam: Exam | null) => void;
  setActiveAnswerKeys: (keys: AnswerKeyItem[]) => void;
  setSelectedClass: (id: string | null) => void;
  updateAnswerKeyOption: (questionNumber: number, options: string[]) => void;
  addExam: (exam: Exam, keys: AnswerKeyItem[]) => void;
  updateExam: (examId: string, updates: Partial<Exam>) => void;
  duplicateExam: (examId: string) => Exam | null;
  archiveExam: (examId: string) => void;
  restoreExam: (examId: string) => void;
  deleteExam: (examId: string) => void;
}

// Initial Mock Data for instant demonstration
export const LEGACY_DEMO_EXAMS: Exam[] = [
  {
    id: 'exam-101',
    teacher_id: 'demo-teacher-id',
    title: 'Physics 101 Midterm Exam',
    description: 'Mechanics, Newton Laws, and Kinematics',
    total_questions: 50,
    options_per_question: 4,
    passing_score: 60,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    scanned_count: 28,
    average_score: 82.4,
    class_name: 'Physics 101 - Sec A',
    status: 'in_progress',
  },
  {
    id: 'exam-102',
    teacher_id: 'demo-teacher-id',
    title: 'Chemistry Quiz 3',
    description: 'Periodic Table & Chemical Bonding',
    total_questions: 25,
    options_per_question: 4,
    passing_score: 70,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    scanned_count: 32,
    average_score: 76.0,
    class_name: 'Chem 202 - Sec B',
    status: 'in_progress',
  },
];

export const LEGACY_DEMO_CLASSES: ClassSection[] = [
  {
    id: 'class-1',
    teacher_id: 'demo-teacher-id',
    name: 'Physics 101 - Sec A',
    subject: 'Physics',
    academic_year: '2026-2027',
    created_at: new Date().toISOString(),
    student_count: 30,
  },
  {
    id: 'class-2',
    teacher_id: 'demo-teacher-id',
    name: 'Chem 202 - Sec B',
    subject: 'Chemistry',
    academic_year: '2026-2027',
    created_at: new Date().toISOString(),
    student_count: 35,
  },
];

const createDemoAnswerKeys = (exam: Exam): AnswerKeyItem[] =>
  Array.from({ length: exam.total_questions }, (_, i) => ({
    exam_id: exam.id,
    question_number: i + 1,
    correct_options: [i % 4 === 0 ? 'A' : i % 4 === 1 ? 'B' : i % 4 === 2 ? 'C' : 'D'],
    points: 1.0,
  }));

const createBlankAnswerKeys = (examId: string, count: number): AnswerKeyItem[] =>
  Array.from({ length: count }, (_, i) => ({
    exam_id: examId,
    question_number: i + 1,
    correct_options: [],
    points: 1,
  }));

const resizeAnswerKeys = (keys: AnswerKeyItem[], examId: string, count: number, optionCount = 5) => {
  const existing = new Map(keys.map((key) => [key.question_number, key]));
  return createBlankAnswerKeys(examId, count).map((blank) => {
    const saved = existing.get(blank.question_number);
    return saved
      ? { ...saved, correct_options: saved.correct_options.filter((option) => option.charCodeAt(0) - 64 <= optionCount) }
      : blank;
  });
};

export const LEGACY_DEMO_ANSWER_KEYS = Object.fromEntries(
  LEGACY_DEMO_EXAMS.map((exam) => [exam.id, createDemoAnswerKeys(exam)])
);

export const useExamStore = create<ExamState>()(persist((set, get) => ({
  exams: [],
  classes: [],
  activeExam: null,
  activeAnswerKeys: [],
  answerKeysByExamId: {},
  selectedClassId: null,
  setExams: (exams) => set({ exams }),
  setClasses: (classes) => set({ classes }),
  addClass: (classSection) =>
    set((state) => ({
      classes: [classSection, ...state.classes],
      selectedClassId: classSection.id,
    })),
  setActiveExam: (exam) =>
    set((state) => ({
      activeExam: exam,
      activeAnswerKeys: exam
        ? state.answerKeysByExamId[exam.id] || createBlankAnswerKeys(exam.id, exam.total_questions)
        : [],
    })),
  setActiveAnswerKeys: (keys) =>
    set((state) => {
      const examId = state.activeExam?.id || keys[0]?.exam_id;
      return {
        activeAnswerKeys: keys,
        answerKeysByExamId: examId
          ? { ...state.answerKeysByExamId, [examId]: keys }
          : state.answerKeysByExamId,
      };
    }),
  setSelectedClass: (id) => set({ selectedClassId: id }),
  updateAnswerKeyOption: (questionNumber, options) =>
    set((state) => {
      const activeAnswerKeys = state.activeAnswerKeys.map((k) =>
        k.question_number === questionNumber ? { ...k, correct_options: options } : k
      );
      return {
        activeAnswerKeys,
        answerKeysByExamId: state.activeExam
          ? { ...state.answerKeysByExamId, [state.activeExam.id]: activeAnswerKeys }
          : state.answerKeysByExamId,
      };
    }),
  addExam: (exam, keys) =>
    set((state) => ({
      exams: [{ ...exam, status: exam.status ?? 'draft' }, ...state.exams],
      activeExam: { ...exam, status: exam.status ?? 'draft' },
      activeAnswerKeys: keys,
      answerKeysByExamId: { ...state.answerKeysByExamId, [exam.id]: keys },
    })),
  updateExam: (examId, updates) =>
    set((state) => {
      const current = state.exams.find((exam) => exam.id === examId);
      if (!current) return {};
      const updatedExam = { ...current, ...updates, id: current.id, updated_at: new Date().toISOString() };
      const currentKeys = state.answerKeysByExamId[examId] ?? [];
      const resizedKeys = resizeAnswerKeys(currentKeys, examId, updatedExam.total_questions, updatedExam.options_per_question);
      return {
        exams: state.exams.map((exam) => exam.id === examId ? updatedExam : exam),
        activeExam: state.activeExam?.id === examId ? updatedExam : state.activeExam,
        activeAnswerKeys: state.activeExam?.id === examId ? resizedKeys : state.activeAnswerKeys,
        answerKeysByExamId: { ...state.answerKeysByExamId, [examId]: resizedKeys },
      };
    }),
  duplicateExam: (examId) => {
    const state = get();
    const source = state.exams.find((exam) => exam.id === examId);
    if (!source) return null;
    const id = randomUUID();
    const now = new Date().toISOString();
    const duplicate: Exam = {
      ...source,
      teacher_id: currentOwner() ?? '',
      id,
      title: `${source.title} (Copy)`,
      status: 'draft',
      archived_at: undefined,
      scanned_count: 0,
      average_score: 0,
      created_at: now,
      updated_at: now,
      sheet_code: source.sheet_code ? `${source.sheet_code}-COPY` : undefined,
    };
    const keys = (state.answerKeysByExamId[examId] ?? []).map((key) => ({ ...key, id: undefined, exam_id: id }));
    set({
      exams: [duplicate, ...state.exams],
      answerKeysByExamId: { ...state.answerKeysByExamId, [id]: resizeAnswerKeys(keys, id, duplicate.total_questions) },
    });
    return duplicate;
  },
  archiveExam: (examId) =>
    set((state) => {
      const archivedAt = new Date().toISOString();
      const exams = state.exams.map((exam) => exam.id === examId
        ? { ...exam, status: 'archived' as const, archived_at: archivedAt, updated_at: archivedAt }
        : exam);
      return {
        exams,
        activeExam: state.activeExam?.id === examId ? null : state.activeExam,
        activeAnswerKeys: state.activeExam?.id === examId ? [] : state.activeAnswerKeys,
      };
    }),
  restoreExam: (examId) =>
    set((state) => ({
      exams: state.exams.map((exam) => {
        if (exam.id !== examId) return exam;
        const completedKeys = (state.answerKeysByExamId[examId] ?? []).filter((key) => key.correct_options.length > 0).length;
        const status = (exam.scanned_count ?? 0) > 0
          ? 'in_progress' as const
          : completedKeys === exam.total_questions ? 'ready' as const : 'draft' as const;
        return { ...exam, status, archived_at: undefined, updated_at: new Date().toISOString() };
      }),
    })),
  deleteExam: (examId) =>
    set((state) => {
      const answerKeysByExamId = { ...state.answerKeysByExamId };
      delete answerKeysByExamId[examId];
      return {
        exams: state.exams.filter((exam) => exam.id !== examId),
        answerKeysByExamId,
        activeExam: state.activeExam?.id === examId ? null : state.activeExam,
        activeAnswerKeys: state.activeExam?.id === examId ? [] : state.activeAnswerKeys,
      };
    }),
}), {
  name: 'checkmate-exams-v1',
  skipHydration: true,
  storage: createJSONStorage(() => appStorage),
  partialize: (state) => ({
    exams: state.exams,
    classes: state.classes,
    answerKeysByExamId: state.answerKeysByExamId,
  }),
}));
