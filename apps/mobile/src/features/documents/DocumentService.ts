import * as FileSystem from 'expo-file-system';
import { SQLiteDatabase } from 'expo-sqlite';
import uuid from 'react-native-uuid';
import { Document, SyncQueueItem } from '../types';
import { DocumentRepository } from './DocumentRepository';
import { SyncQueueRepository } from '../sync/SyncQueueRepository';
import { withTransaction } from '../../database/transaction';

const DOCS_DIR = `${FileSystem.documentDirectory}foliosync/documents/`;

async function ensureDocsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DOCS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DOCS_DIR, { intermediates: true });
  }
}

/**
 * Computes a deterministic import ID from file metadata.
 * Prevents duplicate imports of the same file.
 */
function computeImportId(name: string, size: number, lastModified: number): string {
  // Simple deterministic hash: combine fields into a namespaced UUID v5-like string.
  // We use uuid.v5 with a fixed namespace UUID.
  const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // DNS namespace
  return uuid.v5(`${name}:${size}:${lastModified}`, NAMESPACE) as string;
}

export class DocumentService {
  private docRepo: DocumentRepository;
  private queueRepo: SyncQueueRepository;

  constructor(private db: SQLiteDatabase) {
    this.docRepo = new DocumentRepository(db);
    this.queueRepo = new SyncQueueRepository(db);
  }

  async importDocument(params: {
    sourceUri: string;
    name: string;
    mimeType: string;
    fileSize: number;
    folderId: string;
    lastModified?: number;
  }): Promise<Document> {
    const { sourceUri, name, mimeType, fileSize, folderId, lastModified = 0 } = params;

    const importId = computeImportId(name, fileSize, lastModified);

    // Duplicate check
    const existing = await this.docRepo.findById(importId);
    if (existing) return existing;

    await ensureDocsDir();

    const safeFilename = `${importId}_${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const localUri = `${DOCS_DIR}${safeFilename}`;

    await FileSystem.copyAsync({ from: sourceUri, to: localUri });

    const now = Date.now();
    const doc: Document = {
      id: importId,
      serverId: null,
      folderId,
      name,
      mimeType,
      localUri,
      storageKey: null,
      fileSize,
      contentHash: null,
      importedAt: now,
      updatedAt: now,
      syncStatus: 'pending',
      deletedAt: null,
    };

    const queueItem: SyncQueueItem = {
      id: uuid.v4() as string,
      entityType: 'document',
      operation: 'document:create',
      payload: JSON.stringify({
        clientId: doc.id,
        folderId,
        name,
        mimeType,
        fileSize,
        localUri,
      }),
      clientEntityId: doc.id,
      status: 'pending',
      retryCount: 0,
      lastError: null,
      nextRetryAt: null,
      createdAt: now,
    };

    await withTransaction(this.db, async () => {
      await this.docRepo.insert(doc);
      await this.queueRepo.insert(queueItem);
    });

    return doc;
  }

  async deleteDocument(id: string): Promise<void> {
    const now = Date.now();
    const queueItem: SyncQueueItem = {
      id: uuid.v4() as string,
      entityType: 'document',
      operation: 'document:delete',
      payload: JSON.stringify({ clientId: id }),
      clientEntityId: id,
      status: 'pending',
      retryCount: 0,
      lastError: null,
      nextRetryAt: null,
      createdAt: now,
    };

    await withTransaction(this.db, async () => {
      await this.docRepo.softDelete(id, now);
      await this.queueRepo.insert(queueItem);
    });
  }

  async getDocuments(folderId: string): Promise<Document[]> {
    return this.docRepo.findByFolder(folderId);
  }

  async getDocument(id: string): Promise<Document | null> {
    return this.docRepo.findById(id);
  }

  async search(query: string): Promise<Document[]> {
    return this.docRepo.search(query);
  }
}
