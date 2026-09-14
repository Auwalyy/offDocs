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

export const updateFolderSchema = z.object({
  name:     z.string().min(1).max(255).trim().optional(),
  parentId: z.string().nullable().optional(),
}).refine((d) => d.name !== undefined || d.parentId !== undefined, {
  message: 'At least one of name or parentId must be provided',
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
export type SyncBatchInput      = z.infer<typeof syncBatchSchema>;
