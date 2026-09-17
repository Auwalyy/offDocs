import * as FileSystem from 'expo-file-system/legacy';
import { SQLiteDatabase } from 'expo-sqlite';
import uuid from 'react-native-uuid';
import { Folder, SyncQueueItem } from '../../types';
import { FolderRepository } from './FolderRepository';
import { DocumentRepository } from '../documents/DocumentRepository';
import { SyncQueueRepository } from '../sync/SyncQueueRepository';
import { withTransaction } from '../../database/transaction';

const MAX_NAME_LENGTH = 255;

export function makeQueueItem(
  entityType: SyncQueueItem['entityType'],
  operation: SyncQueueItem['operation'],
  clientEntityId: string,
  payload: Record<string, unknown>,
  createdAt = Date.now()
): SyncQueueItem {
  return {
    id: uuid.v4() as string,
    entityType,
    operation,
    payload: JSON.stringify(payload),
    clientEntityId,
    status: 'pending',
    retryCount: 0,
    lastError: null,
    nextRetryAt: null,
    createdAt,
  };
}

function validateName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Folder name is required.');
  if (trimmed.length > MAX_NAME_LENGTH) throw new Error(`Folder name must be at most ${MAX_NAME_LENGTH} characters.`);
  return trimmed;
}

export class WorkspaceService {
  private folderRepo: FolderRepository;
  private docRepo: DocumentRepository;
  private queueRepo: SyncQueueRepository;

  constructor(private db: SQLiteDatabase) {
    this.folderRepo = new FolderRepository(db);
    this.docRepo = new DocumentRepository(db);
    this.queueRepo = new SyncQueueRepository(db);
  }

  async createFolder(name: string, parentId: string | null): Promise<Folder> {
    const now = Date.now();
    const folder: Folder = {
      id: uuid.v4() as string,
      serverId: null,
      parentId,
      name: validateName(name),
      pathCache: null,
      syncStatus: 'pending',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    const queueItem = makeQueueItem('folder', 'folder:create', folder.id, {
      name: folder.name, parentId, clientId: folder.id,
    }, now);

    await withTransaction(this.db, async () => {
      await this.folderRepo.insert(folder);
      await this.queueRepo.insert(queueItem);
    });

    return folder;
  }

  async renameFolder(id: string, newName: string): Promise<void> {
    const name = validateName(newName);
    const now = Date.now();
    const queueItem = makeQueueItem('folder', 'folder:rename', id, { clientId: id, name }, now);

    await withTransaction(this.db, async () => {
      await this.folderRepo.rename(id, name, 'pending', now);
      await this.queueRepo.insert(queueItem);
    });
  }

  async moveFolder(id: string, newParentId: string | null): Promise<void> {
    if (newParentId) {
      const subtree = await this.folderRepo.findSubtree(id);
      if (subtree.some((f) => f.id === newParentId)) {
        throw new Error('A folder cannot be moved into itself or one of its subfolders.');
      }
    }

    const now = Date.now();
    const queueItem = makeQueueItem('folder', 'folder:move', id, { clientId: id, newParentId }, now);

    await withTransaction(this.db, async () => {
      await this.folderRepo.move(id, newParentId, 'pending', now);
      await this.queueRepo.insert(queueItem);
    });
  }

  /**
   * Deletes a folder together with its subfolders and documents.
   *
   * Entities that never reached the server simply have their queued operations
   * cancelled. Synced documents are deleted explicitly (before the folder) so the
   * server does not move them to lost-and-found, which is reserved for documents
   * this device did not know about.
   */
  async deleteFolder(id: string): Promise<void> {
    const subtree = await this.folderRepo.findSubtree(id);
    const root = subtree.find((f) => f.id === id);
    if (!root) return;

    const docs = await this.docRepo.findByFolders(subtree.map((f) => f.id));
    const now = Date.now();

    const neverSynced = [
      ...subtree.filter((f) => !f.serverId).map((f) => f.id),
      ...docs.filter((d) => !d.serverId).map((d) => d.id),
    ];
    const deleteOps = [
      ...docs
        .filter((d) => d.serverId)
        .map((d) => makeQueueItem('document', 'document:delete', d.id, { clientId: d.id }, now)),
      ...(root.serverId
        ? [makeQueueItem('folder', 'folder:delete', id, { clientId: id }, now + 1)]
        : []),
    ];

    await withTransaction(this.db, async () => {
      for (const f of subtree) await this.folderRepo.softDelete(f.id, now);
      for (const d of docs) await this.docRepo.softDelete(d.id, now);
      await this.queueRepo.deleteUnsyncedForEntities(neverSynced);
      for (const op of deleteOps) await this.queueRepo.insert(op);
    });

    await Promise.all(
      docs
        .filter((d) => d.localUri)
        .map((d) => FileSystem.deleteAsync(d.localUri!, { idempotent: true }).catch(() => undefined))
    );
  }

  async getFolders(parentId: string | null): Promise<Folder[]> {
    return this.folderRepo.findByParent(parentId);
  }

  async getAllFolders(): Promise<Folder[]> {
    return this.folderRepo.findAll();
  }

  async getFolder(id: string): Promise<Folder | null> {
    return this.folderRepo.findById(id);
  }

  async searchFolders(query: string): Promise<Folder[]> {
    return this.folderRepo.search(query);
  }
}
