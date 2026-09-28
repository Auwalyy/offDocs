import { SQLiteDatabase } from 'expo-sqlite';
import uuid from 'react-native-uuid';
import { TagSummary } from '../../types';

export const MAX_TAG_LENGTH = 40;
export const MAX_TAGS_PER_DOCUMENT = 20;

/** Separator used with group_concat; cannot appear in a tag typed on a keyboard. */
export const TAG_SEPARATOR = '\u001f';

/**
 * Trims, drops empties and removes case-insensitive duplicates (keeping the
 * first spelling). Throws on tags that are too long or too many.
 */
export function normalizeTags(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, ' ');
    if (!name) continue;
    if (name.length > MAX_TAG_LENGTH) throw new Error(`Tags must be at most ${MAX_TAG_LENGTH} characters.`);
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  if (result.length > MAX_TAGS_PER_DOCUMENT) {
    throw new Error(`A document can have at most ${MAX_TAGS_PER_DOCUMENT} tags.`);
  }
  return result;
}

export function splitTagList(value: string | null): string[] {
  return value ? value.split(TAG_SEPARATOR) : [];
}

export class TagRepository {
  constructor(private db: SQLiteDatabase) {}

  /** Replaces the document's tags. `names` must already be normalized. */
  async setDocumentTags(documentId: string, names: string[], now: number): Promise<void> {
    await this.db.runAsync('DELETE FROM document_tags WHERE document_id = ?', [documentId]);
    for (const name of names) {
      // The UNIQUE COLLATE NOCASE constraint makes "exam" reuse an existing "Exam" tag.
      await this.db.runAsync(
        'INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?) ON CONFLICT(name) DO NOTHING',
        [uuid.v4() as string, name, now]
      );
      await this.db.runAsync(
        `INSERT OR IGNORE INTO document_tags (document_id, tag_id, created_at)
         SELECT ?, id, ? FROM tags WHERE name = ?`,
        [documentId, now, name]
      );
    }
  }

  async getForDocument(documentId: string): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ name: string }>(
      `SELECT t.name FROM document_tags dt JOIN tags t ON t.id = dt.tag_id
        WHERE dt.document_id = ? ORDER BY dt.rowid ASC`,
      [documentId]
    );
    return rows.map((r) => r.name);
  }

  /** Tags for many documents at once, keyed by document id. */
  async getForDocuments(documentIds: string[]): Promise<Record<string, string[]>> {
    const result: Record<string, string[]> = {};
    if (documentIds.length === 0) return result;
    const placeholders = documentIds.map(() => '?').join(', ');
    const rows = await this.db.getAllAsync<{ document_id: string; name: string }>(
      `SELECT dt.document_id, t.name FROM document_tags dt JOIN tags t ON t.id = dt.tag_id
        WHERE dt.document_id IN (${placeholders})
        ORDER BY dt.rowid ASC`,
      documentIds
    );
    for (const r of rows) (result[r.document_id] ??= []).push(r.name);
    return result;
  }

  /** Tags in use on live documents, most used first. */
  async getAll(): Promise<TagSummary[]> {
    const rows = await this.db.getAllAsync<{ name: string; document_count: number }>(
      `SELECT t.name, COUNT(d.id) AS document_count
         FROM tags t
         JOIN document_tags dt ON dt.tag_id = t.id
         JOIN documents d ON d.id = dt.document_id AND d.deleted_at IS NULL
        GROUP BY t.id
        ORDER BY document_count DESC, t.name COLLATE NOCASE ASC`
    );
    return rows.map((r) => ({ name: r.name, documentCount: r.document_count }));
  }
}
