import { Router } from 'express';
import { Types } from 'mongoose';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { idempotency } from '../middleware/idempotency';
import { upload } from '../middleware/upload';
import {
  registerSchema, loginSchema, refreshSchema,
  createFolderSchema, updateFolderSchema,
  syncBatchSchema,
} from '../validators';
import * as auth     from '../controllers/authController';
import * as folders  from '../controllers/folderController';
import * as docs     from '../controllers/documentController';
import * as workspace from '../controllers/workspaceController';

const router = Router();

// Reject malformed ids up front instead of letting Mongoose throw a CastError (500).
router.param('serverId', (_req, res, next, value: string) => {
  if (!Types.ObjectId.isValid(value)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid resource id.' } });
    return;
  }
  next();
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
router.post('/auth/register', validate(registerSchema), auth.register);
router.post('/auth/login',    validate(loginSchema),    auth.login);
router.post('/auth/refresh',  validate(refreshSchema),  auth.refresh);
router.post('/auth/logout',   authenticate,             auth.logout);

// ─── Workspace snapshot ───────────────────────────────────────────────────────
router.get('/workspace/snapshot', authenticate, workspace.getWorkspaceSnapshot);

// ─── Folders ──────────────────────────────────────────────────────────────────
router.post(  '/folders',           authenticate, idempotency, validate(createFolderSchema), folders.createFolder);
router.get(   '/folders/:serverId', authenticate, folders.getFolder);
router.patch( '/folders/:serverId', authenticate, idempotency, validate(updateFolderSchema), folders.updateFolder);
router.delete('/folders/:serverId', authenticate, idempotency, folders.deleteFolder);

// ─── Documents ────────────────────────────────────────────────────────────────
router.post(  '/documents',                    authenticate, idempotency, upload.single('file'), docs.createDocument);
router.get(   '/documents/:serverId/download', authenticate, docs.getDocumentDownloadUrl);
router.get(   '/documents/:serverId/file',     authenticate, docs.getDocumentFile);
router.delete('/documents/:serverId',          authenticate, idempotency, docs.deleteDocument);

// ─── Sync batch ───────────────────────────────────────────────────────────────
router.post('/sync/batch', authenticate, idempotency, validate(syncBatchSchema), workspace.syncBatch);

export { router };
