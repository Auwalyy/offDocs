/**
 * Favorites, tags, recent items, search and preferences against a real
 * (in-memory) SQLite database with all migrations applied.
 */

import { SQLiteDatabase } from 'expo-sqlite';
import { createTestDb } from '../testing/sqliteTestDb';
import { runMigrations } from '../database/schema';
import { WorkspaceService } from '../features/workspace/WorkspaceService';
import { OrganizationService } from '../features/favorites/OrganizationService';
import { SearchService, MAX_SEARCH_HISTORY } from '../features/search/SearchService';
import { RecentRepository, MAX_RECENT_ITEMS } from '../features/recent/RecentRepository';
import { PreferencesRepository } from '../features/settings/PreferencesRepository';
import { SyncQueueRepository } from '../features/sync/SyncQueueRepository';
import { DocumentRepository } from '../features/documents/DocumentRepository';
import { Document } from '../types';

jest.mock('expo-file-system/legacy', () => ({ deleteAsync: jest.fn().mockResolvedValue(undefined) }));

const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

let db: SQLiteDatabase;
let workspace: WorkspaceService;
let org: OrganizationService;
let search: SearchService;
let recent: RecentRepository;
let queue: SyncQueueRepository;

async function addDocument(id: string, folderId: string, name: string, mimeType = PDF, importedAt = 1): Promise<Document> {
  const doc: Document = {
    id, serverId: null, folderId, name, mimeType, localUri: `file:///${id}`, storageKey: null, fileSize: 1000,
    contentHash: null, importedAt, updatedAt: importedAt, isFavorite: false, syncStatus: 'pending', deletedAt: null,
  };
  await new DocumentRepository(db).insert(doc);
  return doc;
}

async function queueOps(entityId: string) {
  return (await queue.getAll()).reverse().filter((q) => q.clientEntityId === entityId).map((q) => ({ op: q.operation, payload: JSON.parse(q.payload) }));
}

beforeEach(async () => {
  db = await createTestDb();
  workspace = new WorkspaceService(db);
  org = new OrganizationService(db);
  search = new SearchService(db);
  recent = new RecentRepository(db);
  queue = new SyncQueueRepository(db);
});

describe('migrations', () => {
  test('running them again is a no-op', async () => {
    await expect(runMigrations(db)).resolves.toBeUndefined();
    const rows = await db.getAllAsync<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version');
    expect(rows.map((r) => r.version)).toEqual([1, 2, 3, 4]);
  });
});

describe('favorites', () => {
  test('updates the row and queues one sync item atomically', async () => {
    const folder = await workspace.createFolder('CSC 401', null);
    await org.setFavorite('folder', folder.id, true);

    expect((await workspace.getFolder(folder.id))!.isFavorite).toBe(true);
    expect(await queueOps(folder.id)).toEqual([
      { op: 'folder:create', payload: expect.anything() },
      { op: 'favorite:update', payload: { clientId: folder.id, isFavorite: true } },
    ]);
  });

  test('repeated toggles offline leave only the latest value queued', async () => {
    const folder = await workspace.createFolder('CSC 401', null);
    for (const value of [true, false, true, false]) await org.setFavorite('folder', folder.id, value);

    const favoriteOps = (await queueOps(folder.id)).filter((o) => o.op === 'favorite:update');
    expect(favoriteOps).toEqual([{ op: 'favorite:update', payload: { clientId: folder.id, isFavorite: false } }]);
  });

  test('an item already being sent is not superseded', async () => {
    const folder = await workspace.createFolder('A', null);
    await org.setFavorite('folder', folder.id, true);
    const inFlight = (await queue.getAll()).find((q) => q.operation === 'favorite:update')!;
    await queue.markSyncing(inFlight.id);
    await org.setFavorite('folder', folder.id, false);

    expect((await queueOps(folder.id)).filter((o) => o.op === 'favorite:update')).toHaveLength(2);
  });

  test('favorites list only live items', async () => {
    const a = await workspace.createFolder('A', null);
    const b = await workspace.createFolder('B', null);
    await addDocument('d1', a.id, 'Notes.pdf');
    await org.setFavorite('folder', a.id, true);
    await org.setFavorite('folder', b.id, true);
    await org.setFavorite('document', 'd1', true);
    await workspace.deleteFolder(b.id);

    const favorites = await org.getFavorites();
    expect(favorites.folders.map((f) => f.name)).toEqual(['A']);
    expect(favorites.documents.map((d) => d.id)).toEqual(['d1']);
  });

  test('deleting a folder drops unsent favorite updates for it', async () => {
    const folder = await workspace.createFolder('A', null);
    await db.runAsync("UPDATE folders SET server_id = 'srv' WHERE id = ?", [folder.id]);
    await org.setFavorite('folder', folder.id, true);
    await workspace.deleteFolder(folder.id);

    expect((await queueOps(folder.id)).map((o) => o.op)).toEqual(['folder:create', 'folder:delete']);
  });
});

