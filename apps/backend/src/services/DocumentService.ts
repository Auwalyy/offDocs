import { Types } from 'mongoose';
import { Doc, IDocument } from '../models/Document';
import { Folder } from '../models/Folder';
import { uploadFile, deleteFile, buildStorageKey, getPresignedDownloadUrl } from '../config/storage';

export class DocumentService {
  async create(params: {
    clientId: string;
    folderId: string;
    ownerId: string;
    name: string;
    mimeType: string;
    fileBuffer: Buffer;
    fileSize: number;
    contentHash?: string;
  }): Promise<IDocument> {
    const ownerOid = new Types.ObjectId(params.ownerId);

    // Idempotent: return existing if clientId already exists for this owner
    const existing = await Doc.findOne({ ownerId: ownerOid, clientId: params.clientId });
    if (existing) return existing;

    // Verify folder ownership
    const folder = await Folder.findOne({ _id: params.folderId, ownerId: ownerOid, deletedAt: null });
    if (!folder) throw Object.assign(new Error('Folder not found.'), { code: 'FOLDER_NOT_FOUND' });

    const storageKey = buildStorageKey(params.ownerId, params.clientId, params.name);
    await uploadFile({ key: storageKey, body: params.fileBuffer, contentType: params.mimeType });

    return Doc.create({
      clientId:    params.clientId,
      folderId:    folder._id,
      ownerId:     ownerOid,
      name:        params.name,
      mimeType:    params.mimeType,
      storageKey,
      fileSize:    params.fileSize,
      contentHash: params.contentHash ?? null,
    });
  }

  async softDelete(serverId: string, ownerId: string): Promise<void> {
    const doc = await Doc.findOne({ _id: serverId, ownerId, deletedAt: null });
    if (!doc) return; // already deleted — idempotent

    await deleteFile(doc.storageKey);
    doc.deletedAt = new Date();
    await doc.save();
  }

  async findById(serverId: string, ownerId: string): Promise<IDocument | null> {
    return Doc.findOne({ _id: serverId, ownerId, deletedAt: null });
  }

  async getDownloadUrl(serverId: string, ownerId: string): Promise<string> {
    const doc = await Doc.findOne({ _id: serverId, ownerId, deletedAt: null });
    if (!doc) throw Object.assign(new Error('Document not found.'), { code: 'DOCUMENT_NOT_FOUND' });
    return getPresignedDownloadUrl(doc.storageKey);
  }

  async getSnapshot(ownerId: string): Promise<{ documents: IDocument[] }> {
    const documents = await Doc.find({ ownerId, deletedAt: null }).sort({ createdAt: 1 });
    return { documents };
  }
}
