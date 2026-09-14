import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { UserProfile } from '../types';
import { ProfileRow } from '../services/supabase/database.types';
export const useAuthStore = create<{
 user: UserProfile | null; profile: ProfileRow | null; session: Session | null;
 isLoading: boolean; recovery: boolean; error: string | null;
}>(() => ({ user: null, profile: null, session: null, isLoading: true, recovery: false, error: null }));
