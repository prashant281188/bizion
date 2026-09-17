import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { sendError } from '../utils/api-response.js';

type ZodSchema = ZodTypeAny;


/**
 * Zod validation middleware factory.
 * Validates request body, query params, and/or route params against Zod schemas.
 *
 * Usage:
 *   router.post('/endpoint', validate({ body: createUserSchema }), controller.create);
 *   router.get('/endpoint', validate({ query: listQuerySchema }), controller.list);
 *   router.get('/endpoint/:id', validate({ params: idParamSchema }), controller.get);
 */
export function validate(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }

      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query) as typeof req.query;
      }

      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params) as typeof req.params;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors: Record<string, string[]> = {};

        for (const issue of error.issues) {
          const path = issue.path.join('.');
          const key = path || '_root';
          if (!formattedErrors[key]) {
            formattedErrors[key] = [];
          }
          formattedErrors[key].push(issue.message);
        }

        sendError(_res, 'Validation failed', 400, formattedErrors);
        return;
      }

      next(error);
    }
  };
}
