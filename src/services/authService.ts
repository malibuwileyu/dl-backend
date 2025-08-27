import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/config';
import { getPool } from '../config/database';
import { cache } from '../config/redis';
import { AuthenticationError } from '../middlewares/errorHandler';
import { logger } from '../config/logger';

export interface TokenPayload {
  userId: string;
  organizationId: string;
  role: 'student' | 'teacher' | 'admin';
  deviceId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  private static readonly REFRESH_TOKEN_PREFIX = 'refresh_token:';
  private static readonly BLACKLIST_PREFIX = 'blacklist:';

  /**
   * Hash a password
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.auth.bcrypt.rounds);
  }

  /**
   * Compare password with hash
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT tokens
   */
  static async generateTokens(payload: TokenPayload): Promise<AuthTokens> {
    const accessTokenOptions: jwt.SignOptions = {
      expiresIn: config.auth.jwt.expiresIn as any, // JWT library accepts string like '15m'
      issuer: 'student-tracker',
      audience: 'student-tracker-api'
    };
    const accessToken = jwt.sign(payload, config.auth.jwt.secret, accessTokenOptions);

    const refreshTokenId = uuidv4();
    const refreshTokenOptions: jwt.SignOptions = {
      expiresIn: config.auth.jwt.refreshExpiresIn as any, // JWT library accepts string like '7d'
      issuer: 'student-tracker',
      audience: 'student-tracker-api'
    };
    const refreshToken = jwt.sign(
      { ...payload, tokenId: refreshTokenId },
      config.auth.jwt.secret,
      refreshTokenOptions
    );

    // Store refresh token in database
    const pool = getPool();
    await pool.query(
      `INSERT INTO refresh_tokens (id, user_id, token, expires_at) 
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
      [refreshTokenId, payload.userId, refreshToken]
    );

    // Also cache for quick validation
    await cache.set(
      `${this.REFRESH_TOKEN_PREFIX}${refreshTokenId}`,
      payload.userId,
      7 * 24 * 60 * 60 // 7 days in seconds
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900 // 15 minutes in seconds
    };
  }

  /**
   * Verify and decode JWT token
   */
  static verifyToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, config.auth.jwt.secret, {
        issuer: 'student-tracker',
        audience: 'student-tracker-api'
      }) as any;

      // Handle device tokens
      if (decoded.type === 'device') {
        return decoded;
      }

      // Remove tokenId from payload if present for user tokens
      const { tokenId, ...payload } = decoded;
      return payload as TokenPayload;
    } catch (error: any) {
      console.error('[AuthService] Token verification error:', error.message);
      if (error.name === 'TokenExpiredError') {
        throw new AuthenticationError('Token expired');
      }
      throw new AuthenticationError('Invalid token');
    }
  }

  /**
   * Refresh access token
   */
  static async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, config.auth.jwt.secret) as TokenPayload & { tokenId: string };
      
      // Check if refresh token exists in cache
      const cachedUserId = await cache.get(`${this.REFRESH_TOKEN_PREFIX}${decoded.tokenId}`);
      if (!cachedUserId || cachedUserId !== decoded.userId) {
        throw new AuthenticationError('Invalid refresh token');
      }

      // Check if token is in database and not expired
      const pool = getPool();
      const result = await pool.query(
        `SELECT user_id FROM refresh_tokens 
         WHERE id = $1 AND user_id = $2 AND expires_at > NOW()`,
        [decoded.tokenId, decoded.userId]
      );

      if (result.rows.length === 0) {
        throw new AuthenticationError('Refresh token expired or invalid');
      }

      // Generate new tokens
      const { tokenId, ...payload } = decoded;
      return this.generateTokens(payload);
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      throw new AuthenticationError('Invalid refresh token');
    }
  }

  /**
   * Revoke refresh token
   */
  static async revokeRefreshToken(userId: string, tokenId?: string): Promise<void> {
    const pool = getPool();
    
    if (tokenId) {
      // Revoke specific token
      await pool.query(
        'DELETE FROM refresh_tokens WHERE id = $1 AND user_id = $2',
        [tokenId, userId]
      );
      await cache.del(`${this.REFRESH_TOKEN_PREFIX}${tokenId}`);
    } else {
      // Revoke all tokens for user
      const result = await pool.query(
        'DELETE FROM refresh_tokens WHERE user_id = $1 RETURNING id',
        [userId]
      );
      
      // Remove from cache
      const tokenIds = result.rows.map(row => `${this.REFRESH_TOKEN_PREFIX}${row.id}`);
      if (tokenIds.length > 0) {
        await cache.del(tokenIds);
      }
    }
  }

  /**
   * Blacklist an access token (for logout)
   */
  static async blacklistToken(token: string): Promise<void> {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) return;

      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await cache.set(`${this.BLACKLIST_PREFIX}${token}`, '1', ttl);
      }
    } catch (error) {
      logger.error('Failed to blacklist token:', error);
    }
  }

  /**
   * Check if token is blacklisted
   */
  static async isTokenBlacklisted(token: string): Promise<boolean> {
    return cache.exists(`${this.BLACKLIST_PREFIX}${token}`);
  }

  /**
   * Validate user credentials
   */
  static async validateCredentials(email: string, password: string): Promise<any> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, organization_id, email, password, role, grade, name
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw new AuthenticationError('Invalid email or password');
    }

    const user = result.rows[0];
    const isValid = await this.comparePassword(password, user.password);
    
    if (!isValid) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Don't return password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Clean up expired tokens (run periodically)
   */
  static async cleanupExpiredTokens(): Promise<void> {
    const pool = getPool();
    const result = await pool.query(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW() RETURNING id'
    );
    
    logger.info(`Cleaned up ${result.rowCount} expired refresh tokens`);
  }
}