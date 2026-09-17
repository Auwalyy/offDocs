import { Request, Response } from 'express';
import { FolderService } from '../services/FolderService';
import { AuthRequest } from '../middleware/authenticate';

const folderService = new FolderService();

export async function createFolder(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).userId;
    const { clientId, name, parentId } = req.body as { clientId: string; name: string; parentId?: string | null };
    const folder = await folderService.create({ clientId, name, parentId, ownerId: userId });
    res.status(201).json({
      data: {
        clientId: folder.clientId,
        serverId: folder._id.toString(),
        name: folder.name,
        parentId: folder.parentId?.toString() ?? null,
      },
    });
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === 'FOLDER_NOT_FOUND') {
      res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: e.message } });
    } else {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create folder.' } });
    }
  }
}

export async function updateFolder(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).userId;
    const { serverId } = req.params as { serverId: string };
    const { name, parentId } = req.body as { name?: string; parentId?: string | null };
    const folder = await folderService.update({ serverId, ownerId: userId, name, parentId });
    res.json({
      data: {
        serverId: folder._id.toString(),
        name: folder.name,
        parentId: folder.parentId?.toString() ?? null,
      },
    });
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === 'FOLDER_NOT_FOUND') {
      res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: e.message } });
    } else if (e.code === 'INVALID_MOVE') {
      res.status(400).json({ error: { code: 'INVALID_MOVE', message: e.message } });
    } else {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update folder.' } });
    }
  }
}

export async function deleteFolder(req: Request, res: Response): Promise<void> {
  const userId = (req as AuthRequest).userId;
  const { serverId } = req.params as { serverId: string };
  await folderService.softDelete(serverId, userId);
  res.status(204).send();
}

export async function getFolder(req: Request, res: Response): Promise<void> {
  const userId = (req as AuthRequest).userId;
  const { serverId } = req.params as { serverId: string };
  const folder = await folderService.findById(serverId, userId);
  if (!folder) {
    res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found.' } });
    return;
  }
  res.json({ data: { serverId: folder._id.toString(), name: folder.name, parentId: folder.parentId?.toString() ?? null } });
}
