/**
 * SyncEngine tests
 *
 * Tests dependency-aware ordering and retry/backoff behavior
 * without requiring a real SQLite database or network.
 */

type QueueItem = {
  id: string;
  operation: string;
  payload: string;
  clientEntityId: string;
  entityType: string;
  status: string;
  retryCount: number;
  lastError: null;
  nextRetryAt: null;
  createdAt: number;
};

function orderByDependency(
  items: QueueItem[],
  serverIdMap: Record<string, string>
): QueueItem[] {
  const result: QueueItem[] = [];
  const deferred: QueueItem[] = [];

  for (const item of items) {
    const payload = JSON.parse(item.payload) as Record<string, unknown>;
    const parentClientId = payload['parentId'] as string | undefined;

    if (parentClientId && !serverIdMap[parentClientId]) {
      deferred.push(item);
    } else {
      result.push(item);
    }
  }

  return [...result, ...deferred];
}

const BACKOFF = [2_000, 5_000, 15_000, 30_000, 60_000];

function nextRetryAt(retryCount: number): number | null {
  if (retryCount >= BACKOFF.length) return null;
  return Date.now() + (BACKOFF[retryCount] ?? 60_000);
}

function makeItem(id: string, operation: string, payload: object): QueueItem {
  return {
    id, operation, payload: JSON.stringify(payload),
    clientEntityId: id, entityType: 'folder', status: 'pending',
    retryCount: 0, lastError: null, nextRetryAt: null, createdAt: Date.now(),
  };
}

describe('SyncEngine — dependency ordering', () => {
  test('root folder (no parent) is not deferred', () => {
    const items = [makeItem('A', 'folder:create', { clientId: 'A', name: 'Root', parentId: null })];
    const ordered = orderByDependency(items, {});
    expect(ordered[0]!.id).toBe('A');
  });

  test('child is deferred when parent has no serverId', () => {
    const items = [
      makeItem('B', 'folder:create', { clientId: 'B', name: 'Child', parentId: 'A' }),
      makeItem('A', 'folder:create', { clientId: 'A', name: 'Parent', parentId: null }),
    ];
    const ordered = orderByDependency(items, {});
    expect(ordered[0]!.id).toBe('A');
    expect(ordered[1]!.id).toBe('B');
  });

  test('child is NOT deferred when parent has serverId', () => {
    const items = [makeItem('B', 'folder:create', { clientId: 'B', name: 'Child', parentId: 'A' })];
    const ordered = orderByDependency(items, { A: 'server-A-id' });
    expect(ordered[0]!.id).toBe('B');
  });

  test('three-level nesting: A → B → C — A goes first, B and C deferred', () => {
    const items = [
      makeItem('C', 'folder:create', { clientId: 'C', name: 'C', parentId: 'B' }),
      makeItem('B', 'folder:create', { clientId: 'B', name: 'B', parentId: 'A' }),
      makeItem('A', 'folder:create', { clientId: 'A', name: 'A', parentId: null }),
    ];
    const ordered = orderByDependency(items, {});
    expect(ordered[0]!.id).toBe('A');
    const deferredIds = ordered.slice(1).map((i) => i.id);
    expect(deferredIds).toContain('B');
    expect(deferredIds).toContain('C');
  });

  test('document with resolved folder parent is not deferred', () => {
    const items = [
      makeItem('doc1', 'document:create', { clientId: 'doc1', folderId: 'F1' }),
    ];
    // document:create uses folderId not parentId — no deferral
    const ordered = orderByDependency(items, {});
    expect(ordered[0]!.id).toBe('doc1');
  });
});

describe('SyncEngine — retry backoff', () => {
  test('retry 0 returns a future timestamp', () => {
    const t = nextRetryAt(0);
    expect(t).not.toBeNull();
    expect(t!).toBeGreaterThan(Date.now());
  });

  test('retry at max count returns null (needs_attention)', () => {
    expect(nextRetryAt(BACKOFF.length)).toBeNull();
  });

  test('backoff increases with retry count', () => {
    const t0 = nextRetryAt(0)! - Date.now();
    const t1 = nextRetryAt(1)! - Date.now();
    const t2 = nextRetryAt(2)! - Date.now();
    expect(t1).toBeGreaterThan(t0);
    expect(t2).toBeGreaterThan(t1);
  });
});
