import { SQLiteDatabase } from 'expo-sqlite';
import { Document, DocumentHit, Folder, SearchFilter, SearchResults } from '../../types';
import { splitTagList, TAG_SEPARATOR } from '../tags/TagRepository';

export const MAX_SEARCH_RESULTS = 50;
export const MAX_SEARCH_HISTORY = 15;

const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Words a student might type to mean a file type, mapped to MIME types. */
const TYPE_WORDS: Record<string, string> = {
  pdf: PDF,
  docx: DOCX,
  doc: DOCX,
  word: DOCX,
};

/** Escapes LIKE wildcards so "100%" or "file_1" match literally (used with ESCAPE '\'). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** MIME types whose type word starts with the query ("pd" → PDF). Needs 2+ characters. */
export function mimeTypesForQuery(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const mimes = new Set<string>();
  for (const [word, mime] of Object.entries(TYPE_WORDS)) {
    if (word.startsWith(q)) mimes.add(mime);
  }
  return [...mimes];
}

interface FolderRow {
  id: string; server_id: string | null; parent_id: string | null; name: string; path_cache: string | null;
  color: string | null; icon: string | null; is_favorite: number; sync_status: string;
  created_at: number; updated_at: number; deleted_at: number | null;
}

interface DocumentRow {
  id: string; server_id: string | null; folder_id: string; name: string; mime_type: string;
  local_uri: string | null; storage_key: string | null; file_size: number | null; content_hash: string | null;
  imported_at: number; updated_at: number; is_favorite: number; sync_status: string; deleted_at: number | null;
  folder_name: string | null; tag_names: string | null;
}

function toFolder(r: FolderRow): Folder {
  return {
    id: r.id, serverId: r.server_id, parentId: r.parent_id, name: r.name, pathCache: r.path_cache,
    color: r.color, icon: r.icon, isFavorite: r.is_favorite === 1, syncStatus: r.sync_status as Folder['syncStatus'],
    createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at,
  };
}

function toDocumentHit(r: DocumentRow): DocumentHit {
  return {
    id: r.id, serverId: r.server_id, folderId: r.folder_id, name: r.name, mimeType: r.mime_type,
    localUri: r.local_uri, storageKey: r.storage_key, fileSize: r.file_size, contentHash: r.content_hash,
    importedAt: r.imported_at, updatedAt: r.updated_at, isFavorite: r.is_favorite === 1,
    syncStatus: r.sync_status as Document['syncStatus'], deletedAt: r.deleted_at,
    folderName: r.folder_name, tags: splitTagList(r.tag_names),
  };
}

/**
 * Offline search over the local database. Matching is case-insensitive and
 * partial (LIKE '%query%'); names that start with the query rank first.
 */
export class SearchService {
  constructor(private db: SQLiteDatabase) {}

  async search(query: string, filter: SearchFilter = 'all'): Promise<SearchResults> {
    const q = query.trim();
    if (!q) return { folders: [], documents: [] };

    const [folders, documents] = await Promise.all([
      filter === 'documents' ? [] : this.searchFolders(q, filter),
      filter === 'folders' ? [] : this.searchDocuments(q, filter),
    ]);
    return { folders, documents };
  }

  private async searchFolders(q: string, filter: SearchFilter): Promise<Folder[]> {
    const like = `%${escapeLike(q)}%`;
    const prefix = `${escapeLike(q)}%`;
    const extra =
      filter === 'favorites' ? 'AND is_favorite = 1'
      : filter === 'recent' ? "AND id IN (SELECT entity_id FROM recent_items WHERE entity_type = 'folder')"
      : '';
    const rows = await this.db.getAllAsync<FolderRow>(
      `SELECT * FROM folders
        WHERE deleted_at IS NULL AND name LIKE ? ESCAPE '\\' ${extra}
        ORDER BY CASE WHEN name LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, name COLLATE NOCASE ASC
        LIMIT ?`,
      [like, prefix, MAX_SEARCH_RESULTS]
    );
    return rows.map(toFolder);
  }

  private async searchDocuments(q: string, filter: SearchFilter): Promise<DocumentHit[]> {
    const like = `%${escapeLike(q)}%`;
    const prefix = `${escapeLike(q)}%`;
    const mimes = mimeTypesForQuery(q);
    const mimeClause = mimes.length ? `OR d.mime_type IN (${mimes.map(() => '?').join(', ')})` : '';
    const extra =
      filter === 'favorites' ? 'AND d.is_favorite = 1'
      : filter === 'recent' ? "AND d.id IN (SELECT entity_id FROM recent_items WHERE entity_type = 'document')"
      : '';
    const rows = await this.db.getAllAsync<DocumentRow>(
      `SELECT d.*, f.name AS folder_name,
              (SELECT group_concat(t.name, ?) FROM document_tags dt JOIN tags t ON t.id = dt.tag_id
                WHERE dt.document_id = d.id) AS tag_names
         FROM documents d
         LEFT JOIN folders f ON f.id = d.folder_id
        WHERE d.deleted_at IS NULL ${extra}
          AND (
            d.name LIKE ? ESCAPE '\\'
            ${mimeClause}
            OR EXISTS (
              SELECT 1 FROM document_tags dt JOIN tags t ON t.id = dt.tag_id
               WHERE dt.document_id = d.id AND t.name LIKE ? ESCAPE '\\'
            )
          )
        ORDER BY CASE WHEN d.name LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, d.name COLLATE NOCASE ASC
        LIMIT ?`,
      [TAG_SEPARATOR, like, ...mimes, like, prefix, MAX_SEARCH_RESULTS]
    );
    return rows.map(toDocumentHit);
  }

  // ─── History ───────────────────────────────────────────────────────────────

  async addToHistory(query: string, at = Date.now()): Promise<void> {
    const q = query.trim();
    if (!q) return;
    await this.db.runAsync(
      `INSERT INTO search_history (query, used_at) VALUES (?, ?)
       ON CONFLICT(query) DO UPDATE SET query = excluded.query, used_at = excluded.used_at`,
      [q, at]
    );
    await this.db.runAsync(
      `DELETE FROM search_history WHERE query NOT IN (
         SELECT query FROM search_history ORDER BY used_at DESC LIMIT ?
       )`,
      [MAX_SEARCH_HISTORY]
    );
  }

  async getHistory(): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ query: string }>(
      'SELECT query FROM search_history ORDER BY used_at DESC LIMIT ?',
      [MAX_SEARCH_HISTORY]
    );
    return rows.map((r) => r.query);
  }

  async removeFromHistory(query: string): Promise<void> {
    await this.db.runAsync('DELETE FROM search_history WHERE query = ?', [query]);
  }

  async clearHistory(): Promise<void> {
    await this.db.runAsync('DELETE FROM search_history');
  }
}
