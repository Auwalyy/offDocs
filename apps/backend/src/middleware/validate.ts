import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema, source: 'body' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(source === 'body' ? req.body : req.query);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data.',
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }
    if (source === 'body') req.body = result.data;
    next();
  };
}
