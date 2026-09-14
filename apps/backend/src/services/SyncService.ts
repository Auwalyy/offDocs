import { FolderService } from './FolderService';
import { SyncBatchInput } from '../validators';
import { logger } from '../utils/logger';

type SyncResult =
  | { idempotencyKey: string; success: true; clientId?: string; serverId?: string }
  | { idempotencyKey: string; success: false; error: string };

export class SyncService {
  private folderService = new FolderService();

  async processBatch(operations: SyncBatchInput['operations'], ownerId: string): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    for (const op of operations) {
      try {
        const result = await this.processOne(op, ownerId);
        results.push({ idempotencyKey: op.idempotencyKey, success: true, ...result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn('Sync operation failed', { op, message });
        results.push({ idempotencyKey: op.idempotencyKey, success: false, error: message });
      }
    }

    return results;
  }

  private async processOne(
    op: SyncBatchInput['operations'][number],
    ownerId: string
  ): Promise<{ clientId?: string; serverId?: string }> {
    switch (op.operation) {
      case 'folder:create': {
        const folder = await this.folderService.create({
          clientId: op.clientId,
          name: op.name,
          parentId: op.parentId,
          ownerId,
        });
        return { clientId: op.clientId, serverId: folder._id.toString() };
      }

      case 'folder:rename': {
        await this.folderService.update({ serverId: op.serverId, ownerId, name: op.name });
        return {};
      }

      case 'folder:move': {
        await this.folderService.update({ serverId: op.serverId, ownerId, parentId: op.parentId });
        return {};
      }

      case 'folder:delete': {
        await this.folderService.softDelete(op.serverId, ownerId);
        return {};
      }

      case 'document:delete': {
        // DocumentService is injected lazily to avoid circular deps
        const { DocumentService } = await import('./DocumentService');
        const docSvc = new DocumentService();
        await docSvc.softDelete(op.serverId, ownerId);
        return {};
      }
    }
  }
}
