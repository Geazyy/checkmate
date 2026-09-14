import { Platform } from 'react-native';
import SQLiteStorage from 'expo-sqlite/kv-store';
import { randomUUID } from 'expo-crypto';
import { StateStorage } from 'zustand/middleware';
import { create } from 'zustand';
import { emptyWorkspace, queueStore, Workspace } from '../services/sync/model';

export const rawStorage = {
  getItem: async (key: string): Promise<string | null> => Platform.OS === 'web'
    ? globalThis.localStorage?.getItem(key) ?? null : SQLiteStorage.getItem(key),
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') globalThis.localStorage.setItem(key, value);
    else await SQLiteStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') globalThis.localStorage.removeItem(key);
    else await SQLiteStorage.removeItem(key);
  },
};
export const useSyncStatus = create<{ status: string; pending: number; conflicts: number; error: string | null }>(() =>
  ({ status: 'Local', pending: 0, conflicts: 0, error: null }));
let owner: string | null = null;
let workspace = emptyWorkspace();
let muted = false;
let writes = Promise.resolve();
const keyFor = (id: string) => 'checkmate-account-v1:' + id;
export const currentOwner = () => owner;
export function updateSyncCounts() {
  useSyncStatus.setState({ pending: Object.values(workspace.records).filter(r => r.pending).length,
    conflicts: Object.values(workspace.records).filter(r => r.conflict).length });
}
export async function flushStorage() { await writes; }
export async function openWorkspace(id: string | null) {
  owner = null;
  workspace = emptyWorkspace();
  await flushStorage();
  if (id) {
    const raw = await rawStorage.getItem(keyFor(id));
    workspace = raw ? JSON.parse(raw) : emptyWorkspace();
  }
  owner = id;
  useSyncStatus.setState({ status: id ? 'Local' : 'Signed out', error: null });
  updateSyncCounts();
}
export function getWorkspace(): Workspace { return JSON.parse(JSON.stringify(workspace)); }
export async function editWorkspace(id: string, edit: (w: Workspace) => void) {
  if (owner !== id) return false;
  const next = getWorkspace();
  edit(next);
  workspace = next;
  const serialized = JSON.stringify(next);
  writes = writes.catch(() => undefined).then(() => rawStorage.setItem(keyFor(id), serialized));
  try { await writes; updateSyncCounts(); return owner === id; }
  catch { useSyncStatus.setState({ error: 'Local storage could not be saved. Free device space before continuing.' }); throw new Error('local_storage_failed'); }
}
export async function hydrateQuietly(action: () => Promise<void>) {
  muted = true;
  try { await action(); } finally { muted = false; }
}
export const appStorage: StateStorage = {
  getItem: name => owner ? workspace.stores[name] ?? null : null,
  setItem: async (name, value) => {
    const id = owner;
    if (!id || muted) return;
    try { await editWorkspace(id, w => queueStore(w, id, name, value, randomUUID)); }
    catch { /* The sync status retains the disk error; flushStorage still rejects before upload. */ }
  },
  removeItem: async name => {
    const id = owner;
    if (id && !muted) await editWorkspace(id, w => { delete w.stores[name]; });
  },
};
