import { Request, Response, NextFunction } from 'express';
import { IdempotencyKey } from '../models/IdempotencyKey';
import { logger } from '../utils/logger';

/**
 * Idempotency middleware.
 *
 * If the request carries an `Idempotency-Key` header and that key has been
 * processed before, the stored response is returned immediately without
 * re-executing the handler.
 *
 * The response is stored after the handler completes by monkey-patching
 * `res.json`.
 */
export function idempotency(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['idempotency-key'];
  if (!key || typeof key !== 'string') {
    next();
    return;
  }

  IdempotencyKey.findOne({ key })
    .then((existing) => {
      if (existing) {
        res.status(existing.statusCode).json(JSON.parse(existing.responseBody));
        return;
      }

      // Intercept res.json to capture the response
      const originalJson = res.json.bind(res);
      res.json = (body: unknown) => {
        IdempotencyKey.create({
          key,
          responseBody: JSON.stringify(body),
          statusCode: res.statusCode,
        }).catch((err: unknown) => logger.error('Failed to store idempotency key', { err }));
        return originalJson(body);
      };

      next();
    })
    .catch((err: unknown) => {
      logger.error('Idempotency middleware error', { err });
      next();
    });
}
