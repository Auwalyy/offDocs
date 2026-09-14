import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('foliosync.db');
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  await _db.execAsync('PRAGMA foreign_keys = ON;');
  return _db;
}
