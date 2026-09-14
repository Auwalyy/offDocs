import { SQLiteDatabase } from 'expo-sqlite';
import { SyncQueueItem } from '../types';
import { SyncQueueRepository } from '../features/sync/SyncQueueRepository';
import { FolderRepository } from '../features/workspace/FolderRepository';
import { DocumentRepository } from '../features/documents/DocumentRepository';
import { apiClient } from '../api/client';
import * as FileSystem from 'expo-file-system';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

// Exponential backoff delays in ms
const BACKOFF = [2_000, 5_000, 15_000, 30_000, 60_000];
const MAX_RETRIES = BACKOFF.length;

function nextRetryAt(retryCount: number): number | null {
  if (retryCount >= MAX_RETRIES) return null;
  const base = BACKOFF[retryCount] ?? 60_000;
  const jitter = Math.random() * base * 0.2;
  return Date.now() + base + jitter;
}

interface ServerIdMap {
  [clientId: string]: string; // clientId → serverId
}

export class SyncEngine {
  private running = false;
  private queueRepo: SyncQueueRepository;
  private folderRepo: FolderRepository;
  private docRepo: DocumentRepository;
  private serverIdMap: ServerIdMap = {};

  constructor(private db: SQLiteDatabase) {
    this.queueRepo = new SyncQueueRepository(db);
    this.folderRepo = new FolderRepository(db);
    this.docRepo = new DocumentRepository(db);
  }

