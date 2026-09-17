import { Redis } from 'ioredis';
import { env } from '../config/env.js';

// Global cache instance
let redisClient: Redis | null = null;

// In-memory fallback (used if Redis URL is not provided or connection fails)
const memoryCache = new Map<string, { value: any; expiresAt: number }>();

// Try to initialize Redis if a URL is provided
if (env.REDIS_URL) {
  try {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 3) {
          console.warn('Redis connection failed, falling back to in-memory cache.');
          return null; // Stop retrying
        }
        return Math.min(times * 50, 2000);
      }
    });

    redisClient.on('error', (err: Error) => {
      console.warn('Redis Error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('Connected to Redis Cache');
    });
  } catch (err) {
    console.warn('Failed to initialize Redis client, falling back to in-memory cache.', err);
    redisClient = null;
  }
} else {
  console.log('No REDIS_URL provided, using in-memory fallback cache.');
}

/**
 * Clean up expired items from the memory cache
 */
const cleanupMemoryCache = () => {
  const now = Date.now();
  for (const [key, item] of memoryCache.entries()) {
    if (item.expiresAt < now) {
      memoryCache.delete(key);
    }
  }
};

// Run cleanup every 60 seconds for the memory cache
setInterval(cleanupMemoryCache, 60000).unref();

export const cacheService = {
  /**
   * Get a value from the cache
   * @param key The cache key
   * @returns The parsed JSON value, or null if not found/expired
   */
  async get(key: string): Promise<any | null> {
    if (redisClient && redisClient.status === 'ready') {
      try {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
      } catch (err) {
        console.warn(`Redis get error for key ${key}:`, err);
        return null; // Fallback to fetching fresh data if Redis errors
      }
    } else {
      // In-memory fallback
      const item = memoryCache.get(key);
      if (!item) return null;
      if (item.expiresAt < Date.now()) {
        memoryCache.delete(key);
        return null;
      }
      return item.value;
    }
  },

  /**
   * Set a value in the cache
   * @param key The cache key
   * @param value The value to cache (will be JSON.stringified)
   * @param ttlSeconds Time to live in seconds
   */
  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    if (redisClient && redisClient.status === 'ready') {
      try {
        await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      } catch (err) {
        console.warn(`Redis set error for key ${key}:`, err);
      }
    } else {
      // In-memory fallback
      memoryCache.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    }
  },

  /**
   * Invalidate cache keys matching a pattern
   * @param pattern Pattern to match (e.g. "*public*")
   */
  async invalidatePattern(pattern: string): Promise<void> {
    if (redisClient && redisClient.status === 'ready') {
      try {
        // Warning: KEYS is blocking in Redis, but acceptable for small stores.
        // In production with millions of keys, use SCAN instead.
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      } catch (err) {
        console.warn(`Redis invalidatePattern error for pattern ${pattern}:`, err);
      }
    } else {
      // In-memory fallback matching
      const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      for (const key of memoryCache.keys()) {
        if (regexPattern.test(key)) {
          memoryCache.delete(key);
        }
      }
    }
  }
};
