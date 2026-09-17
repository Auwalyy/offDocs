import { SQLiteDatabase } from 'expo-sqlite';
import { Document, SyncStatus } from '../../types';

interface DocumentRow {
  id: string;
  server_id: string | null;
  folder_id: string;
  name: string;
  mime_type: string;
  local_uri: string | null;
  storage_key: string | null;
  file_size: number | null;
  content_hash: string | null;
  imported_at: number;
  updated_at: number;
  sync_status: string;
  deleted_at: number | null;
}

function rowToDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    serverId: row.server_id,
    folderId: row.folder_id,
    name: row.name,
    mimeType: row.mime_type,
    localUri: row.local_uri,
    storageKey: row.storage_key,
    fileSize: row.file_size,
    contentHash: row.content_hash,
    importedAt: row.imported_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status as SyncStatus,
    deletedAt: row.deleted_at,
  };
}

export class DocumentRepository {
  constructor(private db: SQLiteDatabase) {}

  async insert(doc: Document): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO documents
         (id, server_id, folder_id, name, mime_type, local_uri, storage_key,
          file_size, content_hash, imported_at, updated_at, sync_status, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        doc.id, doc.serverId, doc.folderId, doc.name, doc.mimeType,
        doc.localUri, doc.storageKey, doc.fileSize, doc.contentHash,
        doc.importedAt, doc.updatedAt, doc.syncStatus, doc.deletedAt,
      ]
    );
  }

  async findById(id: string): Promise<Document | null> {
    const row = await this.db.getFirstAsync<DocumentRow>(
      'SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return row ? rowToDocument(row) : null;
  }

  async findByFolder(folderId: string): Promise<Document[]> {
    const rows = await this.db.getAllAsync<DocumentRow>(
      'SELECT * FROM documents WHERE folder_id = ? AND deleted_at IS NULL ORDER BY name COLLATE NOCASE ASC',
      [folderId]
    );
    return rows.map(rowToDocument);
  }

  async findByFolders(folderIds: string[]): Promise<Document[]> {
    if (folderIds.length === 0) return [];
    const placeholders = folderIds.map(() => '?').join(', ');
    const rows = await this.db.getAllAsync<DocumentRow>(
      `SELECT * FROM documents WHERE folder_id IN (${placeholders}) AND deleted_at IS NULL`,
      folderIds
    );
    return rows.map(rowToDocument);
  }

  /** Finds a live document in the folder that looks like the same file (duplicate import). */
  async findDuplicate(folderId: string, name: string, fileSize: number): Promise<Document | null> {
    const row = await this.db.getFirstAsync<DocumentRow>(
      'SELECT * FROM documents WHERE folder_id = ? AND name = ? AND file_size = ? AND deleted_at IS NULL',
      [folderId, name, fileSize]
    );
    return row ? rowToDocument(row) : null;
  }

  async findByContentHash(hash: string): Promise<Document | null> {
    const row = await this.db.getFirstAsync<DocumentRow>(
      'SELECT * FROM documents WHERE content_hash = ? AND deleted_at IS NULL',
      [hash]
    );
    return row ? rowToDocument(row) : null;
  }

  async softDelete(id: string, deletedAt: number): Promise<void> {
    await this.db.runAsync(
      'UPDATE documents SET deleted_at = ?, sync_status = ? WHERE id = ?',
      [deletedAt, 'pending' satisfies SyncStatus, id]
    );
  }

  async updateServerId(clientId: string, serverId: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE documents SET server_id = ?, sync_status = ? WHERE id = ?',
      [serverId, 'synced' satisfies SyncStatus, clientId]
    );
  }

  async updateSyncStatus(id: string, status: SyncStatus): Promise<void> {
    await this.db.runAsync(
      'UPDATE documents SET sync_status = ? WHERE id = ?',
      [status, id]
    );
  }

  async updateFolderId(id: string, folderId: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE documents SET folder_id = ?, updated_at = ? WHERE id = ?',
      [folderId, Date.now(), id]
    );
  }

  async search(query: string): Promise<Document[]> {
    const rows = await this.db.getAllAsync<DocumentRow>(
      "SELECT * FROM documents WHERE name LIKE ? AND deleted_at IS NULL ORDER BY name ASC",
      [`%${query}%`]
    );
    return rows.map(rowToDocument);
  }
}
