import { Request, Response, NextFunction } from 'express';
import { IdempotencyKey } from '../models/IdempotencyKey';
import { AuthRequest } from './authenticate';
import { logger } from '../utils/logger';

/**
 * Idempotency middleware. Must run after `authenticate`.
 *
 * If the request carries an `Idempotency-Key` header and that key has been
 * processed successfully before, the stored response is returned immediately
 * without re-executing the handler.
 *
 * Only successful (2xx) JSON responses are stored. Errors are never cached,
 * otherwise a transient failure (storage outage, parent not yet synced, …)
 * would be replayed forever to a client retrying with the same key.
 *
 * Keys are scoped per user so one account can never read another's response.
 */
export function idempotency(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers['idempotency-key'];
  if (!header || typeof header !== 'string') {
    next();
    return;
  }
  const key = `${(req as AuthRequest).userId}:${header}`;

  IdempotencyKey.findOne({ key })
    .then((existing) => {
      if (existing) {
        res.status(existing.statusCode).json(JSON.parse(existing.responseBody));
        return;
      }

      const originalJson = res.json.bind(res);
      res.json = (body: unknown) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          IdempotencyKey.create({
            key,
            responseBody: JSON.stringify(body),
            statusCode: res.statusCode,
          }).catch((err: unknown) => logger.error('Failed to store idempotency key', { err }));
        }
        return originalJson(body);
      };

      next();
    })
    .catch((err: unknown) => {
      logger.error('Idempotency middleware error', { err });
      next();
    });
}
