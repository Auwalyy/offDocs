import { Types } from 'mongoose';
import { Folder, IFolder } from '../models/Folder';
import { Doc } from '../models/Document';

export const LOST_AND_FOUND_NAME = '__lost-and-found__';

function notFound(message = 'Folder not found.') {
  return Object.assign(new Error(message), { code: 'FOLDER_NOT_FOUND' });
}

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
      if (!Types.ObjectId.isValid(params.parentId)) throw notFound('Parent folder not found.');
      const parent = await Folder.findOne({ _id: params.parentId, ownerId: ownerOid, deletedAt: null });
      if (!parent) throw notFound('Parent folder not found.');
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
    if (!folder) throw notFound();

    if (params.name !== undefined) folder.name = params.name;
    if (params.parentId !== undefined) {
      if (params.parentId === null) {
        folder.parentId = null;
      } else {
        if (!Types.ObjectId.isValid(params.parentId)) throw notFound('Parent folder not found.');
        const parent = await Folder.findOne({ _id: params.parentId, ownerId: params.ownerId, deletedAt: null });
        if (!parent) throw notFound('Parent folder not found.');
        if (await this.isSelfOrDescendant(parent._id, folder._id, params.ownerId)) {
          throw Object.assign(new Error('A folder cannot be moved into itself or one of its subfolders.'), { code: 'INVALID_MOVE' });
        }
        folder.parentId = parent._id;
      }
    }

    return folder.save();
  }

  /**
   * Soft-deletes a folder and all of its subfolders.
   * Conflict resolution Case B2: documents that still live in the deleted
   * subtree on the server are preserved in lost-and-found.
   */
  async softDelete(serverId: string, ownerId: string): Promise<void> {
    const folder = await Folder.findOne({ _id: serverId, ownerId, deletedAt: null });
    if (!folder) return; // already deleted — idempotent

    const subtreeIds = await this.collectSubtreeIds(folder._id, ownerId);

    const orphanCount = await Doc.countDocuments({ folderId: { $in: subtreeIds }, ownerId, deletedAt: null });
    if (orphanCount > 0) {
      const lostAndFound = await this.getOrCreateLostAndFound(ownerId);
      await Doc.updateMany(
        { folderId: { $in: subtreeIds }, ownerId, deletedAt: null },
        { $set: { folderId: lostAndFound._id } }
      );
    }

    await Folder.updateMany({ _id: { $in: subtreeIds }, ownerId }, { $set: { deletedAt: new Date() } });
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

  async getOrCreateLostAndFound(ownerId: string): Promise<IFolder> {
    const query = { ownerId, clientId: `lost-and-found-${ownerId}` };
    const existing = await Folder.findOne(query);
    if (existing) {
      if (existing.deletedAt) {
        existing.deletedAt = null;
        existing.parentId = null;
        await existing.save();
      }
      return existing;
    }
    try {
      return await Folder.create({
        clientId: query.clientId,
        name: LOST_AND_FOUND_NAME,
        parentId: null,
        ownerId: new Types.ObjectId(ownerId),
        path: '',
      });
    } catch (err) {
      // Lost a race with a concurrent request (unique ownerId+clientId index).
      const created = await Folder.findOne(query);
      if (created) return created;
      throw err;
    }
  }

  private async collectSubtreeIds(rootId: Types.ObjectId, ownerId: string): Promise<Types.ObjectId[]> {
    const ids: Types.ObjectId[] = [rootId];
    let frontier: Types.ObjectId[] = [rootId];
    while (frontier.length > 0) {
      const children = await Folder.find(
        { ownerId, parentId: { $in: frontier }, deletedAt: null },
        { _id: 1 }
      );
      frontier = children.map((c) => c._id);
      ids.push(...frontier);
    }
    return ids;
  }

  /** True if `candidateId` is `folderId` or lies somewhere beneath it. */
  private async isSelfOrDescendant(
    candidateId: Types.ObjectId,
    folderId: Types.ObjectId,
    ownerId: string
  ): Promise<boolean> {
    let current: Types.ObjectId | null = candidateId;
    const seen = new Set<string>();
    while (current) {
      const key = current.toString();
      if (key === folderId.toString()) return true;
      if (seen.has(key)) return false; // defensive: existing cycle in data
      seen.add(key);
      const node: IFolder | null = await Folder.findOne({ _id: current, ownerId }, { parentId: 1 });
      current = node?.parentId ?? null;
    }
    return false;
  }
}
