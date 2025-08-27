import { Router, Request, Response } from 'express';
import { getPool } from '../config/database';
import { logger } from '../config/logger';

const router = Router();

interface AuthRequest extends Request {
  user?: {
    userId: string;
    organizationId: string;
    role: 'student' | 'teacher' | 'admin';
  };
}

router.get('/students/:id/distractions', async (req: AuthRequest, res: Response) => {
  try {
    const pool = getPool();
    const { id: studentId } = req.params;
    const { period = 'today' } = req.query;

    // Calculate date range based on period
    let dateCondition = '';
    switch (period) {
      case 'today':
        dateCondition = "AND start_time >= CURRENT_DATE";
        break;
      case 'week':
        dateCondition = "AND start_time >= CURRENT_DATE - INTERVAL '7 days'";
        break;
      case 'month':
        dateCondition = "AND start_time >= CURRENT_DATE - INTERVAL '30 days'";
        break;
    }

    // Get top distracting apps/websites
    const distractionsQuery = `
      WITH distracting_activities AS (
        SELECT 
          a.app_name,
          a.url,
          SUM(a.duration) as total_seconds,
          COUNT(DISTINCT DATE(a.start_time)) as days_used,
          COUNT(*) as session_count
        FROM activities a
        WHERE a.user_id = $1
          ${dateCondition}
          AND (
            -- Check app categories
            EXISTS (
              SELECT 1 FROM app_categories ac 
              WHERE ac.app_name = a.app_name 
              AND ac.category = 'distracting'
            )
            OR
            -- Check website categories
            EXISTS (
              SELECT 1 FROM website_categories wc 
              WHERE a.url LIKE '%' || wc.pattern || '%' 
              AND wc.category = 'distracting'
            )
          )
        GROUP BY a.app_name, a.url
      )
      SELECT 
        CASE 
          WHEN app_name IN ('Google Chrome', 'Safari', 'Microsoft Edge', 'Firefox', 'Arc') AND url IS NOT NULL THEN
            CASE 
              WHEN url LIKE '%youtube.com%' THEN 'YouTube'
              WHEN url LIKE '%reddit.com%' THEN 'Reddit'
              WHEN url LIKE '%instagram.com%' THEN 'Instagram'
              WHEN url LIKE '%twitter.com%' OR url LIKE '%x.com%' THEN 'Twitter'
              WHEN url LIKE '%tiktok.com%' THEN 'TikTok'
              WHEN url LIKE '%discord.com%' THEN 'Discord'
              ELSE COALESCE(
                NULLIF(SPLIT_PART(SPLIT_PART(url, '//', 2), '/', 1), ''),
                app_name
              )
            END
          ELSE app_name
        END as name,
        SUM(total_seconds) as total_seconds,
        MAX(days_used) as days_used,
        SUM(session_count) as session_count
      FROM distracting_activities
      GROUP BY name
      ORDER BY total_seconds DESC
      LIMIT 10
    `;

    const result = await pool.query(distractionsQuery, [studentId]);

    // Format the response
    const distractions = result.rows.map(row => ({
      name: row.name,
      totalTime: parseInt(row.total_seconds),
      daysUsed: parseInt(row.days_used),
      sessions: parseInt(row.session_count),
      averageSessionMinutes: Math.round(parseInt(row.total_seconds) / parseInt(row.session_count) / 60)
    }));

    // Calculate total distraction time
    const totalDistractionTime = distractions.reduce((sum, d) => sum + d.totalTime, 0);

    res.json({
      studentId,
      period,
      totalDistractionTime,
      distractions,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Error fetching distractions:', error);
    res.status(500).json({ error: 'Failed to fetch distractions' });
  }
});

export default router;