describe('folder style', () => {
  test('saves colour and icon and queues the full style', async () => {
    const folder = await workspace.createFolder('Maths', null);
    await org.setFolderStyle(folder.id, { color: '#16A34A', icon: '📐' });

    const saved = (await workspace.getFolder(folder.id))!;
    expect([saved.color, saved.icon]).toEqual(['#16A34A', '📐']);
    expect((await queueOps(folder.id)).pop()).toEqual({
      op: 'folder:style', payload: { clientId: folder.id, color: '#16A34A', icon: '📐' },
    });
  });

  test('rejects an invalid colour without writing anything', async () => {
    const folder = await workspace.createFolder('Maths', null);
    await expect(org.setFolderStyle(folder.id, { color: 'green', icon: null })).rejects.toThrow('Invalid folder colour');
    expect((await queueOps(folder.id)).map((o) => o.op)).toEqual(['folder:create']);
  });
});

describe('tags', () => {
  test('are normalized, shared case-insensitively and queued as a full list', async () => {
    const folder = await workspace.createFolder('CSC 421', null);
    await addDocument('d1', folder.id, 'Database.pdf');
    await addDocument('d2', folder.id, 'Normalization.docx', DOCX);

    expect(await org.setDocumentTags('d1', ['Exam', ' CSC 421 ', 'exam'])).toEqual(['Exam', 'CSC 421']);
    await org.setDocumentTags('d2', ['EXAM']);

    expect(await org.getDocumentTags('d2')).toEqual(['Exam']); // reuses the existing tag's spelling
    expect(await org.getAllTags()).toEqual([
      { name: 'Exam', documentCount: 2 },
      { name: 'CSC 421', documentCount: 1 },
    ]);
    expect((await queueOps('d1')).pop()).toEqual({ op: 'tag:update', payload: { clientId: 'd1', tags: ['Exam', 'CSC 421'] } });
    expect(await org.getTagsForDocuments(['d1', 'd2', 'missing'])).toEqual({ d1: ['Exam', 'CSC 421'], d2: ['Exam'] });
  });

  test('replacing tags removes the old ones and records a modification', async () => {
    const folder = await workspace.createFolder('F', null);
    await addDocument('d1', folder.id, 'A.pdf');
    await org.setDocumentTags('d1', ['One', 'Two']);
    await org.setDocumentTags('d1', ['Two']);

    expect(await org.getDocumentTags('d1')).toEqual(['Two']);
    expect((await queueOps('d1')).filter((o) => o.op === 'tag:update')).toHaveLength(1);
    expect((await recent.list())[0]).toMatchObject({ entityId: 'd1', action: 'modified' });
  });
});

describe('recent items', () => {
  test('keeps the latest action per item, newest first, with its location', async () => {
    const folder = await workspace.createFolder('CSC 401', null);
    await addDocument('d1', folder.id, 'Lecture 1.pdf');
    await recent.record('document', 'd1', 'imported', 100);
    await recent.record('folder', folder.id, 'opened', 200);
    await recent.record('document', 'd1', 'opened', 300);

    const items = await recent.list();
    expect(items.map((i) => [i.entityId, i.action])).toEqual([['d1', 'opened'], [folder.id, 'opened']]);
    expect(items[0]).toMatchObject({ name: 'Lecture 1.pdf', mimeType: PDF, locationName: 'CSC 401' });
    expect(items[1]).toMatchObject({ name: 'CSC 401', locationName: null });
    expect((await recent.list({ entityType: 'folder' })).map((i) => i.entityId)).toEqual([folder.id]);
  });

  test(`is capped at ${MAX_RECENT_ITEMS} entries`, async () => {
    const folder = await workspace.createFolder('F', null);
    for (let i = 0; i < MAX_RECENT_ITEMS + 5; i++) {
      await addDocument(`d${i}`, folder.id, `Doc ${i}.pdf`);
      await recent.record('document', `d${i}`, 'imported', i);
    }
    const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM recent_items');
    expect(count!.n).toBe(MAX_RECENT_ITEMS);
    expect((await recent.list({ limit: 1 }))[0]!.entityId).toBe(`d${MAX_RECENT_ITEMS + 4}`);
  });

  test('hides deleted items and supports remove / clear', async () => {
    const a = await workspace.createFolder('A', null);
    const b = await workspace.createFolder('B', null);
    await recent.record('folder', a.id, 'opened');
    await recent.record('folder', b.id, 'opened');
    await workspace.deleteFolder(b.id);
    expect((await recent.list()).map((i) => i.entityId)).toEqual([a.id]);

    await recent.remove('folder', a.id);
    expect(await recent.list()).toEqual([]);
    await recent.record('folder', a.id, 'opened');
    await recent.clear();
    expect(await recent.list()).toEqual([]);
  });
});

