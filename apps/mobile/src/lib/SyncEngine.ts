import * as FileSystem from 'expo-file-system/legacy';
import { SQLiteDatabase } from 'expo-sqlite';
import { SyncQueueItem } from '../types';
import { SyncQueueRepository } from '../features/sync/SyncQueueRepository';
import { FolderRepository } from '../features/workspace/FolderRepository';
import { DocumentRepository } from '../features/documents/DocumentRepository';
import { apiClient, API_BASE_URL, ApiError, toApiError } from '../api/client';

const BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000];
const MAX_RETRIES = BACKOFF_MS.length;
const SYNCED_HISTORY_MS = 7 * 24 * 60 * 60 * 1000;

export function nextRetryAt(retryCount: number): number | null {
  if (retryCount >= MAX_RETRIES) return null;
  const base = BACKOFF_MS[retryCount] ?? 60_000;
  const jitter = Math.random() * base * 0.2;
  return Date.now() + base + jitter;
}

/** Thrown when an operation depends on an entity that has not reached the server yet. */
class DependencyNotReadyError extends Error {}

export interface SyncSummary {
  processed: number;
  failed: number;
}

interface ServerIdMap {
  [clientId: string]: string;
}

/** Payload keys that reference another entity which must be synced first. */
const DEPENDENCY_KEYS = ['parentId', 'newParentId', 'folderId'] as const;

export class SyncEngine {
  private running: Promise<SyncSummary> | null = null;
  private queueRepo: SyncQueueRepository;
  private folderRepo: FolderRepository;
  private docRepo: DocumentRepository;
  private serverIdMap: ServerIdMap = {};

  constructor(private db: SQLiteDatabase) {
    this.queueRepo = new SyncQueueRepository(db);
    this.folderRepo = new FolderRepository(db);
    this.docRepo = new DocumentRepository(db);
  }

