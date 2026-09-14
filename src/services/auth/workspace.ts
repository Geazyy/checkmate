import { randomUUID } from 'expo-crypto';
import { useExamStore } from '../../store/useExamStore';
import { useScanStore } from '../../store/useScanStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useRosterStore } from '../../store/useRosterStore';
import { useTemplateStore } from '../../store/useTemplateStore';
import { currentOwner, editWorkspace, getWorkspace, hydrateQuietly, openWorkspace, rawStorage } from '../../store/storage';
import { queueStore } from '../sync/model';
import { clearTemporaryImages } from './privateImages';
const stores = [useExamStore, useScanStore, useSettingsStore, useRosterStore, useTemplateStore];
export async function hydrateWorkspace() {
 await hydrateQuietly(async () => {
  for (const store of stores) await store.persist.rehydrate();
  const s = useExamStore.getState();
 if (s.activeExam) s.setActiveExam(s.exams.find(e => e.id === s.activeExam?.id) ?? null);
  if (s.selectedClassId && !s.classes.some(c => c.id === s.selectedClassId)) s.setSelectedClass(null);
 });
}
export async function switchWorkspace(id: string | null) {
 clearTemporaryImages(useScanStore.getState().scannedResults.map(s => s.cropped_sheet_image_url ?? ''));
 await openWorkspace(null);
 await hydrateQuietly(async () => {
  useExamStore.setState({ exams: [], classes: [], answerKeysByExamId: {}, activeExam: null, activeAnswerKeys: [], selectedClassId: null });
  useScanStore.setState({ scannedResults: [], lastScannedResult: null, isScanning: false, isAligned: false, torchEnabled: false });
  useSettingsStore.setState({ showConfidence: true, highlightFlagged: true });
  useRosterStore.setState({ studentsByClassId: {} });
  useTemplateStore.setState({ templates: {} });
 });
 if (id) { await openWorkspace(id); await hydrateWorkspace(); }
}
export async function canImportLegacy() {
 const claim = await rawStorage.getItem('checkmate-legacy-claimed');
 if (claim && (claim !== currentOwner() || Object.values(getWorkspace().records).some(r => r.table !== 'checkmate_preferences'))) return false;
 return !!(await rawStorage.getItem('checkmate-exams-v1') || await rawStorage.getItem('checkmate-scans-v1'));
}
export async function importLegacyWorkspace() {
 const id = currentOwner();
 if (!id || !await canImportLegacy()) throw new Error('legacy_unavailable');
 // Import into an empty account only. Old keys/files remain as an untouched backup.
 const imported: Record<string, string> = {};
 for (const name of ['checkmate-exams-v1','checkmate-scans-v1','checkmate-settings-v1']) {
  const raw = await rawStorage.getItem(name);
  if (raw) {
   const parsed = JSON.parse(raw);
   delete parsed.state.activeExam;
   delete parsed.state.activeAnswerKeys;
   delete parsed.state.selectedClassId;
   imported[name] = JSON.stringify(parsed);
  }
 }
 if (currentOwner() !== id) return;
 // Reserve ownership before copying; on failure only this owner can retry.
 const claim = await rawStorage.getItem('checkmate-legacy-claimed');
 if (claim && claim !== id) throw new Error('legacy_unavailable');
 if (Object.values(getWorkspace().records).some(r => r.table !== 'checkmate_preferences')) throw new Error('workspace_not_empty');
 await rawStorage.setItem('checkmate-legacy-claimed', id);
 const saved = await editWorkspace(id, w => {
  for (const [name, raw] of Object.entries(imported)) queueStore(w, id, name, raw, randomUUID);
 });
 if (!saved) return;
 await hydrateWorkspace();
}
