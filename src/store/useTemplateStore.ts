import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AnswerSheetConfig } from '../services/omr/sheetLayout';
import { appStorage } from './storage';
export const useTemplateStore = create<{
 templates: Partial<Record<string, AnswerSheetConfig>>; saveTemplate: (id: string, config: AnswerSheetConfig) => void;
}>()(persist(set => ({ templates: {}, saveTemplate: (id, config) => set(s => ({ templates: { ...s.templates, [id]: config } })) }),
 { name: 'checkmate-templates-v1', skipHydration: true, storage: createJSONStorage(() => appStorage) }));
