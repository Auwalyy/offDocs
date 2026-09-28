import { SQLiteDatabase } from 'expo-sqlite';

/**
 * Tail of the chain of transactions waiting to run. expo-sqlite shares one
 * connection, so two overlapping BEGINs fail ("cannot start a transaction
 * within a transaction") and the loser's ROLLBACK would undo the winner's
 * half-finished work, leaving a partial mutation. Transactions therefore
 * run one at a time.
 */
let queueTail: Promise<unknown> = Promise.resolve();

/**
 * Runs `fn` inside a SQLite transaction using explicit BEGIN/COMMIT/ROLLBACK.
 * expo-sqlite's withTransactionAsync uses execAsync internally which can
 * conflict with concurrent statements on Android. Manual transaction control
 * is more reliable.
 *
 * `fn` must not call withTransaction itself — it would wait on its own turn.
 */
export function withTransaction<T>(
  db: SQLiteDatabase,
  fn: () => Promise<T>
): Promise<T> {
  const run = queueTail.then(async () => {
    await db.runAsync('BEGIN');
    try {
      const result = await fn();
      await db.runAsync('COMMIT');
      return result;
    } catch (err) {
      // Report the original failure, not a secondary ROLLBACK error.
      await db.runAsync('ROLLBACK').catch(() => undefined);
      throw err;
    }
  });
  queueTail = run.catch(() => undefined);
  return run;
}
