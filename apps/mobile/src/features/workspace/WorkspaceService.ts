import { SQLiteDatabase } from 'expo-sqlite';
import uuid from 'react-native-uuid';
import { Folder, SyncQueueItem } from '../types';
import { FolderRepository } from './FolderRepository';
import { SyncQueueRepository } from '../sync/SyncQueueRepository';
import { withTransaction } from '../../database/transaction';

export class WorkspaceService {
  private folderRepo: FolderRepository;
  private queueRepo: SyncQueueRepository;

  constructor(private db: SQLiteDatabase) {
    this.folderRepo = new FolderRepository(db);
    this.queueRepo = new SyncQueueRepository(db);
  }

  async createFolder(name: string, parentId: string | null): Promise<Folder> {
    const now = Date.now();
    const folder: Folder = {
      id: uuid.v4() as string,
      serverId: null,
      parentId,
      name,
      pathCache: null,
      syncStatus: 'pending',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    const queueItem: SyncQueueItem = {
      id: uuid.v4() as string,
      entityType: 'folder',
      operation: 'folder:create',
      payload: JSON.stringify({ name, parentId, clientId: folder.id }),
      clientEntityId: folder.id,
      status: 'pending',
      retryCount: 0,
      lastError: null,
      nextRetryAt: null,
      createdAt: now,
    };

    await withTransaction(this.db, async () => {
      await this.folderRepo.insert(folder);
      await this.queueRepo.insert(queueItem);
    });

    return folder;
  }

  async renameFolder(id: string, newName: string): Promise<void> {
    const now = Date.now();
    const queueItem: SyncQueueItem = {
      id: uuid.v4() as string,
      entityType: 'folder',
      operation: 'folder:rename',
      payload: JSON.stringify({ clientId: id, name: newName }),
      clientEntityId: id,
      status: 'pending',
      retryCount: 0,
      lastError: null,
      nextRetryAt: null,
      createdAt: now,
    };

    await withTransaction(this.db, async () => {
      await this.folderRepo.rename(id, newName, 'pending', now);
      await this.queueRepo.insert(queueItem);
    });
  }

  async moveFolder(id: string, newParentId: string | null): Promise<void> {
    const now = Date.now();
    const queueItem: SyncQueueItem = {
      id: uuid.v4() as string,
      entityType: 'folder',
      operation: 'folder:move',
      payload: JSON.stringify({ clientId: id, newParentId }),
      clientEntityId: id,
      status: 'pending',
      retryCount: 0,
      lastError: null,
      nextRetryAt: null,
      createdAt: now,
    };

    await withTransaction(this.db, async () => {
      await this.folderRepo.move(id, newParentId, 'pending', now);
      await this.queueRepo.insert(queueItem);
    });
  }

  async deleteFolder(id: string): Promise<void> {
    const now = Date.now();
    const queueItem: SyncQueueItem = {
      id: uuid.v4() as string,
      entityType: 'folder',
      operation: 'folder:delete',
      payload: JSON.stringify({ clientId: id }),
      clientEntityId: id,
      status: 'pending',
      retryCount: 0,
      lastError: null,
      nextRetryAt: null,
      createdAt: now,
    };

    await withTransaction(this.db, async () => {
      await this.folderRepo.softDelete(id, now);
      await this.queueRepo.insert(queueItem);
    });
  }

  async getFolders(parentId: string | null): Promise<Folder[]> {
    return this.folderRepo.findByParent(parentId);
  }

  async getFolder(id: string): Promise<Folder | null> {
    return this.folderRepo.findById(id);
  }

  async searchFolders(query: string): Promise<Folder[]> {
    return this.folderRepo.search(query);
  }
}
