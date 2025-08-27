import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { UserService } from '../services/userService';
import { getPool } from '../config/database';
import { ValidationError, ConflictError } from '../middlewares/errorHandler';
import { logger } from '../config/logger';

export class AuthController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  /**
   * POST /auth/login
   */
  login = async (req: Request, res: Response) => {
    const { email, password, deviceId } = req.body;
    
    // Validate credentials
    const user = await AuthService.validateCredentials(email, password);
    
    // Generate tokens
    const tokens = await AuthService.generateTokens({
      userId: String(user.id),
      organizationId: user.organization_id ? String(user.organization_id) : '',
      role: user.role,
      deviceId
    });
    
    // TODO: Add last_login_at column and update it here
    
    // Log successful login
    logger.info(`User ${user.email} logged in successfully`);
    
    res.json({
      user: {
        id: String(user.id),
        email: user.email,
        role: user.role,
        organizationId: user.organization_id ? String(user.organization_id) : null,
        grade: user.grade || null
      },
      ...tokens
    });
  };

  /**
   * POST /auth/refresh
   */
  refreshToken = async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    
    // Try to decode the token to check if it's a device token
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(refreshToken) as any;
      
      if (decoded && decoded.type === 'device') {
        // For device tokens, generate a new access token directly
        const accessToken = jwt.sign(
          { deviceId: decoded.deviceId, type: 'device' },
          process.env.JWT_SECRET || 'secret',
          { 
            expiresIn: process.env.JWT_EXPIRES_IN || '15m',
            issuer: 'student-tracker',
            audience: 'student-tracker-api'
          }
        );
        
        return res.json({ 
          accessToken,
          refreshToken, // Return the same refresh token
          expiresIn: 900 // 15 minutes
        });
      }
    } catch (error) {
      // Not a valid JWT, continue with regular flow
    }
    
    // Regular user token refresh
    const tokens = await AuthService.refreshAccessToken(refreshToken);
    
    return res.json(tokens);
  };

  /**
   * POST /auth/logout
   */
  logout = async (req: Request, res: Response) => {
    const { user, token } = req;
    
    if (user && token) {
      // Blacklist the access token
      await AuthService.blacklistToken(token);
      
      // Revoke all refresh tokens for the user
      await AuthService.revokeRefreshToken(user.userId);
      
      logger.info(`User ${user.userId} logged out`);
    }
    
    res.json({ message: 'Logged out successfully' });
  };

  /**
   * POST /auth/register
   */
  register = async (req: Request, res: Response) => {
    const { email, password, organizationId, role, grade } = req.body;
    
    // Validate grade if provided
    if (grade !== undefined && (grade < 9 || grade > 12)) {
      throw new ValidationError('Grade must be between 9 and 12');
    }
    
    // Check if user already exists
    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }
    
    // Verify organization exists
    const pool = getPool();
    const orgResult = await pool.query(
      'SELECT id FROM organizations WHERE id = $1',
      [organizationId]
    );
    
    if (orgResult.rows.length === 0) {
      throw new ValidationError('Invalid organization ID');
    }
    
    // Create user
    const user = await this.userService.create({
      email,
      password,
      organizationId,
      role,
      grade
    });
    
    // Generate tokens
    const tokens = await AuthService.generateTokens({
      userId: String(user.id),
      organizationId: user.organization_id ? String(user.organization_id) : '',
      role: user.role
    });
    
    logger.info(`New user registered: ${email} (Grade ${grade || 'N/A'})`);
    
    res.status(201).json({
      user: {
        id: String(user.id),
        email: user.email,
        role: user.role,
        organizationId: user.organization_id ? String(user.organization_id) : null,
        grade: user.grade || null
      },
      ...tokens
    });
  };

  /**
   * GET /auth/me
   */
  getCurrentUser = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    
    const user = await this.userService.findById(userId);
    
    if (!user) {
      throw new ValidationError('User not found');
    }
    
    res.json({
      id: String(user.id),
      email: user.email,
      role: user.role,
      organizationId: user.organization_id ? String(user.organization_id) : null,
      createdAt: user.created_at
    });
  };
}