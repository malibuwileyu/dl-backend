import { DataSource } from 'typeorm';
import { Activity } from '../entities/Activity';
import { User } from '../entities/User';
import { WebsiteCategory } from '../entities/WebsiteCategory';
import { AICategorizationSuggestion } from '../entities/AICategorizationSuggestion';
import { ManualActivity } from '../entities/ManualActivity';
import { AppCategory } from '../entities/AppCategory';
import { SubcategoryDefinition } from '../entities/SubcategoryDefinition';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { config } from './config';
import { logger } from './logger';

dotenv.config();

// Parse DATABASE_URL if available (for Railway/Heroku style deployments)
const databaseUrl = process.env.DATABASE_URL || config.database.url;
let dbConfig: any = {};

if (databaseUrl) {
  // Use connection string directly
  dbConfig = {
    type: 'postgres',
    url: databaseUrl,
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false,
  };
} else {
  // Fall back to individual env vars
  dbConfig = {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'student_time_tracker',
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
  };
}

export const AppDataSource = new DataSource({
  ...dbConfig,
  entities: [
    Activity,
    User,
    WebsiteCategory,
    AICategorizationSuggestion,
    ManualActivity,
    AppCategory,
    SubcategoryDefinition
  ],
  migrations: [__dirname + '/../migrations/*.{js,ts}'],
  subscribers: [],
});

// Legacy pg pool for existing code
let pool: Pool;

export async function connectDatabase(): Promise<void> {
  try {
    console.log('[Database] Using DATABASE_URL:', databaseUrl ? 'Yes' : 'No');
    console.log('[Database] Database URL format check:', databaseUrl?.startsWith('postgres') ? 'Valid PostgreSQL URL' : 'Invalid or missing');
    
    // Initialize TypeORM
    await AppDataSource.initialize();
    
    // Also create legacy pool for existing code
    pool = new Pool({
      connectionString: config.database.url,
      max: config.database.poolSize,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test the connection
    await pool.query('SELECT NOW()');
    
    // Set up error handling
    pool.on('error', (err) => {
      logger.error('Unexpected database error:', err);
    });
    
  } catch (error) {
    logger.error('Failed to connect to PostgreSQL:', error);
    throw error;
  }
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call connectDatabase() first.');
  }
  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
  }
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

// Helper function for transactions
export async function withTransaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}