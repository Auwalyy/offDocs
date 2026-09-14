import { SQLiteDatabase } from 'expo-sqlite';
import { SyncQueueItem, SyncStatus } from '../types';

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

  async deleteByEntityId(clientEntityId: string): Promise<void> {
    await this.db.runAsync(
      'DELETE FROM sync_queue WHERE client_entity_id = ?',
      [clientEntityId]
    );
  }
}