describe('search', () => {
  let csc: string;

  beforeEach(async () => {
    csc = (await workspace.createFolder('CSC 421', null)).id;
    await workspace.createFolder('Database Notes', null);
    await addDocument('d1', csc, 'Database Systems.pdf');
    await addDocument('d2', csc, 'Assignment 2.docx', DOCX);
    await addDocument('d3', csc, 'Operating Systems.pdf');
    await addDocument('d4', csc, 'Grades 100%.pdf');
    await org.setDocumentTags('d3', ['Exam']);
  });

  test('matches names partially and case-insensitively, prefix matches first', async () => {
    const r = await search.search('DATABASE');
    expect(r.folders.map((f) => f.name)).toEqual(['Database Notes']);
    expect(r.documents.map((d) => d.name)).toEqual(['Database Systems.pdf']);
    expect(r.documents[0]).toMatchObject({ folderName: 'CSC 421', tags: [] });

    const systems = await search.search('systems');
    expect(systems.documents.map((d) => d.name)).toEqual(['Database Systems.pdf', 'Operating Systems.pdf']);
  });

  test('finds documents by tag and by file type', async () => {
    expect((await search.search('exa')).documents.map((d) => d.id)).toEqual(['d3']);
    expect((await search.search('exam')).documents[0]!.tags).toEqual(['Exam']);
    expect((await search.search('docx')).documents.map((d) => d.id)).toEqual(['d2']);
    expect((await search.search('pdf')).documents.map((d) => d.id).sort()).toEqual(['d1', 'd3', 'd4']);
  });

  test('treats % and _ literally', async () => {
    expect((await search.search('100%')).documents.map((d) => d.id)).toEqual(['d4']);
    expect((await search.search('%')).documents.map((d) => d.id)).toEqual(['d4']);
    expect((await search.search('_')).documents).toEqual([]);
  });

  test('filters by type, favorites and recent', async () => {
    await org.setFavorite('document', 'd3', true);
    await recent.clear(); // tagging d3 in beforeEach recorded it as recently modified
    await recent.record('document', 'd1', 'opened');

    expect((await search.search('s', 'folders')).documents).toEqual([]);
    expect((await search.search('database', 'documents')).folders).toEqual([]);
    expect((await search.search('systems', 'favorites')).documents.map((d) => d.id)).toEqual(['d3']);
    expect((await search.search('systems', 'recent')).documents.map((d) => d.id)).toEqual(['d1']);
  });

  test('ignores deleted items and blank queries', async () => {
    await workspace.deleteFolder(csc);
    expect((await search.search('systems')).documents).toEqual([]);
    expect(await search.search('   ')).toEqual({ folders: [], documents: [] });
  });

  test('history is de-duplicated, newest first and capped', async () => {
    await search.addToHistory('database', 1);
    await search.addToHistory('exam', 2);
    await search.addToHistory('DATABASE', 3);
    expect(await search.getHistory()).toEqual(['DATABASE', 'exam']);

    for (let i = 0; i < MAX_SEARCH_HISTORY + 3; i++) await search.addToHistory(`q${i}`, 10 + i);
    const history = await search.getHistory();
    expect(history).toHaveLength(MAX_SEARCH_HISTORY);
    expect(history[0]).toBe(`q${MAX_SEARCH_HISTORY + 2}`);

    await search.removeFromHistory(history[0]!);
    expect(await search.getHistory()).not.toContain(history[0]);
    await search.clearHistory();
    expect(await search.getHistory()).toEqual([]);
  });
});

describe('preferences', () => {
  test('stores and overwrites values', async () => {
    const prefs = new PreferencesRepository(db);
    expect(await prefs.get('workspace.sort')).toBeNull();
    await prefs.set('workspace.sort', 'size');
    await prefs.set('workspace.sort', 'newest');
    expect(await prefs.get('workspace.sort')).toBe('newest');
  });
});
