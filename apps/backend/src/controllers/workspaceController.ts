import { Request, Response } from 'express';
import { FolderService } from '../services/FolderService';
import { DocumentService } from '../services/DocumentService';
import { SyncService } from '../services/SyncService';
import { AuthRequest } from '../middleware/authenticate';
import { SyncBatchInput } from '../validators';

const folderService   = new FolderService();
const documentService = new DocumentService();
const syncService     = new SyncService();

export async function getWorkspaceSnapshot(req: Request, res: Response): Promise<void> {
  const userId = (req as AuthRequest).userId;
  const [{ folders }, { documents }] = await Promise.all([
    folderService.getSnapshot(userId),
    documentService.getSnapshot(userId),
  ]);
  res.json({
    data: {
      folders: folders.map((f) => ({
        serverId: f._id.toString(),
        clientId: f.clientId,
        name: f.name,
        parentId: f.parentId?.toString() ?? null,
        updatedAt: f.updatedAt,
      })),
      documents: documents.map((d) => ({
        serverId: d._id.toString(),
        clientId: d.clientId,
        name: d.name,
        folderId: d.folderId.toString(),
        mimeType: d.mimeType,
        fileSize: d.fileSize,
        updatedAt: d.updatedAt,
      })),
    },
  });
}

export async function syncBatch(req: Request, res: Response): Promise<void> {
  const userId = (req as AuthRequest).userId;
  const { operations } = req.body as SyncBatchInput;
  const results = await syncService.processBatch(operations, userId);
  res.json({ data: { results } });
}
