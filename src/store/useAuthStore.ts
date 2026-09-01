import { create } from 'zustand';
import { UserProfile } from '../types';
import { supabase } from '../services/supabase/client';

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isOnline: boolean;
  setUser: (user: UserProfile | null) => void;
  setOnlineStatus: (status: boolean) => void;
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
  isOnline: true,
  setUser: (user) => set({ user }),
  setOnlineStatus: (isOnline) => set({ isOnline }),
  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },
}));
