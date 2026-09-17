import fs from 'fs';
import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/api-error.js';
import { sendError } from '../utils/api-response.js';
import { env } from '../config/env.js';

/**
 * Global error handling middleware.
 * Must be the last middleware registered (after all routes).
 *
 * Distinguishes between:
 * - Operational errors (ApiError): Expected errors, return structured response
 * - Programming errors: Unexpected errors, log and return generic 500
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle our custom ApiError instances
  if (err instanceof ApiError) {
    sendError(res, err.message, err.statusCode);
    return;
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    sendError(res, 'Validation failed', 400);
    return;
  }

  // Handle JSON parse errors
  if (err instanceof SyntaxError && 'body' in err) {
    sendError(res, 'Invalid JSON in request body', 400);
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    sendError(res, 'Invalid token', 401);
    return;
  }

  if (err.name === 'TokenExpiredError') {
    sendError(res, 'Token expired', 401);
    return;
  }

  // Unknown / programming errors
  console.error('Unhandled error:', err);
  
  try {
    fs.appendFileSync('error_log.txt', new Date().toISOString() + '\n' + (err.stack || err.message) + '\n\n');
  } catch (e) {}

  const message =
    env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : err.message || 'Internal Server Error';

  sendError(res, message, 500);
}
