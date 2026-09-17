import * as FileSystem from 'expo-file-system/legacy';
import { SQLiteDatabase } from 'expo-sqlite';
import uuid from 'react-native-uuid';
import { Document } from '../../types';
import { DocumentRepository } from './DocumentRepository';
import { SyncQueueRepository } from '../sync/SyncQueueRepository';
import { makeQueueItem } from '../workspace/WorkspaceService';
import { withTransaction } from '../../database/transaction';

export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

const EXTENSION_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/** Pickers sometimes report `application/octet-stream`; fall back to the file extension. */
function resolveMimeType(name: string, reported: string | undefined): string | null {
  if (reported && (SUPPORTED_MIME_TYPES as readonly string[]).includes(reported)) return reported;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_MIME[ext] ?? null;
}

async function getDocsDir(): Promise<string> {
  const dir = `${FileSystem.documentDirectory}foliosync/documents/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

/**
 * Copies a picked file (file:// or content://) into permanent app storage.
 * A native copy is tried first (fast, streams large files); base64
 * read/write is the fallback. If both fail, the first error is reported
 * because it is the more meaningful one.
 */
async function copyToAppStorage(sourceUri: string, destUri: string): Promise<void> {
  try {
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  } catch (copyError) {
    try {
      const base64 = await FileSystem.readAsStringAsync(sourceUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.writeAsStringAsync(destUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch {
      throw new Error(
        `Could not read the selected file. Try picking it again. (${copyError instanceof Error ? copyError.message : String(copyError)})`
      );
    }
  }
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
    mimeType?: string;
    fileSize: number;
    folderId: string;
  }): Promise<Document> {
    const { sourceUri, name, fileSize, folderId } = params;

    const mimeType = resolveMimeType(name, params.mimeType);
    if (!mimeType) throw new Error('Only PDF and DOCX files are supported.');

    // Importing the same file into the same folder twice is a no-op.
    const duplicate = await this.docRepo.findDuplicate(folderId, name, fileSize);
    if (duplicate) return duplicate;

    const id = uuid.v4() as string;
    const docsDir = await getDocsDir();
    const destUri = `${docsDir}${id}_${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    await copyToAppStorage(sourceUri, destUri);

    const now = Date.now();
    const doc: Document = {
      id,
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

    const queueItem = makeQueueItem('document', 'document:create', id, {
      clientId: id, folderId, name, mimeType, fileSize, localUri: destUri,
    }, now);

    try {
      await withTransaction(this.db, async () => {
        await this.docRepo.insert(doc);
        await this.queueRepo.insert(queueItem);
      });
    } catch (err) {
      await FileSystem.deleteAsync(destUri, { idempotent: true }).catch(() => undefined);
      throw err;
    }

    return doc;
  }

  async deleteDocument(id: string): Promise<void> {
    const doc = await this.docRepo.findById(id);
    if (!doc) return;
    const now = Date.now();

    await withTransaction(this.db, async () => {
      await this.docRepo.softDelete(id, now);
      if (doc.serverId) {
        await this.queueRepo.insert(
          makeQueueItem('document', 'document:delete', id, { clientId: id }, now)
        );
      } else {
        // Never uploaded — just cancel the pending upload.
        await this.queueRepo.deleteUnsyncedForEntities([id]);
      }
    });

    if (doc.localUri) {
      await FileSystem.deleteAsync(doc.localUri, { idempotent: true }).catch(() => undefined);
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
