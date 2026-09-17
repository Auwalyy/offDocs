import { Request, Response } from 'express';
import { DocumentService } from '../services/DocumentService';
import { AuthRequest } from '../middleware/authenticate';
import { createDocumentSchema } from '../validators';
import { localPathForKey, usesLocalStorage } from '../config/storage';

const documentService = new DocumentService();

export async function createDocument(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).userId;
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: { code: 'NO_FILE', message: 'File is required.' } });
      return;
    }

    const parsed = createDocumentSchema.safeParse({
      ...req.body,
      fileSize: file.size,
      mimeType: file.mimetype,
    });
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid document metadata.', details: parsed.error.flatten().fieldErrors } });
      return;
    }

    const { clientId, folderId, name, mimeType, fileSize, contentHash } = parsed.data;
    const doc = await documentService.create({
      clientId, folderId, ownerId: userId, name, mimeType,
      fileBuffer: file.buffer, fileSize, contentHash,
    });

    res.status(201).json({
      data: {
        clientId: doc.clientId,
        serverId: doc._id.toString(),
        name: doc.name,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        storageKey: doc.storageKey,
      },
    });
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === 'FOLDER_NOT_FOUND') {
      res.status(404).json({ error: { code: 'FOLDER_NOT_FOUND', message: e.message } });
    } else {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to upload document.' } });
    }
  }
}

export async function deleteDocument(req: Request, res: Response): Promise<void> {
  const userId = (req as AuthRequest).userId;
  const { serverId } = req.params as { serverId: string };
  await documentService.softDelete(serverId, userId);
  res.status(204).send();
}

/** Streams a document stored on local disk (development storage mode only). */
export async function getDocumentFile(req: Request, res: Response): Promise<void> {
  const userId = (req as AuthRequest).userId;
  const { serverId } = req.params as { serverId: string };
  const doc = await documentService.findById(serverId, userId);
  if (!doc || !usesLocalStorage) {
    res.status(404).json({ error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' } });
    return;
  }
  res.type(doc.mimeType);
  res.sendFile(localPathForKey(doc.storageKey), (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: { code: 'FILE_MISSING', message: 'Stored file is missing.' } });
    }
  });
}

export async function getDocumentDownloadUrl(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).userId;
    const { serverId } = req.params as { serverId: string };
    const url = await documentService.getDownloadUrl(serverId, userId);
    res.json({ data: { url } });
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === 'DOCUMENT_NOT_FOUND') {
      res.status(404).json({ error: { code: 'DOCUMENT_NOT_FOUND', message: e.message } });
    } else {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get download URL.' } });
    }
  }
}
