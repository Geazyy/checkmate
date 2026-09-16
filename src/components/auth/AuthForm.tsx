import { useAppTheme, useThemedStyles, AppTheme } from '../../constants/theme';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff } from 'lucide-react-native';
import { Link, useRouter } from 'expo-router';
import { AccessibleInput, ActionButton } from '../common/Controls';

import { cloudConfigured, rememberSession, requireSupabase } from '../../services/supabase/client';
import { authRedirect, finishRecovery, logout } from '../../services/auth/session';
import { friendlyAuthError, validEmail, validPassword } from '../../services/auth/errors';
import { useAuthStore } from '../../store/useAuthStore';

type Mode = 'login' | 'register' | 'forgot-password' | 'reset-password';
export function AuthForm({ mode }: { mode: Mode }) {
  const { ClayColors: C } = useAppTheme();
  const styles = useThemedStyles(createStyles);
 const router = useRouter();
 const [name, setName] = useState('');
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [confirm, setConfirm] = useState('');
 const [visible, setVisible] = useState(false);
 const [remember, setRemember] = useState(true);
 const [accepted, setAccepted] = useState(false);
 const [busy, setBusy] = useState(false);
 const lock = useRef(false);
 const [message, setMessage] = useState('');
 const [error, setError] = useState('');
 const authError = useAuthStore(s => s.error);
 const recovery = useAuthStore(s => s.recovery);
 const title = ({ login: 'Sign in', register: 'Create account', 'forgot-password': 'Reset password', 'reset-password': 'Choose new password' })[mode];
 const terms = process.env.EXPO_PUBLIC_TERMS_URL ?? '';
 const privacy = process.env.EXPO_PUBLIC_PRIVACY_URL ?? '';
 const legalReady = terms.startsWith('https://') && privacy.startsWith('https://');
 async function submit() {
  if (lock.current) return;
  setError(''); setMessage('');
  if (mode !== 'reset-password' && !validEmail(email)) { setError('Enter a valid email address.'); return; }
  if (mode === 'register' && (!name.trim() || name.trim().length > 120)) { setError('Enter your full name (up to 120 characters).'); return; }
  if ((mode === 'register' || mode === 'reset-password') && !validPassword(password)) { setError('Use 12 to 128 characters for your password.'); return; }
  if ((mode === 'register' || mode === 'reset-password') && password !== confirm) { setError('The passwords do not match.'); return; }
  if (mode === 'register' && (!accepted || !legalReady)) { setError('Read and accept the Terms and Privacy Policy.'); return; }
  if (mode === 'login' && !password) { setError('Enter your password.'); return; }
  lock.current = true; setBusy(true);
  try {
   const client = requireSupabase();
   if (mode === 'login') {
    rememberSession(remember);
    const { error: e } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (e) throw e;
   } else if (mode === 'register') {
    const { error: e } = await client.auth.signUp({ email: email.trim(), password, options: {
     emailRedirectTo: authRedirect(), data: { full_name: name.trim(), terms_accepted_at: new Date().toISOString() },
    } });
    if (e) throw e;
    setMessage('Check your email to verify your account. If you already have an account, sign in or reset your password.');
    setPassword(''); setConfirm('');
   } else if (mode === 'forgot-password') {
    const { error: e } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirect() + '?recovery=1' });
    if (e) throw e;
    setMessage('If an account exists for this address, a reset link will arrive shortly. Open it on this device.');
   } else {
    if (!recovery) throw { code: 'otp_expired' };
    const { error: e } = await client.auth.updateUser({ password });
    if (e) throw e;
    setPassword(''); setConfirm(''); finishRecovery(); router.replace('/');
   }
  } catch (e) { setError(friendlyAuthError(e)); }
  finally { lock.current = false; setBusy(false); }
 }
 return <SafeAreaView style={styles.root}>
  <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
   <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
    <Text style={styles.brand}>CheckMate</Text>
    <View style={styles.form}>
     <Text style={styles.title}>{title}</Text>
     {!cloudConfigured && <Text style={styles.error}>Cloud sign-in needs setup. Your existing local data has not been deleted.</Text>}
     {mode === 'register' && <><Field label="Full name" value={name} onChangeText={setName} editable={!busy} maxLength={120} /><Text style={styles.label}>Account type: Teacher</Text></>}
     {mode !== 'reset-password' && <Field label="Email" value={email} onChangeText={setEmail} editable={!busy} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />}
     {mode !== 'forgot-password' && <>
      <View style={styles.passwordRow}>
       <View style={{ flex: 1 }}><Field label="Password" value={password} onChangeText={setPassword} editable={!busy} secureTextEntry={!visible} autoCapitalize="none" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></View>
       <ActionButton style={styles.eye} accessibilityLabel={visible ? 'Hide password' : 'Show password'} onPress={() => setVisible(!visible)}>{visible ? <EyeOff color={C.primary} /> : <Eye color={C.primary} />}</ActionButton>
      </View>
      {(mode === 'register' || mode === 'reset-password') && <Field label="Confirm password" value={confirm} onChangeText={setConfirm} editable={!busy} secureTextEntry={!visible} autoCapitalize="none" autoComplete="new-password" />}
     </>}
     {mode === 'login' && <View style={styles.row}><Text style={styles.label}>Remember session</Text><Switch accessibilityLabel="Remember session" value={remember} onValueChange={setRemember} disabled={busy} /></View>}
     {mode === 'register' && <>
      <View style={styles.row}><Text style={[styles.label, { flex: 1 }]}>I accept the Terms and Privacy Policy</Text><Switch accessibilityLabel="Accept Terms and Privacy Policy" value={accepted} onValueChange={setAccepted} disabled={!legalReady || busy} /></View>
      <View style={styles.row}>{[['Terms', terms], ['Privacy Policy', privacy]].map(([label, url]) => <ActionButton key={label} disabled={!url.startsWith('https://')} onPress={() => { void Linking.openURL(url).catch(() => setError('Could not open this page.')); }}><Text style={styles.link}>{label}</Text></ActionButton>)}</View>
      {!legalReady && <Text style={styles.error}>Registration is unavailable until the Terms and Privacy Policy pages are configured.</Text>}
     </>}
     {!!(error || authError) && <Text accessibilityRole="alert" style={styles.error}>{error || authError}</Text>}
     {!!message && <Text accessibilityLiveRegion="polite" style={styles.success}>{message}</Text>}
     <ActionButton style={styles.primary} disabled={busy || !cloudConfigured || (mode === 'register' && !legalReady)} onPress={() => { void submit(); }}>
      {busy ? <ActivityIndicator color={C.onPrimary} /> : <Text style={styles.primaryText}>{mode === 'forgot-password' ? 'Send reset link' : title}</Text>}
     </ActionButton>
     {mode === 'login' ? <>
      <Link href="/auth/forgot-password" style={styles.link}>Forgot password?</Link>
      <Link href="/auth/register" style={styles.link}>Create account</Link>
     </> : mode === 'reset-password' ? <ActionButton disabled={busy} onPress={() => {
      if (lock.current) return;
      lock.current = true; setBusy(true);
      void logout().then(() => router.replace('/auth/login')).catch(e => setError(friendlyAuthError(e)))
       .finally(() => { lock.current = false; setBusy(false); });
     }}><Text style={styles.link}>Cancel and sign out</Text></ActionButton>
      : <Link href="/auth/login" style={styles.link}>Back to sign in</Link>}
    </View>
   </ScrollView>
  </KeyboardAvoidingView>
 </SafeAreaView>;
}
export function Field({ label, ...props }: React.ComponentProps<typeof AccessibleInput> & { label: string }) {
  const styles = useThemedStyles(createStyles);
 return <View style={{ gap: 6 }}><Text style={styles.label}>{label}</Text><AccessibleInput {...props} accessibilityLabel={label} style={styles.input} /></View>;
}
export const createStyles = ({ ClayColors: C, ClayCardStyle }: AppTheme) => StyleSheet.create({
 root: { flex: 1, backgroundColor: C.bg },
 container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 20 },
 brand: { fontSize: 28, color: C.primary, fontWeight: '800' },
 form: { ...ClayCardStyle, width: '100%', maxWidth: 460, padding: 24, gap: 16 },
 title: { color: C.textPrimary, fontSize: 24, fontWeight: '800' },
 label: { color: C.textSecondary, fontSize: 14, lineHeight: 21 },
 input: { minHeight: 48, width: '100%' },
 row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
 passwordRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
 eye: { width: 44, height: 48, justifyContent: 'center', alignItems: 'center' },
 primary: { minHeight: 48, backgroundColor: C.primary, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 12 },
 primaryText: { color: C.onPrimary, fontSize: 16, fontWeight: '700' },
 link: { color: C.primary, fontSize: 15, paddingVertical: 8 },
 error: { color: C.danger, fontSize: 14, lineHeight: 21 },
 success: { color: C.success, fontSize: 14, lineHeight: 21 },
});
