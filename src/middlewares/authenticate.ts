import { Request, Response, NextFunction } from 'express';
import { AuthService, TokenPayload } from '../services/authService';
import { AuthenticationError, AuthorizationError } from './errorHandler';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      token?: string;
    }
  }
}

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }
    
    const token = authHeader.substring(7);
    
    // Check if token is blacklisted
    if (await AuthService.isTokenBlacklisted(token)) {
      throw new AuthenticationError('Token has been revoked');
    }
    
    // Verify token
    const payload = AuthService.verifyToken(token);
    
    // Handle device tokens differently
    if ((payload as any).type === 'device') {
      // For device tokens, create a user-like payload
      req.user = {
        userId: (payload as any).deviceId,
        role: 'student' as any, // Devices act as students
        organizationId: 'device',
        email: `device-${(payload as any).deviceId}@system.local`
      } as TokenPayload;
    } else {
      // Regular user token
      req.user = payload;
    }
    
    req.token = token;
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if user has required role
 */
export const authorize = (...allowedRoles: Array<'student' | 'teacher' | 'admin'>) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError('Not authenticated'));
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AuthorizationError('Insufficient permissions'));
    }
    
    next();
  };
};

/**
 * Middleware to check if user belongs to same organization
 */
export const authorizeOrganization = (paramName: string = 'organizationId') => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError('Not authenticated'));
    }
    
    const organizationId = req.params[paramName] || req.body.organizationId;
    
    if (req.user.role !== 'admin' && req.user.organizationId !== organizationId) {
      return next(new AuthorizationError('Access denied to this organization'));
    }
    
    next();
  };
};

/**
 * Middleware to check if user can access another user's data
 */
export const authorizeUser = (paramName: string = 'userId') => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError('Not authenticated'));
    }
    
    const userId = req.params[paramName] || req.body.userId;
    
    // Users can access their own data
    if (req.user.userId === userId) {
      return next();
    }
    
    // Teachers and admins can access student data in their organization
    if (['teacher', 'admin'].includes(req.user.role)) {
      // TODO: Verify the target user is in the same organization
      return next();
    }
    
    next(new AuthorizationError('Cannot access this user\'s data'));
  };
};