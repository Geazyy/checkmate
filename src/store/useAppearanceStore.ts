import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { rawStorage } from './storage';

export type AppearanceMode = 'light' | 'dark';

// Device preference remains available on the login screen and across accounts.
export const useAppearanceStore = create<{
  mode: AppearanceMode;
  setMode: (mode: AppearanceMode) => void;
}>()(persist((set) => ({
  mode: 'light',
  setMode: (mode) => set({ mode }),
}), {
  name: 'checkmate-appearance-v1',
  storage: createJSONStorage(() => rawStorage),
  partialize: ({ mode }) => ({ mode }),
  merge: (saved, current) => ({
    ...current,
    mode: (saved as { mode?: unknown } | undefined)?.mode === 'dark' ? 'dark' : 'light',
  }),
}));
