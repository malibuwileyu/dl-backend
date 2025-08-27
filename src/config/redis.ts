import Redis from 'ioredis';
import { config } from './config';
import { logger } from './logger';

let redisClient: Redis;
let pubClient: Redis;
let subClient: Redis;

export async function connectRedis(): Promise<void> {
  try {
    // Railway provides internal URLs that need special handling
    const redisUrl = config.redis.url;
    console.log('[Redis] Connecting with URL format:', redisUrl.substring(0, 30) + '...');
    
    // Parse Redis URL for Railway compatibility
    let redisOptions: any = {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    };

    // For Railway internal URLs, we need to handle them specially
    if (redisUrl.includes('railway.internal')) {
      console.log('[Redis] Detected Railway internal URL, using family 6 for IPv6');
      redisOptions.family = 6; // Force IPv6 for Railway internal networking
    }

    // Main Redis client for general operations
    redisClient = new Redis(redisUrl, redisOptions);

    // Pub/Sub clients for real-time features
    pubClient = new Redis(redisUrl, redisOptions);
    subClient = new Redis(redisUrl, redisOptions);

    // Test the connection
    await redisClient.ping();

    // Set up error handling
    redisClient.on('error', (err) => {
      logger.error('Redis error:', err);
    });

    redisClient.on('connect', () => {
      logger.debug('Redis connected');
    });

  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

export function getRedis(): Redis {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call connectRedis() first.');
  }
  return redisClient;
}

export function getPubClient(): Redis {
  if (!pubClient) {
    throw new Error('Redis pub client not initialized.');
  }
  return pubClient;
}

export function getSubClient(): Redis {
  if (!subClient) {
    throw new Error('Redis sub client not initialized.');
  }
  return subClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) await redisClient.quit();
  if (pubClient) await pubClient.quit();
  if (subClient) await subClient.quit();
}

// Cache helper functions
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const value = await redisClient.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  },

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await redisClient.setex(key, ttlSeconds, serialized);
    } else {
      await redisClient.set(key, serialized);
    }
  },

  async del(key: string | string[]): Promise<void> {
    if (Array.isArray(key)) {
      if (key.length > 0) {
        await redisClient.del(...key);
      }
    } else {
      await redisClient.del(key);
    }
  },

  async exists(key: string): Promise<boolean> {
    const result = await redisClient.exists(key);
    return result === 1;
  },

  async ttl(key: string): Promise<number> {
    return redisClient.ttl(key);
  },

  async keys(pattern: string): Promise<string[]> {
    return redisClient.keys(pattern);
  }
};