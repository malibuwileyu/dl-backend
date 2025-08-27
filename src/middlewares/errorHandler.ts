import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { config } from '../config/config';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true,
    public code?: string
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: any) {
    super(400, message, true, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(401, message, true, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(403, message, true, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, message, true, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, true, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(429, message, true, 'RATE_LIMIT_EXCEEDED');
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log error
  logger.error({
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.id
  });

  // Handle known operational errors
  if (err instanceof AppError && err.isOperational) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err instanceof ValidationError && err.details ? { details: err.details } : {})
      }
    });
    return;
  }

  // Handle Joi validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.message
      }
    });
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token'
      }
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired'
      }
    });
    return;
  }

  // Handle database errors
  if (err.message?.includes('duplicate key')) {
    res.status(409).json({
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'Resource already exists'
      }
    });
    return;
  }

  // Default error response (don't expose internal errors in production)
  const isDevelopment = config.app.env === 'development';
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isDevelopment ? err.message : 'An unexpected error occurred',
      ...(isDevelopment ? { stack: err.stack } : {})
    }
  });
};