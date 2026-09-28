import { SQLiteDatabase } from 'expo-sqlite';
import { Document, EntityType, Folder, TagSummary } from '../../types';
import { FolderRepository } from '../workspace/FolderRepository';
import { DocumentRepository } from '../documents/DocumentRepository';
import { SyncQueueRepository } from '../sync/SyncQueueRepository';
import { TagRepository, normalizeTags } from '../tags/TagRepository';
import { RecentRepository } from '../recent/RecentRepository';
import { makeQueueItem } from '../workspace/WorkspaceService';
import { withTransaction } from '../../database/transaction';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Favorites, folder colour/icon and document tags.
 *
 * Every change updates SQLite and queues its sync operation in one
 * transaction. Queue payloads carry the full new value (not a delta), so an
 * older unsent update for the same thing is dropped in the same transaction.
 */
export class OrganizationService {
  private folderRepo: FolderRepository;
  private docRepo: DocumentRepository;
  private queueRepo: SyncQueueRepository;
  private tagRepo: TagRepository;
  private recentRepo: RecentRepository;

  constructor(private db: SQLiteDatabase) {
    this.folderRepo = new FolderRepository(db);
    this.docRepo = new DocumentRepository(db);
    this.queueRepo = new SyncQueueRepository(db);
    this.tagRepo = new TagRepository(db);
    this.recentRepo = new RecentRepository(db);
  }

  async setFavorite(entityType: EntityType, id: string, isFavorite: boolean): Promise<void> {
    const now = Date.now();
    const item = makeQueueItem(entityType, 'favorite:update', id, { clientId: id, isFavorite }, now);
    await withTransaction(this.db, async () => {
      if (entityType === 'folder') await this.folderRepo.setFavorite(id, isFavorite, now);
      else await this.docRepo.setFavorite(id, isFavorite, now);
      await this.queueRepo.deleteSuperseded(id, 'favorite:update');
      await this.queueRepo.insert(item);
    });
  }

  async setFolderStyle(id: string, style: { color: string | null; icon: string | null }): Promise<void> {
    if (style.color !== null && !HEX_COLOR.test(style.color)) throw new Error('Invalid folder colour.');
    if (style.icon !== null && (style.icon.length === 0 || style.icon.length > 16)) throw new Error('Invalid folder icon.');
    const now = Date.now();
    const item = makeQueueItem('folder', 'folder:style', id, { clientId: id, color: style.color, icon: style.icon }, now);
    await withTransaction(this.db, async () => {
      await this.folderRepo.setStyle(id, style.color, style.icon, now);
      await this.queueRepo.deleteSuperseded(id, 'folder:style');
      await this.queueRepo.insert(item);
    });
  }

  /** Replaces the document's tags; returns the normalized list that was saved. */
  async setDocumentTags(documentId: string, names: string[]): Promise<string[]> {
    const tags = normalizeTags(names);
    const now = Date.now();
    const item = makeQueueItem('document', 'tag:update', documentId, { clientId: documentId, tags }, now);
    await withTransaction(this.db, async () => {
      await this.tagRepo.setDocumentTags(documentId, tags, now);
      await this.docRepo.touch(documentId, now);
      await this.queueRepo.deleteSuperseded(documentId, 'tag:update');
      await this.queueRepo.insert(item);
      await this.recentRepo.record('document', documentId, 'modified', now);
    });
    return tags;
  }

  getDocumentTags(documentId: string): Promise<string[]> {
    return this.tagRepo.getForDocument(documentId);
  }

  getTagsForDocuments(documentIds: string[]): Promise<Record<string, string[]>> {
    return this.tagRepo.getForDocuments(documentIds);
  }

  getAllTags(): Promise<TagSummary[]> {
    return this.tagRepo.getAll();
  }

  async getFavorites(): Promise<{ folders: Folder[]; documents: Document[] }> {
    const [folders, documents] = await Promise.all([this.folderRepo.findFavorites(), this.docRepo.findFavorites()]);
    return { folders, documents };
  }

  /** The folder and its ancestors, root first — used for breadcrumbs. */
  getFolderPath(folderId: string): Promise<Folder[]> {
    return this.folderRepo.findPath(folderId);
  }
}