  /** Pushes all due queue items to the server. Concurrent calls share one run. */
  sync(): Promise<SyncSummary> {
    if (!this.running) {
      this.running = this.run().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  private async run(): Promise<SyncSummary> {
    await this.queueRepo.resetInterrupted();
    await this.queueRepo.pruneSynced(Date.now() - SYNCED_HISTORY_MS);
    await this.buildServerIdMap();

    const pending = await this.queueRepo.getPending(Date.now());
    const summary: SyncSummary = { processed: 0, failed: 0 };
    for (const item of this.orderByDependency(pending)) {
      const ok = await this.processItem(item);
      summary.processed += 1;
      if (!ok) summary.failed += 1;
    }
    return summary;
  }

  private async buildServerIdMap(): Promise<void> {
    this.serverIdMap = {};
    const rows = await this.db.getAllAsync<{ id: string; server_id: string }>(
      `SELECT id, server_id FROM folders WHERE server_id IS NOT NULL
       UNION ALL
       SELECT id, server_id FROM documents WHERE server_id IS NOT NULL`
    );
    for (const r of rows) this.serverIdMap[r.id] = r.server_id;
  }

  /** Moves items whose referenced entity has no server id yet to the end of the run. */
  orderByDependency(items: SyncQueueItem[]): SyncQueueItem[] {
    const ready: SyncQueueItem[] = [];
    const deferred: SyncQueueItem[] = [];
    for (const item of items) {
      const payload = safeParse(item.payload);
      const blocked = DEPENDENCY_KEYS.some((key) => {
        const ref = payload[key];
        return typeof ref === 'string' && !this.serverIdMap[ref];
      });
      (blocked ? deferred : ready).push(item);
    }
    return [...ready, ...deferred];
  }

  /** Returns false when the item failed. */
  private async processItem(item: SyncQueueItem): Promise<boolean> {
    await this.queueRepo.markSyncing(item.id);
    try {
      await this.dispatch(item, safeParse(item.payload));
      await this.queueRepo.markSynced(item.id);
      return true;
    } catch (err) {
      if (err instanceof DependencyNotReadyError) {
        await this.queueRepo.markWaiting(item.id, err.message);
        return true;
      }

      const message = err instanceof Error ? err.message : String(err);
      const permanent = err instanceof ApiError && err.isPermanent;
      const newCount = item.retryCount + 1;
      const retryAt = permanent ? null : nextRetryAt(newCount);
      await this.queueRepo.markFailed(item.id, message, newCount, retryAt);

      const status = retryAt ? 'failed' : 'needs_attention';
      if (item.entityType === 'folder') {
        await this.folderRepo.updateSyncStatus(item.clientEntityId, status);
      } else {
        await this.docRepo.updateSyncStatus(item.clientEntityId, status);
      }
      return false;
    }
  }

  private async dispatch(item: SyncQueueItem, payload: Record<string, unknown>): Promise<void> {
    switch (item.operation) {
      case 'folder:create':   return this.syncFolderCreate(item, payload);
      case 'folder:rename':   return this.syncFolderRename(item, payload);
      case 'folder:move':     return this.syncFolderMove(item, payload);
      case 'folder:delete':   return this.syncFolderDelete(item, payload);
      case 'document:create': return this.syncDocumentCreate(item, payload);
      case 'document:delete': return this.syncDocumentDelete(item, payload);
      default:
        throw new Error(`Unknown sync operation: ${String(item.operation)}`);
    }
  }

  /** Resolves a client folder id to its server id, or throws if it has not synced yet. */
  private requireFolderServerId(clientId: string, what: string): string {
    const serverId = this.serverIdMap[clientId];
    if (!serverId) throw new DependencyNotReadyError(`Waiting for ${what} to sync first`);
    return serverId;
  }

  private async syncFolderCreate(item: SyncQueueItem, payload: Record<string, unknown>): Promise<void> {
    const parentClientId = payload['parentId'] as string | null;
    const parentServerId = parentClientId ? this.requireFolderServerId(parentClientId, 'parent folder') : null;
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
    const serverId = this.requireFolderServerId(clientId, 'folder');
    await apiClient.patch(`/folders/${serverId}`, { name: payload['name'] }, item.id);
    await this.folderRepo.updateSyncStatus(clientId, 'synced');
  }

  private async syncFolderMove(item: SyncQueueItem, payload: Record<string, unknown>): Promise<void> {
    const clientId = payload['clientId'] as string;
    const serverId = this.requireFolderServerId(clientId, 'folder');
    const newParentClientId = payload['newParentId'] as string | null;
    const newParentServerId = newParentClientId
      ? this.requireFolderServerId(newParentClientId, 'destination folder')
      : null;
    await apiClient.patch(`/folders/${serverId}`, { parentId: newParentServerId }, item.id);
    await this.folderRepo.updateSyncStatus(clientId, 'synced');
  }

  private async syncFolderDelete(item: SyncQueueItem, payload: Record<string, unknown>): Promise<void> {
    const serverId = this.serverIdMap[payload['clientId'] as string];
    if (!serverId) return; // never reached the server — nothing to delete
    await apiClient.delete(`/folders/${serverId}`, item.id);
  }

  private async syncDocumentCreate(item: SyncQueueItem, payload: Record<string, unknown>): Promise<void> {
    const folderServerId = this.requireFolderServerId(payload['folderId'] as string, 'folder');
    const localUri = payload['localUri'] as string;
    const name     = payload['name'] as string;
    const mimeType = payload['mimeType'] as string;
    const clientId = payload['clientId'] as string;

    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists) {
      throw new ApiError('The local copy of this file is missing, so it cannot be uploaded.', 400, 'FILE_MISSING');
    }

    const upload = (token: string | null) =>
      FileSystem.uploadAsync(`${API_BASE_URL}/documents`, localUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType,
        parameters: { clientId, folderId: folderServerId, name, mimeType },
        headers: {
          Accept: 'application/json',
          'Idempotency-Key': item.id,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

    let result;
    try {
      let token = await apiClient.getValidAccessToken();
      result = await upload(token);
      if (result.status === 401 && token) {
        token = await apiClient.refreshAccessToken();
        if (token) result = await upload(token);
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(`Upload failed: cannot reach the server at ${API_BASE_URL}.`, 0, 'NETWORK_ERROR');
    }

    if (result.status >= 400) throw toApiError(result.status, result.body);

    const body = JSON.parse(result.body) as { data: { clientId: string; serverId: string } };
    await this.docRepo.updateServerId(body.data.clientId, body.data.serverId);
    this.serverIdMap[body.data.clientId] = body.data.serverId;
  }

  private async syncDocumentDelete(item: SyncQueueItem, payload: Record<string, unknown>): Promise<void> {
    const serverId = this.serverIdMap[payload['clientId'] as string];
    if (!serverId) return; // never reached the server — nothing to delete
    await apiClient.delete(`/documents/${serverId}`, item.id);
  }
}

function safeParse(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}
