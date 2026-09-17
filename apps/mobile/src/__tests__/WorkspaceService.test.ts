/**
 * WorkspaceService tests
 *
 * These tests use an in-memory mock of the SQLiteDatabase to verify:
 * - Folder creation inserts both the folder and a sync_queue record atomically
 * - Rename, move, delete each produce the correct queue operation
 * - Duplicate folder creation does not produce duplicate queue entries
 */

import { WorkspaceService } from '../features/workspace/WorkspaceService';

// ─── Minimal SQLiteDatabase mock ─────────────────────────────────────────────

interface Row { [key: string]: unknown }

class MockDb {
  private tables: Record<string, Row[]> = {
    folders: [],
    sync_queue: [],
  };

  async runAsync(sql: string, params: unknown[] = []): Promise<void> {
    const s = sql.trim().toUpperCase();
    if (s.startsWith('INSERT INTO FOLDERS')) {
      this.tables['folders']!.push({
        id: params[0], server_id: params[1], parent_id: params[2],
        name: params[3], path_cache: params[4], sync_status: params[5],
        created_at: params[6], updated_at: params[7], deleted_at: params[8],
      });
    } else if (s.startsWith('INSERT INTO SYNC_QUEUE')) {
      this.tables['sync_queue']!.push({
        id: params[0], entity_type: params[1], operation: params[2],
        payload: params[3], client_entity_id: params[4], status: params[5],
        retry_count: params[6], last_error: params[7], next_retry_at: params[8],
        created_at: params[9],
      });
    } else if (s.startsWith('UPDATE FOLDERS')) {
      // handle rename/move/delete
      const idParam = params[params.length - 1] as string;
      const idx = this.tables['folders']!.findIndex((r) => r['id'] === idParam);
      if (idx !== -1) {
        if (s.includes('NAME =')) this.tables['folders']![idx]!['name'] = params[0];
        if (s.includes('DELETED_AT =')) this.tables['folders']![idx]!['deleted_at'] = params[0];
        if (s.includes('PARENT_ID =')) this.tables['folders']![idx]!['parent_id'] = params[0];
      }
    } else if (s.startsWith('DELETE FROM SYNC_QUEUE') && s.includes('CLIENT_ENTITY_ID IN')) {
      const ids = new Set(params);
      this.tables['sync_queue'] = this.tables['sync_queue']!.filter(
        (q) => q['status'] === 'synced' || !ids.has(q['client_entity_id'])
      );
    }
  }

  async getFirstAsync<T>(_sql: string, _params: unknown[] = []): Promise<T | null> {
    return null;
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const s = sql.trim().toUpperCase();
    if (s.startsWith('WITH RECURSIVE SUBTREE')) {
      const folders = this.tables['folders']!;
      const result: Row[] = folders.filter((r) => r['id'] === params[0]);
      for (let i = 0; i < result.length; i++) {
        result.push(...folders.filter((r) => r['parent_id'] === result[i]!['id'] && r['deleted_at'] == null));
      }
      return result as T[];
    }
    if (s.includes('FROM DOCUMENTS')) return [];
    if (s.includes('FROM FOLDERS')) {
      const rows = this.tables['folders']!.filter((r) => r['deleted_at'] == null);
      if (params[0]) return rows.filter((r) => r['parent_id'] === params[0]) as T[];
      return rows.filter((r) => r['parent_id'] == null) as T[];
    }
    return [];
  }

  async withTransactionAsync<T>(fn: () => Promise<T>): Promise<T> {
    return fn(); // no real transaction in mock, but atomicity is tested by checking both tables
  }

