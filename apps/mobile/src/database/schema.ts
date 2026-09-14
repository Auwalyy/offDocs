import { SQLiteDatabase } from 'expo-sqlite';
import { migration_001 } from './migrations/001_initial_schema';

interface Migration {
  version: number;
  name: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  { version: 1, name: '001_initial_schema', sql: migration_001 },
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY NOT NULL,
      name       TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const applied = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC'
  );
  const appliedVersions = new Set(applied.map((r) => r.version));

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue;

    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
      await db.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        [migration.version, migration.name, Date.now()]
      );
    });
  }
}
