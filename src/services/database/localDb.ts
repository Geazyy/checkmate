import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { LocalScanQueueItem } from '../../types';
import { useScanStore } from '../../store/useScanStore';
import { currentOwner, flushStorage, getWorkspace } from '../../store/storage';
import { synchronize } from '../sync/engine';

let db: SQLite.SQLiteDatabase | null = null;
// Retain the pre-account database as an archive. New writes go to the owner-scoped store.
export async function getLocalDatabase(): Promise<SQLite.SQLiteDatabase | null> {
 if (Platform.OS === 'web') return null;
 if (!db) {
  db = await SQLite.openDatabaseAsync('checkmate_offline.db');
  await db.execAsync(`
   PRAGMA journal_mode = WAL;
   CREATE TABLE IF NOT EXISTS pending_scans (
    local_id TEXT PRIMARY KEY, exam_id TEXT NOT NULL, student_id TEXT,
    raw_score REAL NOT NULL, max_score REAL NOT NULL, percentage_score REAL NOT NULL,
    items_json TEXT NOT NULL, scanned_at TEXT NOT NULL, is_synced INTEGER DEFAULT 1
   );
  `);
 }
 return db;
}
export async function saveScanLocally(scan: Omit<LocalScanQueueItem, 'is_synced'>) {
 if (!currentOwner()) throw new Error('session_expired');
 const result = {
  id: scan.local_id, exam_id: scan.exam_id, student_id: scan.student_id,
  raw_score: scan.raw_score, max_score: scan.max_score, percentage_score: scan.percentage_score,
  items: JSON.parse(scan.items_json), scanned_at: scan.scanned_at, status: 'graded' as const,
 };
 useScanStore.setState(s => ({ scannedResults: [result, ...s.scannedResults.filter(r => r.id !== result.id)] }));
 await flushStorage();
}
export async function syncPendingScansToCloud(): Promise<{ syncedCount: number; errors: number }> {
 const owner = currentOwner();
 if (!owner) return { syncedCount: 0, errors: 1 };
 const pending = Object.values(getWorkspace().records).filter(r => r.table === 'checkmate_scans' && r.pending);
 await synchronize();
 if (currentOwner() !== owner) return { syncedCount: 0, errors: pending.length };
 const current = getWorkspace().records;
 const syncedCount = pending.filter(r => current[r.table + ':' + r.local_id]?.pending === false).length;
 return { syncedCount, errors: pending.length - syncedCount };
}
