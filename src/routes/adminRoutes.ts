import { Router, Request, Response, NextFunction } from 'express';
// import { authenticate } from '../middlewares/authenticate';
import { logger } from '../config/logger';
import { getPool } from '../config/database';
import adminProductivityRoutes from './adminProductivityRoutes';
import adminDistractionsRoutes from './adminDistractionsRoute';

const router = Router();

// Extend Request type to include user
interface AuthRequest extends Request {
  user?: {
    userId: string;
    organizationId: string;
    role: 'student' | 'teacher' | 'admin';
  };
}

// Temporary: Remove authentication for development
// router.use(authenticate);

// Admin authorization middleware - disabled for now
const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  // Temporarily disabled - allow all access
  next();
};

// Mount productivity routes
router.use('/', adminProductivityRoutes);

// Mount distractions routes
router.use('/', adminDistractionsRoutes);

// Get all students in organization
router.get('/students', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const pool = getPool();
    const { search } = req.query;
    
    let whereClause = "u.role = 'student'";
    const params: any[] = [];
    
    if (search && typeof search === 'string') {
      whereClause += " AND (LOWER(u.name) LIKE LOWER($1) OR LOWER(u.email) LIKE LOWER($1))";
      params.push(`%${search}%`);
    }
    
    const result = await pool.query(`
      SELECT 
        u.id, 
        u.email, 
        u.name,
        u.grade,
        MAX(a.start_time) as last_activity,
        COUNT(DISTINCT DATE(a.start_time)) as days_active,
        COUNT(a.id) as total_sessions
      FROM users u
      LEFT JOIN activities a ON u.id = a.user_id
      WHERE ${whereClause}
      GROUP BY u.id, u.email, u.name, u.grade
      ORDER BY u.name, u.email
    `, params);
    
    res.json({ students: result.rows });
  } catch (error) {
    logger.error('Error fetching students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Get today's alerts
router.get('/alerts/today', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT 
        a.*,
        u.name as user_name,
        u.email as user_email
      FROM alerts a
      JOIN users u ON a.user_id = u.id
      WHERE DATE(a.created_at) = CURRENT_DATE
      ORDER BY a.created_at DESC
    `, []);
    
    res.json({ alerts: result.rows });
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Get user-specific alerts
router.get('/alerts/user/:userId', requireAdmin, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    const pool = getPool();
    
    // Temporarily disabled organization check
    // const userCheck = await pool.query(
    //   'SELECT organization_id FROM users WHERE id = $1',
    //   [userId]
    // );
    // 
    // if (userCheck.rows.length === 0 || userCheck.rows[0].organization_id !== req.user!.organizationId) {
    //   return res.status(403).json({ error: 'Access denied' });
    // }
    
    const result = await pool.query(`
      SELECT * FROM alerts 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 50
    `, [userId]);
    
    return res.json({ alerts: result.rows });
  } catch (error) {
    logger.error('Error fetching user alerts:', error);
    return res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Get organization stats
router.get('/organization-stats', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const pool = getPool();
    
    // Get average productivity
    const productivityResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT user_id) as active_users,
        COUNT(*) as total_activities
      FROM activities
      WHERE user_id IN (
        SELECT id FROM users 
        WHERE role = 'student'
      )
      AND DATE(start_time) = CURRENT_DATE
    `, []);
    
    // Get subject breakdown
    const subjectResult = await pool.query(`
      SELECT 
        s.name as subject_name,
        COUNT(*) as session_count,
        SUM(EXTRACT(EPOCH FROM (a.end_time - a.start_time))) as total_seconds
      FROM activities a
      INNER JOIN subjects s ON a.subject_id = s.id
      WHERE a.user_id IN (
        SELECT id FROM users 
        WHERE role = 'student'
      )
      AND DATE(a.start_time) = CURRENT_DATE
      GROUP BY s.name
      ORDER BY total_seconds DESC
    `, []);
    
    res.json({
      avgProductivity: 0, // No longer tracking productivity scores
      activeUsers: parseInt(productivityResult.rows[0].active_users) || 0,
      totalActivities: parseInt(productivityResult.rows[0].total_activities) || 0,
      subjectBreakdown: subjectResult.rows
    });
  } catch (error) {
    logger.error('Error fetching organization stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get user activities with details
router.get('/user-activities/:userId', requireAdmin, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    const { period = 'today' } = req.query;
    const pool = getPool();
    
    // Temporarily disabled organization check
    // const userCheck = await pool.query(
    //   'SELECT organization_id FROM users WHERE id = $1',
    //   [userId]
    // );
    // 
    // if (userCheck.rows.length === 0 || userCheck.rows[0].organization_id !== req.user!.organizationId) {
    //   return res.status(403).json({ error: 'Access denied' });
    // }
    
    let dateFilter = 'DATE(start_time) = CURRENT_DATE';
    if (period === 'week') {
      dateFilter = 'start_time > NOW() - INTERVAL \'7 days\'';
    } else if (period === 'month') {
      dateFilter = 'start_time > NOW() - INTERVAL \'30 days\'';
    }
    
    const result = await pool.query(`
      SELECT 
        a.id,
        a.app_name,
        a.start_time,
        a.end_time,
        EXTRACT(EPOCH FROM (a.end_time - a.start_time))::INTEGER as duration,
        a.is_idle,
        a.subject_id,
        a.url,
        a.window_title,
        COALESCE(ac.category, 'neutral') as category
      FROM activities a
      LEFT JOIN app_categories ac ON a.app_name = ac.app_name
      WHERE a.user_id = $1 AND ${dateFilter}
      ORDER BY a.start_time DESC
      LIMIT 100
    `, [userId]);
    
    return res.json({ activities: result.rows });
  } catch (error) {
    logger.error('Error fetching user activities:', error);
    return res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

export default router;