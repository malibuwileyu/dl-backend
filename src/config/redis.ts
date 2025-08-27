import Redis from 'ioredis';
import { config } from './config';
import { logger } from './logger';

let redisClient: Redis;
let pubClient: Redis;
let subClient: Redis;

export async function connectRedis(): Promise<void> {
  try {
    // Main Redis client for general operations
    redisClient = new Redis(config.redis.url, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    // Pub/Sub clients for real-time features
    pubClient = new Redis(config.redis.url);
    subClient = new Redis(config.redis.url);

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