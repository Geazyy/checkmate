import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { LocalScanQueueItem } from '../../types';
import { supabase } from '../supabase/client';

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
      is_synced INTEGER DEFAULT 0
    );
  `);
}

export async function saveScanLocally(scan: Omit<LocalScanQueueItem, 'is_synced'>): Promise<void> {
  if (Platform.OS === 'web') {
    mockWebMemoryQueue.push({ ...scan, is_synced: false });
    return;
  }
  const database = await getLocalDatabase();
  if (!database) return;
  await database.runAsync(
    `INSERT INTO pending_scans (local_id, exam_id, student_id, raw_score, max_score, percentage_score, items_json, scanned_at, is_synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
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
  try {
    if (Platform.OS === 'web') {
      const count = mockWebMemoryQueue.length;
      mockWebMemoryQueue = [];
      return { syncedCount: count, errors: 0 };
    }

    const database = await getLocalDatabase();
    if (!database) return { syncedCount: 0, errors: 0 };

    const rows = await database.getAllAsync<LocalScanQueueItem>(
      `SELECT * FROM pending_scans WHERE is_synced = 0`
    );

    if (!rows || rows.length === 0) {
      return { syncedCount: 0, errors: 0 };
    }

    let syncedCount = 0;
    let errors = 0;

    for (const row of rows) {
      const items = JSON.parse(row.items_json);

      const { data: scanData, error: scanErr } = await supabase
        .from('scan_results')
        .insert({
          exam_id: row.exam_id,
          student_id: row.student_id || null,
          raw_score: row.raw_score,
          max_score: row.max_score,
          percentage_score: row.percentage_score,
          scanned_at: row.scanned_at,
        })
        .select()
        .single();

      if (scanErr || !scanData) {
        errors++;
        continue;
      }

      if (items && items.length > 0) {
        const itemRows = items.map((it: any) => ({
          scan_result_id: scanData.id,
          question_number: it.question_number,
          detected_options: it.detected_options,
          is_correct: it.is_correct,
          is_ambiguous: it.is_ambiguous,
          fill_ratios: it.fill_ratios,
        }));

        await supabase.from('scan_item_details').insert(itemRows);
      }

      await database.runAsync(`UPDATE pending_scans SET is_synced = 1 WHERE local_id = ?`, [
        row.local_id,
      ]);
      syncedCount++;
    }

    return { syncedCount, errors };
  } catch (error) {
    console.error('Offline Sync Error:', error);
    return { syncedCount: 0, errors: 1 };
  }
}
