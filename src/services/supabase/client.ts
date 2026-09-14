import 'expo-sqlite/localStorage/install';
import { createClient, processLock } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { Database } from './database.types';
import { boundedFetch } from './network';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
export const cloudConfigured = /^https:\/\/[^/]+/.test(url) && key.startsWith('sb_publishable_');
const memory = new Map<string, string>();
const preferenceKey = 'checkmate-remember-session';
let remember = globalThis.localStorage?.getItem(preferenceKey) !== 'false';
export function rememberSession(value: boolean) {
  if (remember !== value) {
    const verifier = authStorage.getItem('checkmate-auth-v1-code-verifier');
    authStorage.removeItem('checkmate-auth-v1');
    remember = value;
    if (verifier) authStorage.setItem('checkmate-auth-v1-code-verifier', verifier);
  }
  remember = value;
  globalThis.localStorage?.setItem(preferenceKey, String(value));
}
const authStorage = {
  getItem: (name: string) => remember || name.endsWith('-code-verifier') ? globalThis.localStorage?.getItem(name) ?? null
    : Platform.OS === 'web' ? globalThis.sessionStorage?.getItem(name) ?? null : memory.get(name) ?? null,
  setItem: (name: string, value: string) => {
    if (remember || name.endsWith('-code-verifier')) globalThis.localStorage?.setItem(name, value);
    else {
      globalThis.localStorage?.removeItem(name);
      if (Platform.OS === 'web') globalThis.sessionStorage?.setItem(name, value);
      else memory.set(name, value);
    }
  },
  removeItem: (name: string) => {
    globalThis.localStorage?.removeItem(name);
    if (Platform.OS === 'web') globalThis.sessionStorage?.removeItem(name);
    memory.delete(name);
  },
};
export const supabase = cloudConfigured ? createClient<Database>(url, key, {
  global: { fetch: boundedFetch },
  auth: { storage: authStorage, storageKey: 'checkmate-auth-v1', persistSession: true,
    autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce', lock: processLock },
}) : null;
export function requireSupabase() {
  if (!supabase) throw new Error('configuration_missing');
  return supabase;
}
export async function checkCloudConnection() {
  if (!supabase) return false;
  const { error } = await supabase.from('profiles').select('id').limit(1);
  return !error;
}
