import { CloudRow, CloudTable, Json } from '../supabase/database.types';
export const TABLES: CloudTable[] = ['checkmate_exams', 'checkmate_answer_keys', 'checkmate_classes',
  'checkmate_rosters', 'checkmate_scans', 'checkmate_preferences', 'checkmate_templates'];
export interface LocalRecord extends CloudRow {
  table: CloudTable; pending: boolean; conflict?: CloudRow; local_updated_at: string;
}
export interface Workspace {
  stores: Record<string, string>; records: Record<string, LocalRecord>;
}
export const emptyWorkspace = (): Workspace => ({ stores: {}, records: {} });
export type RecordData = { table: CloudTable; localId: string; data: Json };
export function recordsFromStore(name: string, raw: string): RecordData[] {
  const s = JSON.parse(raw).state;
  const result: RecordData[] = [];
  const add = (table: CloudTable, localId: string, data: Json) => result.push({ table, localId, data });
  if (name === 'checkmate-exams-v1') {
    for (const exam of s.exams ?? []) add('checkmate_exams', exam.id, exam);
    for (const cls of s.classes ?? []) add('checkmate_classes', cls.id, cls);
    for (const [id, keys] of Object.entries(s.answerKeysByExamId ?? {})) add('checkmate_answer_keys', id, keys as Json);
  } else if (name === 'checkmate-scans-v1') {
    for (const scan of s.scannedResults ?? []) {
      const { cropped_sheet_image_url: _privateImage, ...data } = scan;
      add('checkmate_scans', scan.id, data);
    }
  } else if (name === 'checkmate-rosters-v1') {
    for (const [id, students] of Object.entries(s.studentsByClassId ?? {})) add('checkmate_rosters', id, students as Json);
  } else if (name === 'checkmate-settings-v1') add('checkmate_preferences', 'settings', s);
  else if (name === 'checkmate-templates-v1') {
    for (const [id, config] of Object.entries(s.templates ?? {})) add('checkmate_templates', id, config as Json);
  }
  return result;
}
export function storeForTable(table: CloudTable) {
  if (['checkmate_exams', 'checkmate_classes', 'checkmate_answer_keys'].includes(table)) return 'checkmate-exams-v1';
  return ({ checkmate_scans: 'checkmate-scans-v1', checkmate_rosters: 'checkmate-rosters-v1',
    checkmate_preferences: 'checkmate-settings-v1', checkmate_templates: 'checkmate-templates-v1' } as Record<string, string>)[table];
}
export function queueStore(w: Workspace, owner: string, name: string, raw: string, uuid: () => string) {
  const fresh = recordsFromStore(name, raw);
  const present = new Set<string>();
  for (const value of fresh) {
    const k = value.table + ':' + value.localId;
    present.add(k);
    const old = w.records[k];
    if (old && !old.deleted_at && JSON.stringify(old.data) === JSON.stringify(value.data)) continue;
    w.records[k] = { ...old, table: value.table, id: old?.id ?? uuid(), owner_id: owner, local_id: value.localId,
      data: value.data, version: old?.version ?? 0, mutation_id: uuid(), pending: true, deleted_at: null,
      updated_at: old?.updated_at ?? new Date(0).toISOString(), local_updated_at: new Date().toISOString() };
  }
  for (const [k, old] of Object.entries(w.records)) {
    if (storeForTable(old.table) === name && !present.has(k) && !old.deleted_at) {
      w.records[k] = { ...old, pending: true, deleted_at: new Date().toISOString(), mutation_id: uuid() };
    }
  }
  w.stores[name] = raw;
}
export function acceptRemote(w: Workspace, table: CloudTable, remote: CloudRow) {
  const k = table + ':' + remote.local_id;
  const old = w.records[k];
  if (old?.pending) {
    if (old.mutation_id === remote.mutation_id) w.records[k] = { ...old, ...remote, pending: false, conflict: undefined };
    else if (remote.version !== old.version || remote.id !== old.id) w.records[k] = { ...old, conflict: remote };
    return;
  }
  w.records[k] = { ...remote, table, pending: false, local_updated_at: remote.updated_at };
}
export function rebuildStores(w: Workspace) {
  const grouped = (table: CloudTable) => Object.values(w.records).filter(r => r.table === table && !r.deleted_at);
  const object = (table: CloudTable) => Object.fromEntries(grouped(table).map(r => [r.local_id, r.data]));
  const save = (key: string, state: unknown) => { w.stores[key] = JSON.stringify({ state, version: 0 }); };
  save('checkmate-exams-v1', { exams: grouped('checkmate_exams').map(r => r.data),
    classes: grouped('checkmate_classes').map(r => r.data), answerKeysByExamId: object('checkmate_answer_keys') });
  // Local photo URIs are never uploaded. Retain existing images only on the same device.
  const images = new Map<string, string>();
  if (w.stores['checkmate-scans-v1']) {
    for (const scan of JSON.parse(w.stores['checkmate-scans-v1']).state.scannedResults ?? [])
      if (scan.cropped_sheet_image_url) images.set(scan.id, scan.cropped_sheet_image_url);
  }
  save('checkmate-scans-v1', { scannedResults: grouped('checkmate_scans').map(r => ({
    ...(r.data as object), ...(images.has(r.local_id) ? { cropped_sheet_image_url: images.get(r.local_id) } : {}),
  })) });
  save('checkmate-rosters-v1', { studentsByClassId: object('checkmate_rosters') });
  save('checkmate-templates-v1', { templates: object('checkmate_templates') });
  const settings = grouped('checkmate_preferences')[0];
  if (settings) save('checkmate-settings-v1', settings.data);
}
