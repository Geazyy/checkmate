import React, { useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { ArrowLeft, Camera, Save } from 'lucide-react-native';
import { AppShell } from '../components/common/AppShell';
import { ActionButton } from '../components/common/Controls';
import { Avatar } from '../components/auth/Avatar';
import { Field, styles } from '../components/auth/AuthForm';
import { useAuthStore } from '../store/useAuthStore';
import { requireSupabase } from '../services/supabase/client';
import { refreshProfile, authRedirect } from '../services/auth/session';
import { friendlyAuthError, validEmail } from '../services/auth/errors';
import { ClayColors as C } from '../constants/theme';

export default function Profile() {
 const profile = useAuthStore(state => state.profile);
 const error = useAuthStore(state => state.error);
 if (!profile) return <AppShell title="Profile"><View style={styles.container}>
  <Text style={styles.label}>{error || 'Loading profile...'}</Text>
  <ActionButton onPress={() => { void refreshProfile(); }}><Text style={styles.link}>Retry profile</Text></ActionButton>
 </View></AppShell>;
 return <ProfileForm key={profile.id} />;
}
function ProfileForm() {
 const router = useRouter();
 const { profile, user, session } = useAuthStore();
 const [name, setName] = useState(profile?.full_name || user?.full_name || '');
 const [school, setSchool] = useState(profile?.school_name || '');
 const [teacherId, setTeacherId] = useState(profile?.teacher_id || '');
 const [phone, setPhone] = useState(profile?.phone || '');
 const [email, setEmail] = useState('');
 const [busy, setBusy] = useState(false);
 const [message, setMessage] = useState('');
 const [error, setError] = useState('');
 const lock = useRef(false);
 async function run(action: 'profile' | 'avatar' | 'email') {
  if (lock.current || !user) return;
  if (action === 'profile' && !name.trim()) { setError('Enter your full name.'); return; }
  if (action === 'email' && !validEmail(email)) { setError('Enter a valid email address.'); return; }
  lock.current = true; setBusy(true); setMessage(''); setError('');
  const owner = user.id;
  const stillOwner = () => useAuthStore.getState().session?.user.id === owner;
  let temp: File | undefined;
  let uploaded: string | undefined;
  let linked = false;
  const client = requireSupabase();
  try {
   if (action === 'email') {
    const { error: e } = await client.auth.updateUser({ email: email.trim() }, { emailRedirectTo: authRedirect() });
    if (e) throw e;
    if (stillOwner()) { setEmail(''); setMessage('Check your current and new email addresses to confirm the change.'); }
   } else if (action === 'avatar') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError('Photo access is needed to choose a profile picture.'); return; }
    const image = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (image.canceled || !stillOwner()) return;
    const context = ImageManipulator.manipulate(image.assets[0].uri);
    context.resize({ width: 512 });
    const rendered = await context.renderAsync();
    const normalized = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
    rendered.release(); context.release();
    let bytes: ArrayBuffer;
    if (Platform.OS === 'web') bytes = await (await fetch(normalized.uri)).arrayBuffer();
    else { temp = new File(normalized.uri); bytes = await temp.arrayBuffer(); }
    if (bytes.byteLength > 2 * 1024 * 1024) throw new Error('upload_failed');
    if (!stillOwner()) return;
    uploaded = owner + '/' + randomUUID() + '.jpg';
    const { error: uploadError } = await client.storage.from('checkmate-avatars').upload(uploaded, bytes, { contentType: 'image/jpeg' });
    if (uploadError) throw uploadError;
    if (!stillOwner()) return;
    const { error: updateError } = await client.from('profiles').update({ avatar_path: uploaded }).eq('id', owner).select('id').single();
    if (updateError) throw updateError;
    linked = true;
    if (profile?.avatar_path?.startsWith(owner + '/')) await client.storage.from('checkmate-avatars').remove([profile.avatar_path]);
    if (stillOwner()) { await refreshProfile(); setMessage('Profile photo saved.'); }
   } else {
    const { error: e } = await client.from('profiles').update({
     full_name: name.trim(), school_name: school.trim(), teacher_id: teacherId.trim(), phone: phone.trim(),
    }).eq('id', owner).select('id').single();
    if (e) throw e;
    if (stillOwner()) { await refreshProfile(); setMessage('Profile saved.'); }
   }
  } catch (e) {
   if (stillOwner()) setError(action === 'avatar' ? 'Could not upload your profile picture. Check your connection and try again.' : friendlyAuthError(e));
  } finally {
   if (uploaded && !linked && stillOwner()) await client.storage.from('checkmate-avatars').remove([uploaded]).catch(() => undefined);
   try { if (temp?.exists) temp.delete(); } catch { /* Cache cleanup must not prevent unlocking the form. */ }
   lock.current = false; setBusy(false);
  }
 }
 return <AppShell title="Profile"><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.container, { justifyContent: 'flex-start' }]}>
  <View style={[styles.form, { maxWidth: 600 }]}>
   <ActionButton accessibilityLabel="Back to Home" onPress={() => router.replace('/')}><ArrowLeft color={C.primary} /></ActionButton>
   <Text style={styles.title}>Edit profile</Text>
   <View style={styles.row}><Avatar size={64} /><ActionButton disabled={busy} accessibilityLabel="Change profile photo" onPress={() => { void run('avatar'); }}><Camera color={C.primary} /></ActionButton></View>
   <Text style={styles.label}>{user?.email} {session?.user.email_confirmed_at ? '(verified)' : '(not verified)'}</Text>
   <Text style={styles.label}>Role: {profile?.role ?? 'teacher'}</Text>
   <Field label="Full name" value={name} onChangeText={setName} maxLength={120} editable={!busy} />
   <Field label="School" value={school} onChangeText={setSchool} maxLength={200} editable={!busy} />
   <Field label="Teacher ID" value={teacherId} onChangeText={setTeacherId} maxLength={80} editable={!busy} />
   <Field label="Phone (optional)" value={phone} onChangeText={setPhone} maxLength={40} keyboardType="phone-pad" editable={!busy} />
   <ActionButton style={styles.primary} disabled={busy} onPress={() => { void run('profile'); }}><View style={styles.row}><Save color={C.onPrimary} size={18} /><Text style={styles.primaryText}>Save profile</Text></View></ActionButton>
   <Field label="New email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" editable={!busy} />
   <ActionButton disabled={busy || !email.trim()} onPress={() => { void run('email'); }}><Text style={styles.link}>Request email change</Text></ActionButton>
   {busy && <ActivityIndicator color={C.primary} />}
   {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
   {!!message && <Text accessibilityLiveRegion="polite" style={styles.success}>{message}</Text>}
  </View>
 </ScrollView></AppShell>;
}
