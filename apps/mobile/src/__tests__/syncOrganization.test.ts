/**
 * The sync engine sends favorite, tag and folder-style updates with the
 * server ids, in order, after their entity exists on the server.
 */

import { createTestDb } from '../testing/sqliteTestDb';
import { SyncEngine } from '../lib/SyncEngine';
import { apiClient } from '../api/client';
import { WorkspaceService } from '../features/workspace/WorkspaceService';
import { OrganizationService } from '../features/favorites/OrganizationService';
import { SyncQueueRepository } from '../features/sync/SyncQueueRepository';

jest.mock('expo-file-system/legacy', () => ({ deleteAsync: jest.fn().mockResolvedValue(undefined) }));

afterEach(() => jest.restoreAllMocks());

test('organization updates reach the server with server ids and leave the queue resolved', async () => {
  const db = await createTestDb();
  const workspace = new WorkspaceService(db);
  const org = new OrganizationService(db);
  const queue = new SyncQueueRepository(db);

  const post = jest.spyOn(apiClient, 'post').mockImplementation(async (_path, body) => ({
    data: { clientId: (body as { clientId: string }).clientId, serverId: 'srv-folder' },
  }));
  const patch = jest.spyOn(apiClient, 'patch').mockResolvedValue({ data: {} });

  const folder = await workspace.createFolder('CSC 421', null);
  await db.runAsync(
    `INSERT INTO documents (id, server_id, folder_id, name, mime_type, local_uri, storage_key, file_size, content_hash, imported_at, updated_at, sync_status, deleted_at)
     VALUES ('d1', 'srv-doc', ?, 'Notes.pdf', 'application/pdf', NULL, 'k', 10, NULL, 1, 1, 'synced', NULL)`,
    [folder.id]
  );
  await org.setFavorite('folder', folder.id, true);
  await org.setFolderStyle(folder.id, { color: '#16A34A', icon: '📐' });
  await org.setDocumentTags('d1', ['Exam', 'CSC 421']);
  await org.setFavorite('document', 'd1', true);

  const summary = await new SyncEngine(db).sync();

  expect(summary).toEqual({ processed: 5, failed: 0 });
  expect(post).toHaveBeenCalledTimes(1);
  expect(patch.mock.calls.map(([path, body]) => [path, body])).toEqual([
    ['/folders/srv-folder', { isFavorite: true }],
    ['/folders/srv-folder', { color: '#16A34A', icon: '📐' }],
    ['/documents/srv-doc', { tags: ['Exam', 'CSC 421'] }],
    ['/documents/srv-doc', { isFavorite: true }],
  ]);
  // Every request carries its queue item's id as the idempotency key.
  const pending = await queue.getAll();
  expect(pending.every((q) => q.status === 'synced')).toBe(true);
  expect(new Set(patch.mock.calls.map((c) => c[2])).size).toBe(4);
  expect((await workspace.getFolder(folder.id))!.syncStatus).toBe('synced');
});

test('an update for an entity not yet on the server waits instead of failing', async () => {
  const db = await createTestDb();
  const workspace = new WorkspaceService(db);
  const org = new OrganizationService(db);
  const queue = new SyncQueueRepository(db);

  jest.spyOn(apiClient, 'post').mockRejectedValue(new Error('offline'));
  const patch = jest.spyOn(apiClient, 'patch');

  const folder = await workspace.createFolder('A', null);
  await org.setFavorite('folder', folder.id, true);
  await new SyncEngine(db).sync();

  expect(patch).not.toHaveBeenCalled();
  const fav = (await queue.getAll()).find((q) => q.operation === 'favorite:update')!;
  expect(fav.status).toBe('pending');
  expect(fav.retryCount).toBe(0);
  expect(fav.lastError).toMatch(/Waiting for folder/);
});
