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
  | 'document:delete'
  /** Sets isFavorite on a folder or document (entityType says which). */
  | 'favorite:update'
  /** Replaces a document's whole tag list. */
  | 'tag:update'
  /** Sets a folder's colour and icon. */
  | 'folder:style';

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
  /** #RRGGBB, or null for the default colour. */
  color: string | null;
  /** Emoji shown instead of the default folder icon. */
  icon: string | null;
  isFavorite: boolean;
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
  isFavorite: boolean;
  syncStatus: SyncStatus;
  deletedAt: number | null;
}

// ─── Organization ─────────────────────────────────────────────────────────────

export type RecentAction = 'opened' | 'imported' | 'modified';

export interface RecentItem {
  entityType: EntityType;
  entityId: string;
  action: RecentAction;
  occurredAt: number;
  name: string;
  /** Documents only. */
  mimeType: string | null;
  fileSize: number | null;
  updatedAt: number;
  /** Name of the containing folder, or null at the workspace root. */
  locationName: string | null;
  color: string | null;
  icon: string | null;
}

export interface DocumentHit extends Document {
  tags: string[];
  folderName: string | null;
}

export type SearchFilter = 'all' | 'folders' | 'documents' | 'favorites' | 'recent';

export interface SearchResults {
  folders: Folder[];
  documents: DocumentHit[];
}

export interface TagSummary {
  name: string;
  documentCount: number;
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
