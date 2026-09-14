export const migration_001 = `
CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY NOT NULL,
  email            TEXT UNIQUE NOT NULL,
  display_name     TEXT NOT NULL,
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at INTEGER,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS folders (
  id          TEXT PRIMARY KEY NOT NULL,
  server_id   TEXT,
  parent_id   TEXT REFERENCES folders(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  path_cache  TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_sync   ON folders(sync_status);

CREATE TABLE IF NOT EXISTS documents (
  id           TEXT PRIMARY KEY NOT NULL,
  server_id    TEXT,
  folder_id    TEXT NOT NULL REFERENCES folders(id) ON DELETE RESTRICT,
  name         TEXT NOT NULL,
  mime_type    TEXT NOT NULL,
  local_uri    TEXT,
  storage_key  TEXT,
  file_size    INTEGER,
  content_hash TEXT,
  imported_at  INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  sync_status  TEXT NOT NULL DEFAULT 'pending',
  deleted_at   INTEGER
);

CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_sync   ON documents(sync_status);

CREATE TABLE IF NOT EXISTS sync_queue (
  id               TEXT PRIMARY KEY NOT NULL,
  entity_type      TEXT NOT NULL,
  operation        TEXT NOT NULL,
  payload          TEXT NOT NULL,
  client_entity_id TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  retry_count      INTEGER NOT NULL DEFAULT 0,
  last_error       TEXT,
  next_retry_at    INTEGER,
  created_at       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_queue_status       ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_next_retry   ON sync_queue(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_queue_entity       ON sync_queue(client_entity_id);
`;
