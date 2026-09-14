import { Types } from 'mongoose';
import { Folder, IFolder } from '../models/Folder';
import { Doc } from '../models/Document';

export class FolderService {
  async create(params: {
    clientId: string;
    name: string;
    parentId: string | null | undefined;
    ownerId: string;
  }): Promise<IFolder> {
    const ownerOid = new Types.ObjectId(params.ownerId);

    // Idempotent: return existing if clientId already exists for this owner
    const existing = await Folder.findOne({ ownerId: ownerOid, clientId: params.clientId });
    if (existing) return existing;

    let parentOid: Types.ObjectId | null = null;
    if (params.parentId) {
      const parent = await Folder.findOne({ _id: params.parentId, ownerId: ownerOid, deletedAt: null });
      if (!parent) throw Object.assign(new Error('Parent folder not found.'), { code: 'FOLDER_NOT_FOUND' });
      parentOid = parent._id;
    }

    return Folder.create({
      clientId: params.clientId,
      name: params.name,
      parentId: parentOid,
      ownerId: ownerOid,
      path: '',
    });
  }

  async update(params: {
    serverId: string;
    ownerId: string;
    name?: string;
    parentId?: string | null;
  }): Promise<IFolder> {
    const folder = await Folder.findOne({
      _id: params.serverId,
      ownerId: params.ownerId,
      deletedAt: null,
    });
    if (!folder) throw Object.assign(new Error('Folder not found.'), { code: 'FOLDER_NOT_FOUND' });

    if (params.name !== undefined) folder.name = params.name;
    if (params.parentId !== undefined) {
      if (params.parentId === null) {
        folder.parentId = null;
      } else {
        const parent = await Folder.findOne({ _id: params.parentId, ownerId: params.ownerId, deletedAt: null });
        if (!parent) throw Object.assign(new Error('Parent folder not found.'), { code: 'FOLDER_NOT_FOUND' });
        folder.parentId = parent._id;
      }
    }

    return folder.save();
  }

  async softDelete(serverId: string, ownerId: string): Promise<void> {
    const folder = await Folder.findOne({ _id: serverId, ownerId, deletedAt: null });
    if (!folder) return; // already deleted — idempotent

    // Conflict resolution Case B: move orphaned documents to lost-and-found
    const lostAndFound = await this.getOrCreateLostAndFound(ownerId);
    await Doc.updateMany(
      { folderId: folder._id, ownerId, deletedAt: null },
      { $set: { folderId: lostAndFound._id } }
    );

    folder.deletedAt = new Date();
    await folder.save();
  }

  async findById(serverId: string, ownerId: string): Promise<IFolder | null> {
    return Folder.findOne({ _id: serverId, ownerId, deletedAt: null });
  }

  async findByOwner(ownerId: string, parentId: string | null): Promise<IFolder[]> {
    const query = parentId
      ? { ownerId, parentId: new Types.ObjectId(parentId), deletedAt: null }
      : { ownerId, parentId: null, deletedAt: null };
    return Folder.find(query).sort({ name: 1 });
  }

  async getSnapshot(ownerId: string): Promise<{ folders: IFolder[] }> {
    const folders = await Folder.find({ ownerId, deletedAt: null }).sort({ createdAt: 1 });
    return { folders };
  }

  private async getOrCreateLostAndFound(ownerId: string): Promise<IFolder> {
    const existing = await Folder.findOne({ ownerId, name: '__lost-and-found__', parentId: null });
    if (existing) return existing;
    return Folder.create({
      clientId: `lost-and-found-${ownerId}`,
      name: '__lost-and-found__',
      parentId: null,
      ownerId: new Types.ObjectId(ownerId),
      path: '',
    });
  }
}
