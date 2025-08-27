import { z } from 'zod';

// Debug environment variables on Railway
console.log('=== Environment Variables Debug ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('REDIS_URL exists:', !!process.env.REDIS_URL);
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('CORS_ORIGINS:', process.env.CORS_ORIGINS);
console.log('All env keys:', Object.keys(process.env).sort().join(', '));
console.log('=================================');

// Environment variable schema
const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  API_PREFIX: z.string().default('/api/v1'),
  
  // Database
  DATABASE_URL: z.string(),
  DATABASE_POOL_SIZE: z.string().transform(Number).default('20'),
  
  // Redis
  REDIS_URL: z.string(),
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // Bcrypt
  BCRYPT_ROUNDS: z.string().transform(Number).default('10'),
  
  // CORS
  CORS_ORIGINS: z.string().transform(val => val.split(',')),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_DIR: z.string().default('logs'),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  
  // File upload
  MAX_FILE_SIZE: z.string().transform(Number).default('10485760'),
  
  // Analytics service
  ANALYTICS_SERVICE_URL: z.string().optional(),
  
  // WebSocket
  WS_PATH: z.string().default('/socket.io'),
  
  // Features
  ENABLE_SCREENSHOTS: z.string().transform(val => val === 'true').default('false'),
  ENABLE_REALTIME_ALERTS: z.string().transform(val => val === 'true').default('true'),
  ENABLE_AI_CATEGORIZATION: z.string().transform(val => val === 'true').default('true'),
});

// Parse and validate environment variables
const env = envSchema.parse(process.env);

// Exported configuration object
export const config = {
  app: {
    env: env.NODE_ENV,
    port: env.PORT,
    apiPrefix: env.API_PREFIX,
  },
  
  database: {
    url: env.DATABASE_URL,
    poolSize: env.DATABASE_POOL_SIZE,
  },
  
  redis: {
    url: env.REDIS_URL,
  },
  
  auth: {
    jwt: {
      secret: env.JWT_SECRET,
      expiresIn: env.JWT_EXPIRES_IN,
      refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    },
    bcrypt: {
      rounds: env.BCRYPT_ROUNDS,
    },
  },
  
  cors: {
    origins: env.CORS_ORIGINS,
  },
  
  logging: {
    level: env.LOG_LEVEL,
    dir: env.LOG_DIR,
  },
  
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },
  
  upload: {
    maxFileSize: env.MAX_FILE_SIZE,
  },
  
  services: {
    analytics: env.ANALYTICS_SERVICE_URL,
  },
  
  ws: {
    path: env.WS_PATH,
  },
  
  features: {
    screenshots: env.ENABLE_SCREENSHOTS,
    realtimeAlerts: env.ENABLE_REALTIME_ALERTS,
    aiCategorization: env.ENABLE_AI_CATEGORIZATION,
  },
} as const;

export type Config = typeof config;