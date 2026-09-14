/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const disk = new Map();
let failDisk = false;
let session = null;
let listener;
let listeners = 0;
let signouts = 0;
let remote = [];
let writes = 0;
let lastLink = null;
const cloud = {
 auth: {
  getSession: async () => ({ data: { session }, error: null }),
  onAuthStateChange: callback => { listener = callback; listeners++; return { data: { subscription: { unsubscribe() { listeners--; } } } }; },
  startAutoRefresh() {}, stopAutoRefresh() {},
  signOut: async () => { signouts++; session = null; listener?.('SIGNED_OUT', null); return { error: null }; },
  exchangeCodeForSession: async code => {
   if (code === 'expired') throw { code: 'otp_expired' };
   return { data: { session }, error: null };
  },
 },
 from(table) {
  const query = {
   select() { return query; }, eq() { return query; }, abortSignal() { return query; }, order() { return query; }, range() { return query; },
   single: async () => ({ data: { id: session?.user.id, full_name: 'Test Teacher', role: 'teacher' }, error: null }),
   then(resolve, reject) { return Promise.resolve({ data: remote.filter(r => r.table === table).map(({ table: _t, ...r }) => r), error: null }).then(resolve, reject); },
  };
  return query;
 },
 rpc(_name, args) {
  writes++;
  return { abortSignal: async () => {
   const existing = remote.find(r => r.local_id === args.p_local_id && r.table === args.p_table && r.owner_id === session.user.id);
   if (existing && existing.mutation_id !== args.p_mutation && existing.version !== args.p_version) return { data: { ok: false, row: existing }, error: null };
   const row = { id: args.p_id, owner_id: session.user.id, local_id: args.p_local_id, data: args.p_data, version: args.p_version + 1,
    mutation_id: args.p_mutation, updated_at: new Date().toISOString(), deleted_at: args.p_deleted ? new Date().toISOString() : null };
   remote = remote.filter(r => !(r.id === row.id && r.table === args.p_table));
   remote.push({ table: args.p_table, ...row });
   return { data: { ok: true, row }, error: null };
  } };
 },
};
const modules = new Map();
function load(file) {
 file = path.resolve(root, file);
 if (!path.extname(file)) file += '.ts';
 if (modules.has(file)) return modules.get(file).exports;
 const module = { exports: {} }; modules.set(file, module);
 const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
 function requireLocal(name) {
  if (name === 'react-native') return { Platform: { OS: 'ios' }, AppState: { addEventListener: () => ({ remove() {} }) } };
  if (name === 'expo-linking') return { createURL: () => 'checkmate://auth/callback', getInitialURL: async () => lastLink, addEventListener: () => ({ remove() {} }) };
  if (name === 'expo-crypto') return { randomUUID: crypto.randomUUID };
  if (name === 'expo-file-system') return { Paths: { cache: { uri: 'file:///app-cache/' } }, File: class { exists = false; } };
  if (name === 'expo-sqlite/kv-store') return {
   getItem: async key => disk.get(key) ?? null,
   setItem: async (key, value) => { if (failDisk) throw new Error('full'); disk.set(key, value); },
   removeItem: async key => disk.delete(key),
  };
  if (name.endsWith('supabase/client')) return { supabase: cloud, requireSupabase: () => cloud };
  if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
  return require(name);
 }
 new Function('require', 'module', 'exports', source)(requireLocal, module, module.exports);
 return module.exports;
}
const tick = () => new Promise(r => setTimeout(r, 50));
const makeSession = id => ({ user: { id, email: id + '@example.test', created_at: new Date().toISOString(), user_metadata: {} }, expires_at: Math.floor(Date.now() / 1000) + 3600 });
const model = load('src/services/sync/model');
const storage = load('src/store/storage');
const workspace = load('src/services/auth/workspace');
const exams = load('src/store/useExamStore').useExamStore;
const authStore = load('src/store/useAuthStore').useAuthStore;
const engine = load('src/services/sync/engine');
const auth = load('src/services/auth/session');
const errors = load('src/services/auth/errors');
const example = title => ({ id: 'exam-legacy', title, teacher_id: 'legacy', total_questions: 25 });
async function main() {
 const w = model.emptyWorkspace();
 const raw = JSON.stringify({ state: { exams: [example('First')], classes: [], answerKeysByExamId: {} } });
 model.queueStore(w, 'owner-a', 'checkmate-exams-v1', raw, crypto.randomUUID);
 const original = { ...w.records['checkmate_exams:exam-legacy'] };
 model.queueStore(w, 'owner-a', 'checkmate-exams-v1', raw, crypto.randomUUID);
 assert.equal(w.records['checkmate_exams:exam-legacy'].mutation_id, original.mutation_id, 'unchanged saves are idempotent');
 model.acceptRemote(w, original.table, { ...original, version: 1 });
 assert.equal(w.records['checkmate_exams:exam-legacy'].pending, false);
 model.queueStore(w, 'owner-a', 'checkmate-exams-v1', raw.replace('First', 'Local edit'), crypto.randomUUID);
 model.acceptRemote(w, original.table, { ...original, version: 2, mutation_id: crypto.randomUUID(), data: example('Remote edit') });
 assert.equal(w.records['checkmate_exams:exam-legacy'].data.title, 'Local edit');
 assert.equal(w.records['checkmate_exams:exam-legacy'].conflict.data.title, 'Remote edit');
 model.queueStore(w, 'owner-a', 'checkmate-exams-v1', JSON.stringify({ state: { exams: [] } }), crypto.randomUUID);
 assert.ok(w.records['checkmate_exams:exam-legacy'].deleted_at);
 model.rebuildStores(w);
 assert.equal(JSON.parse(w.stores['checkmate-exams-v1']).state.exams.length, 0);
 const scanRecords = model.recordsFromStore('checkmate-scans-v1', JSON.stringify({ state: { scannedResults: [{ id: 'scan', cropped_sheet_image_url: 'private.jpg', items: [] }] } }));
 assert.equal('cropped_sheet_image_url' in scanRecords[0].data, false);

 await workspace.switchWorkspace('owner-a');
 exams.getState().setExams([example('A private')]);
 await storage.flushStorage();
 await workspace.switchWorkspace('owner-b');
 assert.deepEqual(exams.getState().exams, []);
 exams.getState().setExams([example('B private')]);
 await storage.flushStorage();
 await workspace.switchWorkspace('owner-a');
 assert.equal(exams.getState().exams[0].title, 'A private');
 const before = disk.get('checkmate-account-v1:owner-b');
 await storage.editWorkspace('owner-b', value => { value.stores = {}; });
 assert.equal(disk.get('checkmate-account-v1:owner-b'), before);
 session = makeSession('owner-a');
 await engine.synchronize();
 assert.equal(storage.useSyncStatus.getState().pending, 0);
 assert.equal(writes, 1);
 await engine.synchronize();
 assert.equal(writes, 1, 'retry does not duplicate acknowledged record');

 exams.getState().setExams([example('Local conflict')]); await storage.flushStorage();
 remote[0] = { ...remote[0], version: 2, mutation_id: crypto.randomUUID(), data: example('Cloud conflict') };
 await engine.synchronize();
 assert.equal(storage.useSyncStatus.getState().conflicts, 1);
 assert.equal(exams.getState().exams[0].title, 'Local conflict');
 await engine.resolveConflicts('cloud'); await tick();
 assert.equal(exams.getState().exams[0].title, 'Cloud conflict');

 await workspace.switchWorkspace(null);
 assert.deepEqual(exams.getState().exams, []);
 assert.equal(storage.currentOwner(), null);
 remote = [];
 disk.set('checkmate-exams-v1', raw);
 await workspace.switchWorkspace('import-owner');
 await workspace.importLegacyWorkspace();
 assert.equal(exams.getState().exams[0].title, 'First');
 assert.equal(disk.get('checkmate-exams-v1'), raw, 'legacy data stays unchanged');
 await workspace.switchWorkspace('other-owner');
 assert.equal(await workspace.canImportLegacy(), false, 'second account cannot claim old data');
 assert.deepEqual(exams.getState().exams, []);

 session = makeSession('auth-owner');
 const stop = auth.startAuthentication();
 await tick(); await tick();
 assert.equal(listeners, 1);
 assert.equal(authStore.getState().session.user.id, 'auth-owner');
 await auth.handleAuthLink('https://untrusted.test/auth/callback?code=anything');
 assert.equal(authStore.getState().recovery, false);
 await auth.handleAuthLink('checkmate://auth/callback?code=valid&recovery=1');
 assert.equal(authStore.getState().recovery, true);
 await auth.logout(); await tick();
 assert.equal(signouts, 1);
 assert.equal(authStore.getState().session, null);
 assert.equal(storage.currentOwner(), null);
 assert.deepEqual(exams.getState().exams, []);
 stop(); assert.equal(listeners, 0);
 lastLink = 'checkmate://auth/callback?error=expired';
 const stop2 = auth.startAuthentication(); await tick();
 assert.match(authStore.getState().error, /expired/i);
 stop2();
 assert.equal(errors.validEmail('teacher@school.edu'), true);
 assert.equal(errors.validEmail('bad'), false);
 assert.equal(errors.validPassword('short'), false);
 assert.equal(errors.validPassword('long-enough-password'), true);
 assert.ok(!errors.friendlyAuthError(new Error('private SQL credentials')).includes('SQL'));
 await workspace.switchWorkspace('disk-full');
 failDisk = true;
 await assert.rejects(storage.editWorkspace('disk-full', v => { v.stores.a = 'b'; }), /local_storage_failed/);
 assert.match(storage.useSyncStatus.getState().error, /Local storage/);
 console.log('PASS: queue idempotency, tombstones, conflicts, private image exclusion, account isolation, legacy preservation, simulated sync/auth/logout, deep-link validation, validation and disk-error reporting.');
 console.log('Auth/network/storage adapters are test doubles. Live Supabase, Postgres RLS, native SQLite and device email links are NOT validated by this test.');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
