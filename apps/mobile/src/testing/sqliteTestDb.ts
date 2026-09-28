/**
 * An in-memory SQLite database (Node's built-in node:sqlite) exposing the
 * subset of expo-sqlite's async API the app uses, so repositories and
 * migrations run real SQL in tests.
 */
import { SQLiteDatabase } from 'expo-sqlite';
import { runMigrations } from '../database/schema';

type Param = string | number | null;

interface StatementSync {
  run(...params: Param[]): unknown;
  all(...params: Param[]): unknown[];
  get(...params: Param[]): unknown;
}

interface DatabaseSync {
  exec(sql: string): void;
  prepare(sql: string): StatementSync;
}

function normalize(params: unknown[] = []): Param[] {
  return params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : (p as Param)));
}

/** node:sqlite returns null-prototype objects; copy them so Jest's toEqual matches plain objects. */
function plain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}

export async function createTestDb(): Promise<SQLiteDatabase> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => DatabaseSync };
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON;');

  const db = {
    async execAsync(sql: string) {
      raw.exec(sql);
    },
    async runAsync(sql: string, params: unknown[] = []) {
      raw.prepare(sql).run(...normalize(params));
    },
    async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      return raw.prepare(sql).all(...normalize(params)).map((r) => plain<T>(r));
    },
    async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      const row = raw.prepare(sql).get(...normalize(params));
      return row ? plain<T>(row) : null;
    },
  } as unknown as SQLiteDatabase;

  await runMigrations(db);
  return db;
}
