import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { connectDatabase } from './config/database';
import { usesLocalStorage, LOCAL_UPLOAD_DIR } from './config/storage';
import { router } from './routes';
import { logger } from './utils/logger';
import { config } from './config';

const app = express();

// Log every API call (method, path, status, duration) so sync problems are visible in the server terminal.
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    const line = `${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - started} ms)`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else if (config.NODE_ENV !== 'test') logger.info(line);
  });
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// Health check (no auth)
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// API routes
app.use('/api/v1', router);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err.message.startsWith('Unsupported file type')) {
    res.status(415).json({ error: { code: 'UNSUPPORTED_FILE_TYPE', message: err.message } });
    return;
  }
  if ((err as Error & { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Malformed JSON body.' } });
    return;
  }
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
});

async function start() {
  await connectDatabase();
  if (usesLocalStorage) {
    logger.warn(`Object storage is not configured (STORAGE_* env vars are placeholders). Storing uploads on local disk in ${LOCAL_UPLOAD_DIR} (development only).`);
  }
  const port = parseInt(config.PORT, 10);
  // Bind to all interfaces so phones/emulators on the LAN can reach the API.
  app.listen(port, '0.0.0.0', () => logger.info(`FolioSync API listening on port ${port}`));
}

// Only listen when run directly (dev/prod), not when imported by tests.
if (require.main === module) {
  start().catch((err: unknown) => {
    logger.error('Failed to start server', { err });
    process.exit(1);
  });
}

export { app };
