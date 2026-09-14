import { SQLiteDatabase } from 'expo-sqlite';

/**
 * Runs `fn` inside a single SQLite transaction.
 * Both the entity mutation and sync_queue insertion must use this
 * to guarantee they are committed atomically.
 */
export async function withTransaction<T>(
  db: SQLiteDatabase,
  fn: () => Promise<T>
): Promise<T> {
  return db.withTransactionAsync(fn);
}
