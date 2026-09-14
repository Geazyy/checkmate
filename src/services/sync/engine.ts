import { AppState, Platform } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { supabase } from '../supabase/client';
import { CloudRow, CloudTable } from '../supabase/database.types';
import { currentOwner, editWorkspace, flushStorage, getWorkspace, useSyncStatus } from '../../store/storage';
import { acceptRemote, rebuildStores, TABLES } from './model';
import { hydrateWorkspace } from '../auth/workspace';

let controller: AbortController | null = null;
let epoch = 0;
let running = false;
export function cancelSync() { epoch++; controller?.abort(); controller = null; }
export async function synchronize() {
 const owner = currentOwner();
 if (running || !owner || !supabase) return;
 running = true;
 const generation = epoch;
 const requestController = new AbortController();
 controller = requestController;
 const signal = requestController.signal;
 const timeout = setTimeout(() => requestController.abort(), 25000);
 const active = () => !signal.aborted && epoch === generation && currentOwner() === owner;
 useSyncStatus.setState({ status: 'Syncing', error: null });
 try {
  await flushStorage();
  const { data } = await supabase.auth.getSession();
  if (!active() || data.session?.user.id !== owner || (data.session.expires_at ?? 0) * 1000 <= Date.now()) return;
  for (const record of Object.values(getWorkspace().records)) {
   if (!active()) return;
   if (!record.pending || record.conflict) continue;
   await flushStorage();
   if (!active()) return;
   const { data: result, error } = await supabase.rpc('checkmate_write', {
    p_table: record.table, p_id: record.id, p_local_id: record.local_id, p_data: record.data,
    p_version: record.version, p_mutation: record.mutation_id, p_deleted: !!record.deleted_at,
   }).abortSignal(signal);
   if (error) throw error;
   if (!active()) return;
   const response = result as unknown as { ok: boolean; row: CloudRow };
   if (!response?.row || response.row.owner_id !== owner) throw new Error('invalid_response');
   await editWorkspace(owner, w => {
    const k = record.table + ':' + record.local_id;
    const current = w.records[k];
    // A user may edit again while this write is in flight.
    if (response.ok && current?.mutation_id !== record.mutation_id) {
     w.records[k] = { ...current, id: response.row.id, version: response.row.version };
    } else acceptRemote(w, record.table, response.row);
   });
  }
  for (const table of TABLES) {
   let offset = 0;
   while (active()) {
    const { data: rows, error } = await supabase.from(table).select('*').eq('owner_id', owner)
      .order('id').range(offset, offset + 199).abortSignal(signal);
    if (error) throw error;
    if (!active()) return;
    await editWorkspace(owner, w => { for (const row of rows ?? []) if (row.owner_id === owner) acceptRemote(w, table, row); });
    if (!rows || rows.length < 200) break;
    offset += 200;
   }
  }
  if (active()) {
   await editWorkspace(owner, rebuildStores);
   if (active()) await hydrateWorkspace();
   if (active()) useSyncStatus.setState({ status: useSyncStatus.getState().conflicts ? 'Review conflicts' : useSyncStatus.getState().pending ? 'Changes queued' : 'Up to date' });
  }
 } catch {
  if (epoch === generation && currentOwner() === owner) useSyncStatus.setState({
   status: 'Waiting to retry', error: 'Cloud sync is unavailable. Saved local changes will retry when connected.',
  });
 } finally { clearTimeout(timeout); running = false; }
}
export function startSync() {
 const timer = setInterval(() => { void synchronize(); }, 30000);
 const subscription = AppState.addEventListener('change', state => { if (state === 'active') void synchronize(); else cancelSync(); });
 const online = () => { void synchronize(); };
 if (Platform.OS === 'web') globalThis.addEventListener?.('online', online);
 void synchronize();
 return () => { clearInterval(timer); subscription.remove(); cancelSync(); if (Platform.OS === 'web') globalThis.removeEventListener?.('online', online); };
}
export async function resolveConflicts(choice: 'local' | 'cloud') {
 const owner = currentOwner();
 if (!owner) return;
 cancelSync();
 await editWorkspace(owner, w => {
  for (const [key, r] of Object.entries(w.records)) {
   if (!r.conflict) continue;
   const remote = r.conflict;
   w.records[key] = choice === 'cloud'
    ? { ...remote, table: r.table as CloudTable, pending: false, local_updated_at: remote.updated_at }
    : { ...r, id: remote.id, version: remote.version, conflict: undefined, pending: true, mutation_id: randomUUID() };
  }
  rebuildStores(w);
 });
 await hydrateWorkspace();
 void synchronize();
}
