import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { config } from './config';

// Create logs directory if it doesn't exist
import fs from 'fs';
if (!fs.existsSync(config.logging.dir)) {
  fs.mkdirSync(config.logging.dir, { recursive: true });
}

// Custom format for better readability
const customFormat = winston.format.printf(({ timestamp, level, message, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

// Console transport with colors
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  )
});

// File transport for all logs
const fileTransport = new DailyRotateFile({
  filename: path.join(config.logging.dir, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
});

// File transport for errors only
const errorFileTransport = new DailyRotateFile({
  filename: path.join(config.logging.dir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
});

// Create logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    customFormat
  ),
  defaultMeta: { service: 'student-tracker-api' },
  transports: [
    consoleTransport,
    fileTransport,
    errorFileTransport
  ]
});

// Don't log to console in production
if (config.app.env === 'production') {
  logger.remove(consoleTransport);
}

// Create a stream object for Morgan
export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};