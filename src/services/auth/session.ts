import { AppState, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { Session } from '@supabase/supabase-js';
import { supabase, requireSupabase } from '../supabase/client';
import { ProfileRow } from '../supabase/database.types';
import { rawStorage } from '../../store/storage';
import { useAuthStore } from '../../store/useAuthStore';
import { switchWorkspace } from './workspace';
import { cancelSync, startSync } from '../sync/engine';
import { friendlyAuthError } from './errors';

export const authRedirect = () => process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL || Linking.createURL('auth/callback');
let revision = 0;
let sequence = Promise.resolve();
let stopSync: (() => void) | undefined;
let profileController: AbortController | undefined;
const cacheKey = (id: string) => 'checkmate-profile:' + id;
export function setProfile(profile: ProfileRow | null) {
 const session = useAuthStore.getState().session;
 if (!session) return;
 useAuthStore.setState({ profile, user: {
  id: session.user.id, email: session.user.email ?? '', full_name: profile?.full_name || session.user.user_metadata?.full_name || 'Teacher',
  institution: profile?.school_name, role: profile?.role ?? 'teacher', created_at: session.user.created_at,
 } });
}
export async function refreshProfile() {
 const session = useAuthStore.getState().session;
 if (!session || !supabase) return;
 const owner = session.user.id;
 profileController?.abort();
 const controller = new AbortController();
 profileController = controller;
 const timeout = setTimeout(() => controller.abort(), 12000);
 try {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', owner).abortSignal(controller.signal).single();
  if (error) throw error;
  if (useAuthStore.getState().session?.user.id !== owner || controller.signal.aborted) return;
  await rawStorage.setItem(cacheKey(owner), JSON.stringify(data));
  if (useAuthStore.getState().session?.user.id === owner) setProfile(data);
 } catch {
  if (useAuthStore.getState().session?.user.id === owner) useAuthStore.setState({ error: 'Profile is unavailable online. Your cached workspace is still available.' });
 } finally { clearTimeout(timeout); }
}
function scheduleSession(session: Session | null) {
 const previous = useAuthStore.getState().session;
 if (previous?.user.id === session?.user.id && !useAuthStore.getState().isLoading) {
  useAuthStore.setState({ session });
  if (session) setProfile(useAuthStore.getState().profile);
  return;
 }
 const version = ++revision;
 stopSync?.(); stopSync = undefined; cancelSync(); profileController?.abort();
 useAuthStore.setState({ isLoading: true, session: null, user: null, profile: null });
 sequence = sequence.catch(() => undefined).then(async () => {
  await switchWorkspace(null);
  if (version !== revision) return;
  if (session && (session.expires_at ?? 0) * 1000 > Date.now()) {
   await switchWorkspace(session.user.id);
   if (version !== revision) return;
   const cached = await rawStorage.getItem(cacheKey(session.user.id));
   if (version !== revision) return;
   useAuthStore.setState({ session, error: null });
   setProfile(cached ? JSON.parse(cached) : null);
   if (!useAuthStore.getState().recovery) stopSync = startSync();
   void refreshProfile();
  }
  if (version === revision) useAuthStore.setState({ isLoading: false });
 }).catch(() => {
  if (version === revision) useAuthStore.setState({ isLoading: false, session: null, user: null, error: 'Could not open local storage. Restart CheckMate before continuing.' });
 });
}
const links = new Set<string>();
export async function handleAuthLink(url: string) {
 let parsed: URL;
 try { parsed = new URL(url); } catch { return; }
 const expected = new URL(authRedirect());
 if (parsed.protocol !== expected.protocol || parsed.host !== expected.host || parsed.pathname !== expected.pathname) return;
 const query = parsed.searchParams;
 const code = query.get('code');
 if (!code) {
  useAuthStore.setState({ error: friendlyAuthError({ code: 'otp_expired' }), recovery: false });
  return;
 }
 if (links.has(code)) return;
 links.add(code);
 if (query.get('recovery') === '1') {
  stopSync?.(); stopSync = undefined; cancelSync();
  useAuthStore.setState({ recovery: true });
 }
 try {
  const { data, error } = await requireSupabase().auth.exchangeCodeForSession(code);
  if (error) throw error;
  scheduleSession(data.session);
 } catch (error) {
  useAuthStore.setState({ error: friendlyAuthError(error), recovery: false });
 } finally {
  // Remove the one-use code from browser history; never log callback URLs.
  if (Platform.OS === 'web') globalThis.history?.replaceState({}, '', '/auth/callback');
 }
}
export function startAuthentication() {
 let disposed = false;
 let authEventSeen = false;
 if (!supabase) { scheduleSession(null); return () => { revision++; }; }
 const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
  authEventSeen = true;
  if (event === 'PASSWORD_RECOVERY') {
   stopSync?.(); stopSync = undefined; cancelSync();
   useAuthStore.setState({ recovery: true });
  }
  // Supabase callbacks must not await other Auth APIs under its storage lock.
  setTimeout(() => { if (!disposed) scheduleSession(session); }, 0);
 });
 void supabase.auth.getSession().then(({ data, error }) => {
  if (disposed || authEventSeen) return;
  if (error) useAuthStore.setState({ error: friendlyAuthError(error) });
  scheduleSession(data.session);
 }).catch(error => {
  if (!disposed) { useAuthStore.setState({ error: friendlyAuthError(error) }); scheduleSession(null); }
 });
 const process = (url: string) => { if (!disposed) void handleAuthLink(url); };
 void Linking.getInitialURL().then(url => { if (url) process(url); });
 const linkListener = Linking.addEventListener('url', e => process(e.url));
 const appListener = AppState.addEventListener('change', state => {
  if (state === 'active') supabase?.auth.startAutoRefresh();
  else supabase?.auth.stopAutoRefresh();
 });
 supabase.auth.startAutoRefresh();
 const expiry = setInterval(() => {
  const session = useAuthStore.getState().session;
  if (session && (session.expires_at ?? 0) * 1000 <= Date.now()) {
   useAuthStore.setState({ error: friendlyAuthError({ code: 'session_expired' }) });
   scheduleSession(null);
  }
 }, 10000);
 return () => {
  disposed = true; revision++; subscription.unsubscribe(); linkListener.remove(); appListener.remove();
  clearInterval(expiry); supabase?.auth.stopAutoRefresh(); stopSync?.(); cancelSync(); profileController?.abort();
 };
}
let loggingOut = false;
export async function logout() {
 if (loggingOut) return;
 loggingOut = true;
 stopSync?.(); cancelSync(); profileController?.abort();
 try {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
  useAuthStore.setState({ recovery: false });
  scheduleSession(null);
  await sequence;
 } catch (error) {
  if (useAuthStore.getState().session) stopSync = startSync();
  throw error;
 } finally { loggingOut = false; }
}
export function finishRecovery() {
 useAuthStore.setState({ recovery: false });
 stopSync?.(); stopSync = startSync();
}
