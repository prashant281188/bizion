import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/api-response.js';
import { env } from '../config/env.js';

const isDev = env.NODE_ENV === 'development';

/**
 * General API rate limiter.
 * Applies to all routes — allows 100 requests per 15-minute window per IP.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 100000 : 100,
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,  // Disable X-RateLimit-* headers
  handler: (_req, res) => {
    sendError(res, 'Too many requests, please try again later', 429);
  },
});

/**
 * Strict rate limiter for authentication endpoints.
 * Prevents brute-force attacks — allows 10 requests per 15-minute window per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 100000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 'Too many authentication attempts, please try again later', 429);
  },
});

/**
 * Relaxed rate limiter for read-heavy endpoints (lists, reports).
 * Allows 200 requests per 15-minute window per IP.
 */
export const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100000 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 'Too many requests, please try again later', 429);
  },
});