  async sync(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.buildServerIdMap();
      const pending = await this.queueRepo.getPending(Date.now());
      const ordered = this.orderByDependency(pending);
      for (const item of ordered) {
        await this.processItem(item);
      }
    } finally {
      this.running = false;
    }
  }

  /** Load all known clientId→serverId mappings from local DB */
  private async buildServerIdMap(): Promise<void> {
    this.serverIdMap = {};
    // Folders
    const folderRows = await this.db.getAllAsync<{ id: string; server_id: string | null }>(
      'SELECT id, server_id FROM folders WHERE server_id IS NOT NULL'
    );
    for (const r of folderRows) {
      if (r.server_id) this.serverIdMap[r.id] = r.server_id;
    }
    // Documents
    const docRows = await this.db.getAllAsync<{ id: string; server_id: string | null }>(
      'SELECT id, server_id FROM documents WHERE server_id IS NOT NULL'
    );
    for (const r of docRows) {
      if (r.server_id) this.serverIdMap[r.id] = r.server_id;
    }
  }

  /**
   * Sort queue items so parents are processed before children.
   * Items whose parent clientId has no serverId yet are deferred to end.
   */
  private orderByDependency(items: SyncQueueItem[]): SyncQueueItem[] {
    const result: SyncQueueItem[] = [];
    const deferred: SyncQueueItem[] = [];

    for (const item of items) {
      const payload = JSON.parse(item.payload) as Record<string, unknown>;
      const parentClientId = payload['parentId'] as string | undefined;

      if (parentClientId && !this.serverIdMap[parentClientId]) {
        deferred.push(item);
      } else {
        result.push(item);
      }
    }

    // Append deferred — they may resolve after earlier items in this batch
    return [...result, ...deferred];
  }

  private async processItem(item: SyncQueueItem): Promise<void> {
    await this.queueRepo.markSyncing(item.id);
    try {
      await this.dispatch(item);
      await this.queueRepo.markSynced(item.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const newCount = item.retryCount + 1;
      const retryAt = nextRetryAt(newCount);
      await this.queueRepo.markFailed(item.id, message, newCount, retryAt);

      if (item.entityType === 'folder') {
        await this.folderRepo.updateSyncStatus(item.clientEntityId, retryAt ? 'failed' : 'needs_attention');
      } else {
        await this.docRepo.updateSyncStatus(item.clientEntityId, retryAt ? 'failed' : 'needs_attention');
      }
    }
  }

  private async dispatch(item: SyncQueueItem): Promise<void> {
    const payload = JSON.parse(item.payload) as Record<string, unknown>;

    switch (item.operation) {
      case 'folder:create':   return this.syncFolderCreate(item, payload);
      case 'folder:rename':   return this.syncFolderRename(item, payload);
      case 'folder:move':     return this.syncFolderMove(item, payload);
      case 'folder:delete':   return this.syncFolderDelete(item, payload);
      case 'document:create': return this.syncDocumentCreate(item, payload);
      case 'document:delete': return this.syncDocumentDelete(item, payload);
    }
  }

  private async syncFolderCreate(item: SyncQueueItem, payload: Record<string, unknown>): Promise<void> {
    const parentClientId = payload['parentId'] as string | null;
    const parentServerId = parentClientId ? (this.serverIdMap[parentClientId] ?? null) : null;

    if (parentClientId && !parentServerId) {
      throw new Error(`Parent folder ${parentClientId} not yet synced`);
    }

    const res = await apiClient.post<{ data: { clientId: string; serverId: string } }>(
      '/folders',
      { clientId: payload['clientId'], name: payload['name'], parentId: parentServerId },
      item.id
    );

    const { clientId, serverId } = res.data;
    await this.folderRepo.updateServerId(clientId, serverId);
    this.serverIdMap[clientId] = serverId;
  }

  private async syncFolderRename(item: SyncQueueItem, payload: Record<string, unknown>): Promise<void> {
    const clientId = payload['clientId'] as string;
    const serverId = this.serverIdMap[clientId];
    if (!serverId) throw new Error(`No serverId for folder ${clientId}`);

    await apiClient.patch(`/folders/${serverId}`, { name: payload['name'] }, item.id);
    await this.folderRepo.updateSyncStatus(clientId, 'synced');
  }

  private async syncFolderMove(item: SyncQueueItem, payload: Record<string, unknown>): Promise<void> {
    const clientId = payload['clientId'] as string;
    const serverId = this.serverIdMap[clientId];
    if (!serverId) throw new Error(`No serverId for folder ${clientId}`);

    const newParentClientId = payload['newParentId'] as string | null;
    const newParentServerId = newParentClientId ? (this.serverIdMap[newParentClientId] ?? null) : null;

    if (newParentClientId && !newParentServerId) {
      throw new Error(`New parent folder ${newParentClientId} not yet synced`);
    }

    await apiClient.patch(`/folders/${serverId}`, { parentId: newParentServerId }, item.id);
    await this.folderRepo.updateSyncStatus(clientId, 'synced');
  }

  private async syncFolderDelete(item: SyncQueueItem, payload: Record<string, unknown>): Promise<void> {
    const clientId = payload['clientId'] as string;
    const serverId = this.serverIdMap[clientId];
    if (!serverId) {
      // Never synced — nothing to delete on server
      return;
    }
    await apiClient.delete(`/folders/${serverId}`, item.id);
  }

  private async syncDocumentCreate(item: SyncQueueItem, payload: Record<string, unknown>): Promise<void> {
    const folderClientId = payload['folderId'] as string;
    const folderServerId = this.serverIdMap[folderClientId];
    if (!folderServerId) throw new Error(`Folder ${folderClientId} not yet synced`);

    const localUri = payload['localUri'] as string;
    const name     = payload['name'] as string;
    const mimeType = payload['mimeType'] as string;
    const clientId = payload['clientId'] as string;

    // Upload file via multipart
    const uploadRes = await FileSystem.uploadAsync(
      `${BASE_URL}/documents`,
      localUri,
      {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        parameters: {
          clientId,
          folderId: folderServerId,
          name,
          mimeType,
        },
        headers: {
          'Idempotency-Key': item.id,
          Authorization: `Bearer ${await this.getAccessToken()}`,
        },
      }
    );

    if (uploadRes.status >= 400) {
      throw new Error(`Upload failed: ${uploadRes.status}`);
    }

    const body = JSON.parse(uploadRes.body) as { data: { clientId: string; serverId: string } };
    await this.docRepo.updateServerId(body.data.clientId, body.data.serverId);
    this.serverIdMap[body.data.clientId] = body.data.serverId;
  }

  private async syncDocumentDelete(item: SyncQueueItem, payload: Record<string, unknown>): Promise<void> {
    const clientId = payload['clientId'] as string;
    const serverId = this.serverIdMap[clientId];
    if (!serverId) return; // Never synced
    await apiClient.delete(`/documents/${serverId}`, item.id);
  }

  private async getAccessToken(): Promise<string> {
    // Access token is injected by apiClient internally; this is only needed for
    // FileSystem.uploadAsync which bypasses the apiClient wrapper.
    const { AuthService } = await import('../features/auth/AuthService');
    const svc = new AuthService(this.db);
    const tokens = await svc.getStoredTokens();
    return tokens?.accessToken ?? '';
  }
}
