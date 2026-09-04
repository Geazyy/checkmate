import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ScanResult } from '../types';
import { appStorage } from './storage';

interface ScanState {
  isScanning: boolean;
  isAligned: boolean;
  torchEnabled: boolean;
  lastScannedResult: ScanResult | null;
  scannedResults: ScanResult[];
  pendingSyncCount: number;
  setIsScanning: (isScanning: boolean) => void;
  setIsAligned: (isAligned: boolean) => void;
  setTorchEnabled: (torchEnabled: boolean) => void;
  setLastScannedResult: (result: ScanResult | null) => void;
  addScannedResult: (result: ScanResult) => void;
  confirmLastScannedResult: () => void;
  clearLastScannedResult: () => void;
  updateResultItemOption: (scanId: string, questionNumber: number, options: string[]) => void;
  removeExamResults: (examId: string) => void;
  setPendingSyncCount: (count: number) => void;
}

// Initial Mock Scans for demonstration
const MOCK_SCANS: ScanResult[] = [
  {
    id: 'scan-1',
    exam_id: 'exam-101',
    raw_score: 45,
    max_score: 50,
    percentage_score: 90.0,
    status: 'graded',
    scanned_at: new Date().toISOString(),
    student: {
      id: 'stud-101',
      teacher_id: 'demo-teacher-id',
      student_number: '2026-001',
      first_name: 'Alex',
      last_name: 'Rivera',
      email: 'arivera@student.edu',
      created_at: new Date().toISOString(),
    },
    items: Array.from({ length: 50 }, (_, i) => ({
      question_number: i + 1,
      detected_options: [i % 4 === 0 ? 'A' : i % 4 === 1 ? 'B' : i % 4 === 2 ? 'C' : 'D'],
      is_correct: i < 45,
      is_ambiguous: i === 12,
      fill_ratios: { A: 0.85, B: 0.02, C: 0.04, D: 0.01 },
    })),
  },
  {
    id: 'scan-2',
    exam_id: 'exam-101',
    raw_score: 38,
    max_score: 50,
    percentage_score: 76.0,
    status: 'graded',
    scanned_at: new Date().toISOString(),
    student: {
      id: 'stud-102',
      teacher_id: 'demo-teacher-id',
      student_number: '2026-002',
      first_name: 'Marcus',
      last_name: 'Vance',
      email: 'mvance@student.edu',
      created_at: new Date().toISOString(),
    },
    items: Array.from({ length: 50 }, (_, i) => ({
      question_number: i + 1,
      detected_options: [i % 4 === 0 ? 'A' : i % 4 === 1 ? 'B' : i % 4 === 2 ? 'C' : 'D'],
      is_correct: i < 38,
      is_ambiguous: false,
      fill_ratios: { A: 0.02, B: 0.91, C: 0.01, D: 0.05 },
    })),
  },
];

export const useScanStore = create<ScanState>()(persist((set) => ({
  isScanning: false,
  isAligned: false,
  torchEnabled: false,
  lastScannedResult: null,
  scannedResults: MOCK_SCANS,
  pendingSyncCount: 0,
  setIsScanning: (isScanning) => set({ isScanning }),
  setIsAligned: (isAligned) => set({ isAligned }),
  setTorchEnabled: (torchEnabled) => set({ torchEnabled }),
  setLastScannedResult: (result) => set({ lastScannedResult: result }),
  addScannedResult: (result) =>
    set((state) => ({
      scannedResults: [result, ...state.scannedResults],
      lastScannedResult: result,
    })),
  confirmLastScannedResult: () =>
    set((state) => {
      if (!state.lastScannedResult) return {};

      return {
        scannedResults: [
          state.lastScannedResult,
          ...state.scannedResults.filter((scan) => scan.id !== state.lastScannedResult?.id),
        ],
        lastScannedResult: null,
      };
    }),
  clearLastScannedResult: () => set({ lastScannedResult: null }),
  updateResultItemOption: (scanId, questionNumber, options) =>
    set((state) => {
      const updateScan = (scan: ScanResult) => {
        if (scan.id !== scanId || !scan.items) return scan;
        const updatedItems = scan.items.map((it) =>
          it.question_number === questionNumber ? { ...it, detected_options: options } : it
        );
        return { ...scan, items: updatedItems, status: 'overridden' as const };
      };

      return {
        scannedResults: state.scannedResults.map(updateScan),
        lastScannedResult: state.lastScannedResult
          ? updateScan(state.lastScannedResult)
          : null,
      };
    }),
  removeExamResults: (examId) =>
    set((state) => ({
      scannedResults: state.scannedResults.filter((scan) => scan.exam_id !== examId),
      lastScannedResult: state.lastScannedResult?.exam_id === examId ? null : state.lastScannedResult,
    })),
  setPendingSyncCount: (pendingSyncCount) => set({ pendingSyncCount }),
}), {
  name: 'checkmate-scans-v1',
  storage: createJSONStorage(() => appStorage),
  partialize: (state) => ({ scannedResults: state.scannedResults, pendingSyncCount: state.pendingSyncCount }),
}));
