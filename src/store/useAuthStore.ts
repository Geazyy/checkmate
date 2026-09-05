import { create } from 'zustand';
import { UserProfile } from '../types';

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  setUser: (user: UserProfile | null) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: {
    id: 'demo-teacher-id',
    email: 'teacher@school.edu',
    full_name: 'Sarah Jenkins',
    institution: 'Westlake High School',
    role: 'teacher',
    created_at: new Date().toISOString(),
  },
  isLoading: false,
  setUser: (user) => set({ user }),
  logout: async () => {
    set({ user: null });
  },
}));
