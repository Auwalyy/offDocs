import { SQLiteDatabase } from 'expo-sqlite';

/**
 * Runs `fn` inside a SQLite transaction using explicit BEGIN/COMMIT/ROLLBACK.
 * expo-sqlite's withTransactionAsync uses execAsync internally which can
 * conflict with concurrent statements on Android. Manual transaction control
 * is more reliable.
 */
export async function withTransaction<T>(
  db: SQLiteDatabase,
  fn: () => Promise<T>
): Promise<T> {
  await db.runAsync('BEGIN');
  try {
    const result = await fn();
    await db.runAsync('COMMIT');
    return result;
  } catch (err) {
    await db.runAsync('ROLLBACK');
    throw err;
  }
}
