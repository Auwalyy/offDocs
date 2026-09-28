import { SQLiteDatabase } from 'expo-sqlite';
import { migration_001 } from './migrations/001_initial_schema';
import { migration_004 } from './migrations/004_organization';

type MigrationFn = (db: SQLiteDatabase) => Promise<void>;

interface Migration {
  version: number;
  name: string;
  run: MigrationFn;
}

function sql(statement: string): MigrationFn {
  return (db) => db.execAsync(statement);
}

/**
 * Safely adds a column only if it doesn't already exist.
 * SQLite does not support ALTER TABLE ADD COLUMN IF NOT EXISTS.
 */
async function addColumnIfMissing(
  db: SQLiteDatabase,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  const rows = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`
  );
  const exists = rows.some((r) => r.name === column);
  if (!exists) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '001_initial_schema',
    run: sql(migration_001),
  },
  {
    version: 2,
    name: '002_add_next_retry_at',
    run: (db) => addColumnIfMissing(db, 'sync_queue', 'next_retry_at', 'INTEGER'),
  },
  {
    // Tokens belong in SecureStore only; remove copies that older builds wrote here.
    version: 3,
    name: '003_scrub_tokens_from_users',
    run: sql('UPDATE users SET access_token = NULL, refresh_token = NULL;'),
  },
  {
    // Every step is idempotent, so a migration interrupted halfway can simply rerun.
    version: 4,
    name: '004_organization',
    run: async (db) => {
      await addColumnIfMissing(db, 'folders', 'color', 'TEXT');
      await addColumnIfMissing(db, 'folders', 'icon', 'TEXT');
      await addColumnIfMissing(db, 'folders', 'is_favorite', 'INTEGER NOT NULL DEFAULT 0');
      await addColumnIfMissing(db, 'documents', 'is_favorite', 'INTEGER NOT NULL DEFAULT 0');
      await db.execAsync(migration_004);
    },
  },
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

    // DDL statements (ALTER TABLE) cannot run inside a transaction on Android.
    // Run the migration SQL first, then record it in a transaction.
    await migration.run(db);
    await db.runAsync(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
      [migration.version, migration.name, Date.now()]
    );
  }
}
