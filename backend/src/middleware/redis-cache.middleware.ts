import { Request, Response, NextFunction } from 'express';
import { cacheService } from '../utils/cache.js';

/**
 * Middleware to cache API responses in Redis (or in-memory fallback)
 * @param durationSeconds Time to live in seconds
 */
export const redisCacheMiddleware = (durationSeconds: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl}`;

    try {
      const cachedData = await cacheService.get(key);
      if (cachedData) {
        // Cache hit
        res.setHeader('X-Cache', 'HIT');
        return res.json(cachedData);
      }
      
      // Cache miss: Intercept res.json to cache the output
      const originalJson = res.json.bind(res);
      
      res.json = (body: any) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheService.set(key, body, durationSeconds).catch(err => {
            console.error('Failed to set cache in middleware:', err);
          });
        }
        
        res.setHeader('X-Cache', 'MISS');
        return originalJson(body);
      };

      next();
    } catch (err) {
      console.error('Cache middleware error:', err);
      next(); // Continue even if cache fails
    }
  };
};
