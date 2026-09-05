import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { LocalScanQueueItem } from '../../types';

let db: SQLite.SQLiteDatabase | null = null;
let mockWebMemoryQueue: LocalScanQueueItem[] = [];

export async function getLocalDatabase(): Promise<SQLite.SQLiteDatabase | null> {
  if (Platform.OS === 'web') {
    return null;
  }
  if (!db) {
    db = await SQLite.openDatabaseAsync('checkmate_offline.db');
    await initLocalTables(db);
  }
  return db;
}

async function initLocalTables(database: SQLite.SQLiteDatabase) {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS pending_scans (
      local_id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL,
      student_id TEXT,
      raw_score REAL NOT NULL,
      max_score REAL NOT NULL,
      percentage_score REAL NOT NULL,
      items_json TEXT NOT NULL,
      scanned_at TEXT NOT NULL,
      is_synced INTEGER DEFAULT 1
    );
  `);
}

export async function saveScanLocally(scan: Omit<LocalScanQueueItem, 'is_synced'>): Promise<void> {
  if (Platform.OS === 'web') {
    mockWebMemoryQueue.push({ ...scan, is_synced: true });
    return;
  }
  const database = await getLocalDatabase();
  if (!database) return;
  await database.runAsync(
    `INSERT INTO pending_scans (local_id, exam_id, student_id, raw_score, max_score, percentage_score, items_json, scanned_at, is_synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      scan.local_id,
      scan.exam_id,
      scan.student_id || null,
      scan.raw_score,
      scan.max_score,
      scan.percentage_score,
      scan.items_json,
      scan.scanned_at,
    ]
  );
}

export async function syncPendingScansToCloud(): Promise<{ syncedCount: number; errors: number }> {
  return { syncedCount: 0, errors: 0 };
}
