import { SQLiteDatabase } from 'expo-sqlite';
import { SyncQueueItem, SyncStatus } from '../../types';

interface QueueRow {
  id: string;
  entity_type: string;
  operation: string;
  payload: string;
  client_entity_id: string;
  status: string;
  retry_count: number;
  last_error: string | null;
  next_retry_at: number | null;
  created_at: number;
}

function rowToItem(row: QueueRow): SyncQueueItem {
  return {
    id: row.id,
    entityType: row.entity_type as SyncQueueItem['entityType'],
    operation: row.operation as SyncQueueItem['operation'],
    payload: row.payload,
    clientEntityId: row.client_entity_id,
    status: row.status as SyncStatus,
    retryCount: row.retry_count,
    lastError: row.last_error,
    nextRetryAt: row.next_retry_at,
    createdAt: row.created_at,
  };
}

export class SyncQueueRepository {
  constructor(private db: SQLiteDatabase) {}

  async insert(item: SyncQueueItem): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO sync_queue
         (id, entity_type, operation, payload, client_entity_id,
          status, retry_count, last_error, next_retry_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id, item.entityType, item.operation, item.payload,
        item.clientEntityId, item.status, item.retryCount,
        item.lastError, item.nextRetryAt, item.createdAt,
      ]
    );
  }

  async getPending(now: number): Promise<SyncQueueItem[]> {
    const rows = await this.db.getAllAsync<QueueRow>(
      `SELECT * FROM sync_queue
       WHERE status IN ('pending', 'failed')
         AND (next_retry_at IS NULL OR next_retry_at <= ?)
       ORDER BY created_at ASC`,
      [now]
    );
    return rows.map(rowToItem);
  }

  async getAll(): Promise<SyncQueueItem[]> {
    const rows = await this.db.getAllAsync<QueueRow>(
      'SELECT * FROM sync_queue ORDER BY created_at DESC'
    );
    return rows.map(rowToItem);
  }

  /** Recent queue items with the name of the folder/document they refer to. */
  async getRecentActivity(limit = 200): Promise<(SyncQueueItem & { entityName: string | null })[]> {
    const rows = await this.db.getAllAsync<QueueRow & { entity_name: string | null }>(
      `SELECT q.*, COALESCE(f.name, d.name) AS entity_name
         FROM sync_queue q
         LEFT JOIN folders f   ON q.entity_type = 'folder'   AND f.id = q.client_entity_id
         LEFT JOIN documents d ON q.entity_type = 'document' AND d.id = q.client_entity_id
        ORDER BY
          CASE q.status WHEN 'needs_attention' THEN 0 WHEN 'failed' THEN 1 WHEN 'syncing' THEN 2 WHEN 'pending' THEN 3 ELSE 4 END,
          q.created_at DESC
        LIMIT ?`,
      [limit]
    );
    return rows.map((row) => ({ ...rowToItem(row), entityName: row.entity_name }));
  }

  async markSyncing(id: string): Promise<void> {
    await this.db.runAsync(
      "UPDATE sync_queue SET status = 'syncing' WHERE id = ?",
      [id]
    );
  }

  async markSynced(id: string): Promise<void> {
    await this.db.runAsync(
      "UPDATE sync_queue SET status = 'synced' WHERE id = ?",
      [id]
    );
  }

  async markFailed(id: string, error: string, retryCount: number, nextRetryAt: number | null): Promise<void> {
    const status: SyncStatus = nextRetryAt ? 'failed' : 'needs_attention';
    await this.db.runAsync(
      'UPDATE sync_queue SET status = ?, last_error = ?, retry_count = ?, next_retry_at = ? WHERE id = ?',
      [status, error, retryCount, nextRetryAt, id]
    );
  }

  async getFailedCount(): Promise<number> {
    const row = await this.db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM sync_queue WHERE status IN ('failed', 'needs_attention')"
    );
    return row?.count ?? 0;
  }

  /**
   * Items left in 'syncing' belong to a sync that was interrupted (app killed,
   * crash). Put them back in the queue so they are not stuck forever.
   */
  async resetInterrupted(): Promise<void> {
    await this.db.runAsync("UPDATE sync_queue SET status = 'pending' WHERE status = 'syncing'");
  }

  /** Leaves an item pending without consuming a retry (e.g. waiting on its parent). */
  async markWaiting(id: string, reason: string): Promise<void> {
    await this.db.runAsync(
      "UPDATE sync_queue SET status = 'pending', last_error = ? WHERE id = ?",
      [reason, id]
    );
  }

  /** Makes every failed / needs-attention item eligible for an immediate retry. */
  async retryFailed(): Promise<void> {
    await this.db.runAsync(
      `UPDATE sync_queue
         SET status = 'pending', retry_count = 0, next_retry_at = NULL, last_error = NULL
       WHERE status IN ('failed', 'needs_attention')`
    );
  }

  /** Removes synced history older than `olderThan` (ms epoch). */
  async pruneSynced(olderThan: number): Promise<void> {
    await this.db.runAsync(
      "DELETE FROM sync_queue WHERE status = 'synced' AND created_at < ?",
      [olderThan]
    );
  }

  /** Drops queued operations that have not reached the server yet for the given entities. */
  async deleteUnsyncedForEntities(clientEntityIds: string[]): Promise<void> {
    if (clientEntityIds.length === 0) return;
    const placeholders = clientEntityIds.map(() => '?').join(', ');
    await this.db.runAsync(
      `DELETE FROM sync_queue WHERE status != 'synced' AND client_entity_id IN (${placeholders})`,
      clientEntityIds
    );
  }

  async deleteAll(): Promise<void> {
    await this.db.runAsync('DELETE FROM sync_queue');
  }

  async deleteByEntityId(clientEntityId: string): Promise<void> {
    await this.db.runAsync(
      'DELETE FROM sync_queue WHERE client_entity_id = ?',
      [clientEntityId]
    );
  }
}
