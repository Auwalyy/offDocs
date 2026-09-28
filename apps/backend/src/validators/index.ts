import { z } from 'zod';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email:       z.string().email().max(254),
  password:    z.string().min(8).max(128),
  displayName: z.string().min(1).max(100).trim(),
});

export const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ─── Folders ──────────────────────────────────────────────────────────────────

export const createFolderSchema = z.object({
  clientId: z.string().uuid(),
  name:     z.string().min(1).max(255).trim(),
  parentId: z.string().nullable().optional(),
});

/** Folder colours are stored as #RRGGBB; icons are a short emoji chosen on the device. */
const folderColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be #RRGGBB').nullable();
const folderIcon  = z.string().min(1).max(16).nullable();

export const updateFolderSchema = z.object({
  name:       z.string().min(1).max(255).trim().optional(),
  parentId:   z.string().nullable().optional(),
  color:      folderColor.optional(),
  icon:       folderIcon.optional(),
  isFavorite: z.boolean().optional(),
}).refine((d) => Object.values(d).some((v) => v !== undefined), {
  message: 'At least one field must be provided',
});

// ─── Documents ────────────────────────────────────────────────────────────────

export const createDocumentSchema = z.object({
  clientId:    z.string().uuid(),
  folderId:    z.string().min(1),   // server folder _id
  name:        z.string().min(1).max(255).trim(),
  mimeType:    z.enum([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]),
  fileSize:    z.coerce.number().int().positive(),
  contentHash: z.string().optional(),
});

export const MAX_TAGS_PER_DOCUMENT = 20;

/** Tags are replaced as a whole list, so retries and out-of-order devices converge. */
export const updateDocumentSchema = z.object({
  isFavorite: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(MAX_TAGS_PER_DOCUMENT).optional(),
}).refine((d) => d.isFavorite !== undefined || d.tags !== undefined, {
  message: 'At least one of isFavorite or tags must be provided',
});

// ─── Sync ─────────────────────────────────────────────────────────────────────

const syncOperationSchema = z.discriminatedUnion('operation', [
  z.object({
    idempotencyKey: z.string().uuid(),
    operation:      z.literal('folder:create'),
    clientId:       z.string().uuid(),
    name:           z.string().min(1).max(255),
    parentId:       z.string().nullable().optional(),
  }),
  z.object({
    idempotencyKey: z.string().uuid(),
    operation:      z.literal('folder:rename'),
    serverId:       z.string().min(1),
    name:           z.string().min(1).max(255),
  }),
  z.object({
    idempotencyKey: z.string().uuid(),
    operation:      z.literal('folder:move'),
    serverId:       z.string().min(1),
    parentId:       z.string().nullable(),
  }),
  z.object({
    idempotencyKey: z.string().uuid(),
    operation:      z.literal('folder:delete'),
    serverId:       z.string().min(1),
  }),
  z.object({
    idempotencyKey: z.string().uuid(),
    operation:      z.literal('document:delete'),
    serverId:       z.string().min(1),
  }),
]);

export const syncBatchSchema = z.object({
  operations: z.array(syncOperationSchema).min(1).max(100),
});

export type RegisterInput       = z.infer<typeof registerSchema>;
export type LoginInput          = z.infer<typeof loginSchema>;
export type RefreshInput        = z.infer<typeof refreshSchema>;
export type CreateFolderInput   = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput   = z.infer<typeof updateFolderSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type SyncBatchInput      = z.infer<typeof syncBatchSchema>;
