import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { ActionButton } from '../common/Controls';
import { styles } from './AuthForm';
import { currentOwner, useSyncStatus } from '../../store/storage';
import { canImportLegacy, importLegacyWorkspace } from '../../services/auth/workspace';
import { synchronize, resolveConflicts } from '../../services/sync/engine';
export function SyncSettings() {
 const sync = useSyncStatus();
 const [legacy, setLegacy] = useState(false);
 const [confirm, setConfirm] = useState(false);
 const [busy, setBusy] = useState(false);
 const [message, setMessage] = useState('');
 useEffect(() => { void canImportLegacy().then(setLegacy); }, []);
 return <View style={{ gap: 12 }}>
  <Text style={styles.title}>Cloud backup</Text>
  <Text accessibilityLiveRegion="polite" style={styles.label}>{sync.status} · {sync.pending} pending · {sync.conflicts} conflicts</Text>
  {!!sync.error && <Text style={styles.error}>{sync.error}</Text>}
  <ActionButton disabled={busy || sync.status === 'Syncing'} onPress={() => { void synchronize(); }}><Text style={styles.link}>Sync now</Text></ActionButton>
  {sync.conflicts > 0 && <>
   <Text style={styles.label}>Another device changed these records. Both versions are retained until you choose.</Text>
   {(['cloud', 'local'] as const).map(choice => <ActionButton key={choice} disabled={busy} onPress={() => {
    setBusy(true); void resolveConflicts(choice).catch(() => setMessage('Could not resolve conflicts. Try again.')).finally(() => setBusy(false));
   }}><Text style={styles.link}>{choice === 'cloud' ? 'Use cloud versions' : 'Keep this device versions'}</Text></ActionButton>)}
  </>}
  {legacy && <>
   <Text style={styles.label}>Unassigned data from the earlier app is preserved on this device. Import only if it belongs to you. Your account must be empty.</Text>
   <ActionButton disabled={busy} onPress={() => setConfirm(!confirm)}><Text style={styles.link}>Import earlier local data</Text></ActionButton>
   {confirm && <>
    <Text style={styles.label}>Assign the earlier local exams and scans to this account? The original backup will remain untouched.</Text>
    <ActionButton disabled={busy} onPress={() => {
     if (!currentOwner()) return;
     setBusy(true);
     void importLegacyWorkspace().then(() => { setLegacy(false); setMessage('Earlier data imported.'); })
      .catch(() => setMessage('Import needs an empty account and available local storage. The original data is unchanged.'))
      .finally(() => setBusy(false));
    }}><Text style={styles.link}>Confirm import</Text></ActionButton>
   </>}
  </>}
  {!!message && <Text accessibilityLiveRegion="polite" style={styles.label}>{message}</Text>}
 </View>;
}
