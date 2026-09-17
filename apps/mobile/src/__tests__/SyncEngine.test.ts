/**
 * SyncEngine tests
 *
 * Tests dependency-aware ordering and retry/backoff behavior of the real
 * SyncEngine without requiring a real SQLite database or network.
 */

import { SyncEngine, nextRetryAt } from '../lib/SyncEngine';
import { ApiError } from '../api/client';
import { SyncQueueItem } from '../types';

function makeItem(id: string, operation: SyncQueueItem['operation'], payload: object): SyncQueueItem {
  return {
    id, operation, payload: JSON.stringify(payload),
    clientEntityId: id, entityType: operation.startsWith('folder') ? 'folder' : 'document',
    status: 'pending', retryCount: 0, lastError: null, nextRetryAt: null, createdAt: Date.now(),
  };
}

function engineWith(serverIdMap: Record<string, string>): SyncEngine {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engine = new SyncEngine({} as any);
  (engine as unknown as { serverIdMap: Record<string, string> }).serverIdMap = serverIdMap;
  return engine;
}

describe('SyncEngine — dependency ordering', () => {
  test('root folder (no parent) is not deferred', () => {
    const items = [makeItem('A', 'folder:create', { clientId: 'A', name: 'Root', parentId: null })];
    expect(engineWith({}).orderByDependency(items)[0]!.id).toBe('A');
  });

  test('child is deferred when parent has no serverId', () => {
    const items = [
      makeItem('B', 'folder:create', { clientId: 'B', name: 'Child', parentId: 'A' }),
      makeItem('A', 'folder:create', { clientId: 'A', name: 'Parent', parentId: null }),
    ];
    const ordered = engineWith({}).orderByDependency(items);
    expect(ordered.map((i) => i.id)).toEqual(['A', 'B']);
  });

  test('child is NOT deferred when parent has serverId', () => {
    const items = [makeItem('B', 'folder:create', { clientId: 'B', name: 'Child', parentId: 'A' })];
    expect(engineWith({ A: 'server-A-id' }).orderByDependency(items)[0]!.id).toBe('B');
  });

  test('three-level nesting: A → B → C — A goes first, B and C deferred', () => {
    const items = [
      makeItem('C', 'folder:create', { clientId: 'C', name: 'C', parentId: 'B' }),
      makeItem('B', 'folder:create', { clientId: 'B', name: 'B', parentId: 'A' }),
      makeItem('A', 'folder:create', { clientId: 'A', name: 'A', parentId: null }),
    ];
    const ordered = engineWith({}).orderByDependency(items);
    expect(ordered[0]!.id).toBe('A');
    expect(ordered.slice(1).map((i) => i.id).sort()).toEqual(['B', 'C']);
  });

  test('document upload is deferred until its folder has a serverId', () => {
    const items = [
      makeItem('doc1', 'document:create', { clientId: 'doc1', folderId: 'F1' }),
      makeItem('F1', 'folder:create', { clientId: 'F1', name: 'F1', parentId: null }),
    ];
    expect(engineWith({}).orderByDependency(items).map((i) => i.id)).toEqual(['F1', 'doc1']);
    expect(engineWith({ F1: 's1' }).orderByDependency(items).map((i) => i.id)).toEqual(['doc1', 'F1']);
  });

  test('move is deferred until the destination folder has a serverId', () => {
    const items = [makeItem('M', 'folder:move', { clientId: 'X', newParentId: 'P' })];
    const other = makeItem('Z', 'folder:create', { clientId: 'Z', name: 'Z', parentId: null });
    expect(engineWith({ X: 'sx' }).orderByDependency([...items, other]).map((i) => i.id)).toEqual(['Z', 'M']);
  });

  test('malformed payload does not crash ordering', () => {
    const bad = { ...makeItem('bad', 'folder:create', {}), payload: '{not json' };
    expect(engineWith({}).orderByDependency([bad])).toHaveLength(1);
  });
});

describe('SyncEngine — retry backoff', () => {
  test('retry 0 returns a future timestamp', () => {
    const t = nextRetryAt(0);
    expect(t).not.toBeNull();
    expect(t!).toBeGreaterThan(Date.now());
  });

  test('retry at max count returns null (needs_attention)', () => {
    expect(nextRetryAt(5)).toBeNull();
  });

  test('backoff increases with retry count', () => {
    // Jitter is at most 20%, and each step at least doubles, so order is stable.
    const t0 = nextRetryAt(0)! - Date.now();
    const t1 = nextRetryAt(1)! - Date.now();
    const t2 = nextRetryAt(2)! - Date.now();
    expect(t1).toBeGreaterThan(t0);
    expect(t2).toBeGreaterThan(t1);
  });
});

describe('ApiError', () => {
  test('validation and not-found errors are permanent', () => {
    expect(new ApiError('bad', 400).isPermanent).toBe(true);
    expect(new ApiError('missing', 404).isPermanent).toBe(true);
  });

  test('auth, rate-limit, server and network errors are retried', () => {
    expect(new ApiError('auth', 401).isPermanent).toBe(false);
    expect(new ApiError('slow down', 429).isPermanent).toBe(false);
    expect(new ApiError('boom', 503).isPermanent).toBe(false);
    expect(new ApiError('offline', 0).isPermanent).toBe(false);
  });
});
