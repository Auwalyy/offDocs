import * as FileSystem from 'expo-file-system/legacy';
import { SQLiteDatabase } from 'expo-sqlite';
import uuid from 'react-native-uuid';
import { Document, SyncQueueItem } from '../../types';
import { DocumentRepository } from './DocumentRepository';
import { SyncQueueRepository } from '../sync/SyncQueueRepository';
import { withTransaction } from '../../database/transaction';

async function getDocsDir(): Promise<string> {
  const dir = `${FileSystem.documentDirectory}foliosync/documents/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

/**
 * Copies a file from any URI scheme (file://, content://, cache://) to a
 * permanent app-owned location using base64 read/write — the only method
 * that works reliably across all URI types in Expo Go on Android.
 */
async function copyToAppStorage(sourceUri: string, destUri: string): Promise<void> {
  const base64 = await FileSystem.readAsStringAsync(sourceUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await FileSystem.writeAsStringAsync(destUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

function computeImportId(name: string, size: number, lastModified: number): string {
  const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
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

    const docsDir = await getDocsDir();
    const safeFilename = `${importId}_${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const destUri = `${docsDir}${safeFilename}`;

    await copyToAppStorage(sourceUri, destUri);

    const now = Date.now();

    const doc: Document = {
      id: importId,
      serverId: null,
      folderId,
      name,
      mimeType,
      localUri: destUri,
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
      payload: JSON.stringify({ clientId: doc.id, folderId, name, mimeType, fileSize, localUri: destUri }),
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
    const doc = await this.docRepo.findById(id);

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

    if (doc?.localUri) {
      await FileSystem.deleteAsync(doc.localUri, { idempotent: true });
    }
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
