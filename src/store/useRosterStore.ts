import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Student } from '../types';
import { appStorage } from './storage';
export const useRosterStore = create<{
  studentsByClassId: Record<string, Student[]>;
  setStudentsByClassId: (update: (current: Record<string, Student[]>) => Record<string, Student[]>) => void;
}>()(persist(set => ({
  studentsByClassId: {},
  setStudentsByClassId: update => set(s => ({ studentsByClassId: update(s.studentsByClassId) })),
}), { name: 'checkmate-rosters-v1', skipHydration: true, storage: createJSONStorage(() => appStorage) }));
