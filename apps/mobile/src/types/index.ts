// ─── Sync ────────────────────────────────────────────────────────────────────

export type SyncStatus =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'failed'
  | 'needs_attention';

export type SyncOperation =
  | 'folder:create'
  | 'folder:rename'
  | 'folder:move'
  | 'folder:delete'
  | 'document:create'
  | 'document:delete';

export type EntityType = 'folder' | 'document';

// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayName: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  createdAt: number;
  updatedAt: number;
}

// ─── Folder ──────────────────────────────────────────────────────────────────

export interface Folder {
  id: string;           // client UUID
  serverId: string | null;
  parentId: string | null;
  name: string;
  pathCache: string | null;
  syncStatus: SyncStatus;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

// ─── Document ────────────────────────────────────────────────────────────────

export interface Document {
  id: string;           // client UUID
  serverId: string | null;
  folderId: string;
  name: string;
  mimeType: string;
  localUri: string | null;
  storageKey: string | null;
  fileSize: number | null;
  contentHash: string | null;
  importedAt: number;
  updatedAt: number;
  syncStatus: SyncStatus;
  deletedAt: number | null;
}

// ─── Sync Queue ───────────────────────────────────────────────────────────────

export interface SyncQueueItem {
  id: string;           // UUID — used as idempotency key
  entityType: EntityType;
  operation: SyncOperation;
  payload: string;      // JSON string
  clientEntityId: string;
  status: SyncStatus;
  retryCount: number;
  lastError: string | null;
  nextRetryAt: number | null;
  createdAt: number;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export type AppResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
