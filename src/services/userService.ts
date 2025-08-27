import { getPool } from '../config/database';
import { AuthService } from './authService';
import { NotFoundError, ConflictError } from '../middlewares/errorHandler';
import { cache } from '../config/redis';

export interface CreateUserDto {
  email: string;
  password: string;
  organizationId: string;
  role: 'student' | 'teacher' | 'admin';
  grade?: number;
}

export interface UpdateUserDto {
  email?: string;
  role?: 'student' | 'teacher' | 'admin';
}

export class UserService {
  private static readonly USER_CACHE_PREFIX = 'user:';
  private static readonly USER_CACHE_TTL = 300; // 5 minutes

  /**
   * Create a new user
   */
  async create(data: CreateUserDto): Promise<any> {
    const { email, password, organizationId, role, grade } = data;
    
    // Hash password
    const passwordHash = await AuthService.hashPassword(password);
    
    // Insert user
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO users (email, password, organization_id, role, grade)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, organization_id, role, grade, created_at, name`,
      [email.toLowerCase(), passwordHash, organizationId, role, grade || null]
    );
    
    const user = result.rows[0];
    
    // Cache user
    await this.cacheUser(user);
    
    return user;
  }

  /**
   * Find user by ID
   */
  async findById(userId: string): Promise<any | null> {
    // Check cache first
    const cached = await cache.get(`${UserService.USER_CACHE_PREFIX}${userId}`);
    if (cached) return cached;
    
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, email, organization_id, role, grade, created_at, updated_at, name
       FROM users WHERE id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) return null;
    
    const user = result.rows[0];
    
    // Cache user
    await this.cacheUser(user);
    
    return user;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<any | null> {
    const pool = getPool();
    const query = `SELECT id, email, organization_id, role, grade, created_at, updated_at, name
       FROM users WHERE email = $1`;
    console.log('[UserService.findByEmail] Query:', query);
    const result = await pool.query(query, [email.toLowerCase()]);
    
    if (result.rows.length === 0) return null;
    
    return result.rows[0];
  }

  /**
   * Update user
   */
  async update(userId: string, data: UpdateUserDto): Promise<any> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    if (data.email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      values.push(data.email.toLowerCase());
    }
    
    if (data.role !== undefined) {
      updates.push(`role = $${paramCount++}`);
      values.push(data.role);
    }
    
    
    
    if (updates.length === 0) {
      return this.findById(userId);
    }
    
    values.push(userId);
    
    const pool = getPool();
    const result = await pool.query(
      `UPDATE users 
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING id, email, organization_id, role, created_at, updated_at, name`,
      values
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundError('User not found');
    }
    
    const user = result.rows[0];
    
    // Invalidate cache
    await cache.del(`${UserService.USER_CACHE_PREFIX}${userId}`);
    
    return user;
  }

  /**
   * Delete user
   */
  async delete(userId: string): Promise<void> {
    const pool = getPool();
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rowCount === 0) {
      throw new NotFoundError('User not found');
    }
    
    // Invalidate cache
    await cache.del(`${UserService.USER_CACHE_PREFIX}${userId}`);
  }

  /**
   * List users in organization
   */
  async listByOrganization(
    organizationId: string,
    options: {
      role?: string;
      gradeLevel?: number;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ users: any[]; total: number }> {
    const { role, limit = 50, offset = 0 } = options;
    
    let whereClause = 'WHERE organization_id = $1';
    const values: any[] = [organizationId];
    let paramCount = 2;
    
    if (role) {
      whereClause += ` AND role = $${paramCount++}`;
      values.push(role);
    }
    
    
    const pool = getPool();
    
    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);
    
    // Get users
    values.push(limit, offset);
    const result = await pool.query(
      `SELECT id, email, organization_id, role, created_at, updated_at, name
       FROM users ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      values
    );
    
    return {
      users: result.rows,
      total
    };
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const pool = getPool();
    
    // Get current password hash
    const result = await pool.query(
      'SELECT password FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundError('User not found');
    }
    
    // Verify old password
    const isValid = await AuthService.comparePassword(oldPassword, result.rows[0].password);
    if (!isValid) {
      throw new ConflictError('Current password is incorrect');
    }
    
    // Hash new password
    const newPasswordHash = await AuthService.hashPassword(newPassword);
    
    // Update password
    await pool.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, userId]
    );
    
    // Revoke all refresh tokens
    await AuthService.revokeRefreshToken(userId);
  }

  /**
   * Helper to cache user
   */
  private async cacheUser(user: any): Promise<void> {
    await cache.set(
      `${UserService.USER_CACHE_PREFIX}${user.id}`,
      user,
      UserService.USER_CACHE_TTL
    );
  }
}