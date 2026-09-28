/**
 * Tables for favorites, tags, recent items, search history and preferences.
 * Column additions to folders/documents run separately (see schema.ts)
 * because SQLite has no ADD COLUMN IF NOT EXISTS.
 */
export const migration_004 = `
CREATE TABLE IF NOT EXISTS tags (
  id         TEXT PRIMARY KEY NOT NULL,
  name       TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS document_tags (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (document_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag_id);

CREATE TABLE IF NOT EXISTS recent_items (
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  action      TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_recent_occurred ON recent_items(occurred_at);

CREATE TABLE IF NOT EXISTS search_history (
  query   TEXT PRIMARY KEY NOT NULL COLLATE NOCASE,
  used_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS preferences (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_folders_favorite   ON folders(is_favorite);
CREATE INDEX IF NOT EXISTS idx_documents_favorite ON documents(is_favorite);
`;
