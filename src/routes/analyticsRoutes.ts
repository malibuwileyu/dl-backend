import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { getPool } from '../config/database';
import { logger } from '../config/logger';

const router = Router();

// Get active students with their current activities
router.get('/active-students', async (req: Request, res: Response): Promise<Response> => {
  try {
    const result = await getPool().query(`
      SELECT DISTINCT ON (u.id)
        u.id,
        u.email,
        u.name,
        a.app_name as current_app,
        a.window_title,
        MAX(a.start_time) as last_activity
      FROM users u
      INNER JOIN activities a ON u.id = a.user_id
      WHERE a.start_time > NOW() - INTERVAL '5 minutes'
      GROUP BY u.id, u.email, u.name, a.app_name, a.window_title
      ORDER BY u.id, last_activity DESC
    `);

    const students = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      name: row.name,
      profilePicture: null,
      gradeLevel: null,
      currentApp: row.current_app,
      windowTitle: row.window_title,
      lastActivity: row.last_activity
    }));

    return res.json(students);
  } catch (error) {
    logger.error('Error fetching active students:', error);
    return res.status(500).json({ error: 'Failed to fetch active students' });
  }
});

// Get usage statistics
router.get('/usage-stats', async (req: Request, res: Response): Promise<Response> => {
  try {
    // Get today's stats
    const statsResult = await getPool().query(`
      SELECT 
        COUNT(DISTINCT user_id) as active_users,
        COUNT(*) as total_activities,
        AVG(EXTRACT(EPOCH FROM (end_time - start_time))) as avg_duration
      FROM activities
      WHERE DATE(start_time) = CURRENT_DATE
    `);

    const alertsResult = await getPool().query(`
      SELECT COUNT(*) as alert_count
      FROM alerts
      WHERE DATE(created_at) = CURRENT_DATE
      AND acknowledged_at IS NULL
    `);

    const stats = {
      activeUsers: parseInt(statsResult.rows[0].active_users) || 0,
      totalActivities: parseInt(statsResult.rows[0].total_activities) || 0,
      avgDuration: parseFloat(statsResult.rows[0].avg_duration) || 0,
      activeAlerts: parseInt(alertsResult.rows[0].alert_count) || 0
    };

    return res.json(stats);
  } catch (error) {
    logger.error('Error fetching usage stats:', error);
    return res.status(500).json({ error: 'Failed to fetch usage stats' });
  }
});

// Get recent activities for a specific student
router.get('/student/:userId/activities', authenticate, async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const result = await getPool().query(`
      SELECT 
        a.*,
        s.name as subject_name
      FROM activities a
      LEFT JOIN subjects s ON a.subject_id = s.id
      WHERE a.user_id = $1
      ORDER BY a.start_time DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    return res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching student activities:', error);
    return res.status(500).json({ error: 'Failed to fetch student activities' });
  }
});

// Get productivity breakdown
router.get('/productivity/:userId', authenticate, async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    const { date = new Date().toISOString().split('T')[0] } = req.query;

    const result = await getPool().query(`
      SELECT 
        a.app_name,
        SUM(EXTRACT(EPOCH FROM (a.end_time - a.start_time))) as total_duration,
        COUNT(*) as activity_count
      FROM activities a
      WHERE a.user_id = $1
      AND DATE(a.start_time) = $2
      GROUP BY a.app_name
    `, [userId, date]);

    const breakdown: { [key: string]: number } = {
      productive: 0,
      neutral: 0,
      distracting: 0,
      untracked: 0
    };

    // Since we don't have categories in the activities table,
    // we'll just return the total duration for now
    const totalDuration = result.rows.reduce((sum, row) => {
      return sum + (parseInt(row.total_duration) || 0);
    }, 0);
    
    // Return a simplified breakdown
    breakdown.untracked = totalDuration;

    return res.json(breakdown);
  } catch (error) {
    logger.error('Error fetching productivity data:', error);
    return res.status(500).json({ error: 'Failed to fetch productivity data' });
  }
});

export default router;