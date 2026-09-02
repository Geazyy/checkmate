import { create } from 'zustand';
import { AnswerKeyItem, ClassSection, Exam } from '../types';

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
}

// Initial Mock Data for instant demonstration
const INITIAL_EXAMS: Exam[] = [
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
  },
];

const MOCK_CLASSES: ClassSection[] = [
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

const INITIAL_ANSWER_KEYS = Object.fromEntries(
  INITIAL_EXAMS.map((exam) => [exam.id, createDemoAnswerKeys(exam)])
);

export const useExamStore = create<ExamState>((set) => ({
  exams: INITIAL_EXAMS,
  classes: MOCK_CLASSES,
  activeExam: null,
  activeAnswerKeys: [],
  answerKeysByExamId: INITIAL_ANSWER_KEYS,
  selectedClassId: MOCK_CLASSES[0]?.id ?? null,
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
        ? state.answerKeysByExamId[exam.id] || createDemoAnswerKeys(exam)
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
      exams: [exam, ...state.exams],
      activeExam: exam,
      activeAnswerKeys: keys,
      answerKeysByExamId: { ...state.answerKeysByExamId, [exam.id]: keys },
    })),
}));
