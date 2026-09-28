/**
 * withTransaction tests
 *
 * The mock rejects a BEGIN while a transaction is open, like SQLite does, and
 * records every statement so the tests can check transactions never overlap.
 */

import { SQLiteDatabase } from 'expo-sqlite';
import { withTransaction } from '../database/transaction';

class MockDb {
  log: string[] = [];
  private open = false;

  async runAsync(sql: string): Promise<void> {
    await Promise.resolve(); // yield, so overlapping callers can interleave
    if (sql === 'BEGIN') {
      if (this.open) throw new Error('cannot start a transaction within a transaction');
      this.open = true;
    } else if (sql === 'COMMIT' || sql === 'ROLLBACK') {
      if (!this.open) throw new Error('cannot commit - no transaction is active');
      this.open = false;
    }
    this.log.push(sql);
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('withTransaction', () => {
  it('runs overlapping transactions one after another', async () => {
    const mock = new MockDb();
    const db = mock as unknown as SQLiteDatabase;

    await Promise.all([
      withTransaction(db, async () => {
        await mock.runAsync('A1');
        await tick();
        await mock.runAsync('A2');
      }),
      withTransaction(db, async () => {
        await mock.runAsync('B1');
      }),
    ]);

    expect(mock.log).toEqual(['BEGIN', 'A1', 'A2', 'COMMIT', 'BEGIN', 'B1', 'COMMIT']);
  });

  it('rolls back a failed transaction without blocking the next one', async () => {
    const mock = new MockDb();
    const db = mock as unknown as SQLiteDatabase;

    const failing = withTransaction(db, async () => {
      await mock.runAsync('A1');
      throw new Error('boom');
    });
    const next = withTransaction(db, async () => {
      await mock.runAsync('B1');
      return 'ok';
    });

    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
    expect(mock.log).toEqual(['BEGIN', 'A1', 'ROLLBACK', 'BEGIN', 'B1', 'COMMIT']);
  });
});
