import { SQLiteDatabase } from 'expo-sqlite';
import { Folder, SyncStatus } from '../../types';

interface FolderRow {
  id: string;
  server_id: string | null;
  parent_id: string | null;
  name: string;
  path_cache: string | null;
  sync_status: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

function rowToFolder(row: FolderRow): Folder {
  return {
    id: row.id,
    serverId: row.server_id,
    parentId: row.parent_id,
    name: row.name,
    pathCache: row.path_cache,
    syncStatus: row.sync_status as SyncStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class FolderRepository {
  constructor(private db: SQLiteDatabase) {}

  async insert(folder: Folder): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO folders
         (id, server_id, parent_id, name, path_cache, sync_status, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        folder.id,
        folder.serverId,
        folder.parentId,
        folder.name,
        folder.pathCache,
        folder.syncStatus,
        folder.createdAt,
        folder.updatedAt,
        folder.deletedAt,
      ]
    );
  }

  async findById(id: string): Promise<Folder | null> {
    const row = await this.db.getFirstAsync<FolderRow>(
      'SELECT * FROM folders WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return row ? rowToFolder(row) : null;
  }

  async findByParent(parentId: string | null): Promise<Folder[]> {
    const rows = parentId
      ? await this.db.getAllAsync<FolderRow>(
          'SELECT * FROM folders WHERE parent_id = ? AND deleted_at IS NULL ORDER BY name ASC',
          [parentId]
        )
      : await this.db.getAllAsync<FolderRow>(
          'SELECT * FROM folders WHERE parent_id IS NULL AND deleted_at IS NULL ORDER BY name ASC'
        );
    return rows.map(rowToFolder);
  }

  async rename(id: string, name: string, syncStatus: SyncStatus, updatedAt: number): Promise<void> {
    await this.db.runAsync(
      'UPDATE folders SET name = ?, sync_status = ?, updated_at = ? WHERE id = ?',
      [name, syncStatus, updatedAt, id]
    );
  }

  async move(id: string, newParentId: string | null, syncStatus: SyncStatus, updatedAt: number): Promise<void> {
    await this.db.runAsync(
      'UPDATE folders SET parent_id = ?, sync_status = ?, updated_at = ? WHERE id = ?',
      [newParentId, syncStatus, updatedAt, id]
    );
  }

  async softDelete(id: string, deletedAt: number): Promise<void> {
    await this.db.runAsync(
      'UPDATE folders SET deleted_at = ?, sync_status = ? WHERE id = ?',
      [deletedAt, 'pending' satisfies SyncStatus, id]
    );
  }

  async updateServerId(clientId: string, serverId: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE folders SET server_id = ?, sync_status = ? WHERE id = ?',
      [serverId, 'synced' satisfies SyncStatus, clientId]
    );
  }

  async updateSyncStatus(id: string, status: SyncStatus): Promise<void> {
    await this.db.runAsync(
      'UPDATE folders SET sync_status = ? WHERE id = ?',
      [status, id]
    );
  }

  async search(query: string): Promise<Folder[]> {
    const rows = await this.db.getAllAsync<FolderRow>(
      "SELECT * FROM folders WHERE name LIKE ? AND deleted_at IS NULL ORDER BY name ASC",
      [`%${query}%`]
    );
    return rows.map(rowToFolder);
  }
}
