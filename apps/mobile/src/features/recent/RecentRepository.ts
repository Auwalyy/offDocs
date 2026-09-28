import { SQLiteDatabase } from 'expo-sqlite';
import { EntityType, RecentAction, RecentItem } from '../../types';

/** Older entries are pruned so the table never grows without bound. */
export const MAX_RECENT_ITEMS = 50;

interface RecentRow {
  entity_type: EntityType;
  entity_id: string;
  action: RecentAction;
  occurred_at: number;
  name: string;
  mime_type: string | null;
  file_size: number | null;
  updated_at: number;
  location_name: string | null;
  color: string | null;
  icon: string | null;
}

export class RecentRepository {
  constructor(private db: SQLiteDatabase) {}

  /** Records that an item was opened/imported/modified, keeping only its latest action. */
  async record(entityType: EntityType, entityId: string, action: RecentAction, at = Date.now()): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO recent_items (entity_type, entity_id, action, occurred_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(entity_type, entity_id) DO UPDATE SET action = excluded.action, occurred_at = excluded.occurred_at`,
      [entityType, entityId, action, at]
    );
    await this.db.runAsync(
      `DELETE FROM recent_items WHERE rowid NOT IN (
         SELECT rowid FROM recent_items ORDER BY occurred_at DESC LIMIT ?
       )`,
      [MAX_RECENT_ITEMS]
    );
  }

  /** Recent items whose folder/document still exists, newest first. */
  async list(options: { entityType?: EntityType; limit?: number } = {}): Promise<RecentItem[]> {
    const limit = options.limit ?? MAX_RECENT_ITEMS;
    const typeFilter = options.entityType ? 'AND r.entity_type = ?' : '';
    const params: (string | number)[] = options.entityType ? [options.entityType, limit] : [limit];
    const rows = await this.db.getAllAsync<RecentRow>(
      `SELECT r.entity_type, r.entity_id, r.action, r.occurred_at,
              COALESCE(d.name, f.name)             AS name,
              d.mime_type                          AS mime_type,
              d.file_size                          AS file_size,
              COALESCE(d.updated_at, f.updated_at) AS updated_at,
              COALESCE(df.name, fp.name)           AS location_name,
              f.color                              AS color,
              f.icon                               AS icon
         FROM recent_items r
         LEFT JOIN documents d ON r.entity_type = 'document' AND d.id = r.entity_id AND d.deleted_at IS NULL
         LEFT JOIN folders  df ON df.id = d.folder_id
         LEFT JOIN folders  f  ON r.entity_type = 'folder' AND f.id = r.entity_id AND f.deleted_at IS NULL
         LEFT JOIN folders  fp ON fp.id = f.parent_id
        WHERE (d.id IS NOT NULL OR f.id IS NOT NULL) ${typeFilter}
        ORDER BY r.occurred_at DESC
        LIMIT ?`,
      params
    );
    return rows.map((r) => ({
      entityType: r.entity_type,
      entityId: r.entity_id,
      action: r.action,
      occurredAt: r.occurred_at,
      name: r.name,
      mimeType: r.mime_type,
      fileSize: r.file_size,
      updatedAt: r.updated_at,
      locationName: r.location_name,
      color: r.color,
      icon: r.icon,
    }));
  }

  async remove(entityType: EntityType, entityId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM recent_items WHERE entity_type = ? AND entity_id = ?', [entityType, entityId]);
  }

  async clear(): Promise<void> {
    await this.db.runAsync('DELETE FROM recent_items');
  }
}
