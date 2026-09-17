import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

/**
 * JWT payload structure for authenticated users.
 */
export interface JwtPayload {
  userId: string;
  orgId: string;
  email: string;
  role: string;
  contactId?: string | null;
  permissions?: string[];
}

/**
 * Extend Express Request with authenticated user data.
 */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * JWT authentication middleware.
 * Extracts and verifies the JWT from the Authorization header (Bearer scheme).
 * Attaches the decoded user payload to `req.user` for downstream handlers.
 *
 * Throws 401 if no token is provided or if the token is invalid/expired.
 */
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Access token is required');
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    throw ApiError.unauthorized('Access token is required');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    req.user = {
      userId: decoded.userId,
      orgId: decoded.orgId,
      email: decoded.email,
      role: decoded.role,
      contactId: decoded.contactId,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized('Access token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw ApiError.unauthorized('Invalid access token');
    }
    throw ApiError.unauthorized('Authentication failed');
  }
}

/**
 * Optional authentication middleware.
 * If a valid token is present, attaches user data. Otherwise continues without error.
 * Useful for endpoints that behave differently for authenticated vs. anonymous users.
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = {
      userId: decoded.userId,
      orgId: decoded.orgId,
      email: decoded.email,
      role: decoded.role,
    };
  } catch {
    // Silently continue without user data
  }

  next();
}
