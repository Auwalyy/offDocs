import * as SQLite from 'expo-sqlite';

const DB_NAME = 'foliosync.db';
let _db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  await _db.execAsync('PRAGMA foreign_keys = ON;');
  return _db;
}

/**
 * Deletes the local database file and reopens a fresh one.
 * Used as a recovery mechanism when the schema is irrecoverably corrupt.
 */
export async function resetDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) {
    await _db.closeAsync();
    _db = null;
  }
  await SQLite.deleteDatabaseAsync(DB_NAME);
  return getDatabase();
}
