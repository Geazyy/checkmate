import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { appStorage } from './storage';

interface SettingsState {
  showConfidence: boolean;
  highlightFlagged: boolean;
  setPreference: (key: 'showConfidence' | 'highlightFlagged', value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(persist((set) => ({
  showConfidence: true,
  highlightFlagged: true,
  setPreference: (key, value) => set({ [key]: value }),
}), { name: 'checkmate-settings-v1', skipHydration: true, storage: createJSONStorage(() => appStorage) }));
