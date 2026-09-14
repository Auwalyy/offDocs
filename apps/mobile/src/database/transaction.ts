import { SQLiteDatabase } from 'expo-sqlite';

/**
 * Runs `fn` inside a single SQLite transaction.
 * Both the entity mutation and sync_queue insertion must use this
 * to guarantee they are committed atomically.
 *
 * Note: expo-sqlite's withTransactionAsync callback must return void,
 * so we capture the result via a closure.
 */
export async function withTransaction<T>(
  db: SQLiteDatabase,
  fn: () => Promise<T>
): Promise<T> {
  let result: T;
  await db.withTransactionAsync(async () => {
    result = await fn();
  });
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return result!;
}