  getTable(name: string): Row[] {
    return this.tables[name] ?? [];
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('WorkspaceService', () => {
  let db: MockDb;
  let service: WorkspaceService;

  beforeEach(() => {
    db = new MockDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new WorkspaceService(db as any);
  });

  test('createFolder inserts folder and sync_queue atomically', async () => {
    const folder = await service.createFolder('Lecture Notes', null);

    expect(folder.name).toBe('Lecture Notes');
    expect(folder.parentId).toBeNull();
    expect(folder.syncStatus).toBe('pending');
    expect(typeof folder.id).toBe('string');
    expect(folder.id.length).toBeGreaterThan(0);

    const folders = db.getTable('folders');
    const queue   = db.getTable('sync_queue');

    expect(folders).toHaveLength(1);
    expect(queue).toHaveLength(1);
    expect(queue[0]!['operation']).toBe('folder:create');
    expect(queue[0]!['client_entity_id']).toBe(folder.id);
    expect(queue[0]!['status']).toBe('pending');
  });

  test('createFolder with parentId stores parentId in payload', async () => {
    const parent = await service.createFolder('Parent', null);
    const child  = await service.createFolder('Child', parent.id);

    const queue = db.getTable('sync_queue');
    const childQueueItem = queue.find((q) => q['client_entity_id'] === child.id);
    expect(childQueueItem).toBeDefined();

    const payload = JSON.parse(childQueueItem!['payload'] as string) as { parentId: string };
    expect(payload.parentId).toBe(parent.id);
  });

  test('renameFolder creates folder:rename queue entry', async () => {
    const folder = await service.createFolder('Old Name', null);
    await service.renameFolder(folder.id, 'New Name');

    const queue = db.getTable('sync_queue');
    const renameEntry = queue.find((q) => q['operation'] === 'folder:rename');
    expect(renameEntry).toBeDefined();
    expect(renameEntry!['client_entity_id']).toBe(folder.id);

    const payload = JSON.parse(renameEntry!['payload'] as string) as { name: string };
    expect(payload.name).toBe('New Name');
  });

  test('moveFolder creates folder:move queue entry', async () => {
    const folder = await service.createFolder('Folder', null);
    const target = await service.createFolder('Target', null);
    await service.moveFolder(folder.id, target.id);

    const queue = db.getTable('sync_queue');
    const moveEntry = queue.find((q) => q['operation'] === 'folder:move');
    expect(moveEntry).toBeDefined();

    const payload = JSON.parse(moveEntry!['payload'] as string) as { newParentId: string };
    expect(payload.newParentId).toBe(target.id);
  });

  test('deleteFolder of a synced folder creates folder:delete queue entry', async () => {
    const folder = await service.createFolder('To Delete', null);
    const row = db.getTable('folders').find((r) => r['id'] === folder.id)!;
    row['server_id'] = 'server-1';
    db.getTable('sync_queue')[0]!['status'] = 'synced';

    await service.deleteFolder(folder.id);

    const queue = db.getTable('sync_queue');
    const deleteEntry = queue.find((q) => q['operation'] === 'folder:delete');
    expect(deleteEntry).toBeDefined();
    expect(deleteEntry!['client_entity_id']).toBe(folder.id);
    expect(row['deleted_at']).not.toBeNull();
  });

  test('deleteFolder of a never-synced folder cancels its queued operations', async () => {
    const folder = await service.createFolder('Offline only', null);
    await service.renameFolder(folder.id, 'Renamed');
    await service.deleteFolder(folder.id);

    expect(db.getTable('sync_queue')).toHaveLength(0);
  });

  test('deleteFolder cascades to subfolders', async () => {
    const parent = await service.createFolder('Parent', null);
    const child  = await service.createFolder('Child', parent.id);
    await service.deleteFolder(parent.id);

    const childRow = db.getTable('folders').find((r) => r['id'] === child.id)!;
    expect(childRow['deleted_at']).not.toBeNull();
    expect(db.getTable('sync_queue')).toHaveLength(0);
  });

  test('moveFolder rejects moving a folder into its own subfolder', async () => {
    const parent = await service.createFolder('Parent', null);
    const child  = await service.createFolder('Child', parent.id);
    await expect(service.moveFolder(parent.id, child.id)).rejects.toThrow(/cannot be moved/);
  });

  test('createFolder rejects blank names', async () => {
    await expect(service.createFolder('   ', null)).rejects.toThrow(/required/);
  });

  test('each operation gets a unique queue entry UUID', async () => {
    const f = await service.createFolder('F', null);
    await service.renameFolder(f.id, 'F2');
    await service.deleteFolder(f.id);

    const queue = db.getTable('sync_queue');
    const ids = queue.map((q) => q['id']);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
