import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { connectDatabase } from './config/database';
import { router } from './routes';
import { logger } from './utils/logger';
import { config } from './config';

const app = express();

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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
});

async function start() {
  await connectDatabase();
  const port = parseInt(config.PORT, 10);
  app.listen(port, () => logger.info(`FolioSync API listening on port ${port}`));
}

start().catch((err: unknown) => {
  logger.error('Failed to start server', { err });
  process.exit(1);
});

export { app };
