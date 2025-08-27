import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

import { config } from './config/config';
import { logger } from './config/logger';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { errorHandler } from './middlewares/errorHandler';
import { notFoundHandler } from './middlewares/notFoundHandler';
import { setupRoutes } from './routes';
import { setupSocketHandlers } from './socket';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: config.cors.origins,
    credentials: true
  },
  path: config.ws.path
});

// Global middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.socket.io"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "ws://localhost:*", "wss://localhost:*", "http://localhost:*", "https://localhost:*", "http://127.0.0.1:*", "https://127.0.0.1:*"],
      upgradeInsecureRequests: null // Disable upgrade-insecure-requests
    }
  },
  hsts: false, // Disable HSTS for development
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: (origin, callback) => {
    // Allow all localhost origins for development
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      callback(null, true);
    } else {
      callback(null, config.cors.origins);
    }
  },
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
if (config.app.env !== 'test') {
  app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
}

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.app.env
  });
});

// Add io to request object for WebSocket access
app.use((req, res, next) => {
  (req as any).io = io;
  next();
});

// API routes
app.use(config.app.apiPrefix, setupRoutes());

// WebSocket handlers
setupSocketHandlers(io);

// Error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    console.log('[Server] Starting server initialization...');
    console.log('[Server] Config loaded successfully');
    
    // Connect to databases
    console.log('[Server] Attempting PostgreSQL connection...');
    console.log('[Server] DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);
    
    try {
      await connectDatabase();
      console.log('[Server] PostgreSQL connected successfully');
      logger.info('✅ PostgreSQL connected with TypeORM');
    } catch (dbError) {
      console.error('[Server] PostgreSQL connection failed:', dbError);
      throw dbError;
    }
    
    console.log('[Server] Attempting Redis connection...');
    console.log('[Server] REDIS_URL length:', process.env.REDIS_URL?.length || 0);
    
    try {
      await connectRedis();
      console.log('[Server] Redis connected successfully');
      logger.info('✅ Redis connected');
    } catch (redisError) {
      console.error('[Server] Redis connection failed:', redisError);
      throw redisError;
    }
    
    // Comment out jobs for now - they might be causing issues
    console.log('[Server] Skipping job setup for debugging...');
    
    // Start HTTP server
    console.log('[Server] Starting HTTP server on port', config.app.port);
    httpServer.listen(config.app.port, () => {
      console.log('[Server] HTTP server started successfully');
      logger.info(`🚀 Server running on port ${config.app.port} in ${config.app.env} mode`);
    });
    
  } catch (error) {
    console.error('[Server] Fatal error during startup:', error);
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
console.log('[Server] Starting application...');
startServer();
