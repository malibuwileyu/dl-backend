import { Router, Request, Response } from 'express';
import { logger } from '../config/logger';
import { getPool } from '../config/database';

const router = Router();

// Extend Request type to include user
interface AuthRequest extends Request {
  user?: {
    userId: string;
    organizationId: string;
    role: 'student' | 'teacher' | 'admin';
  };
}

// Get productivity analysis data
router.get('/productivity-analysis', async (req: AuthRequest, res: Response) => {
  try {
    const { period = 'today', group = 'all', startDate, endDate } = req.query;
    const pool = getPool();
    
    // Determine date range
    let dateFilter = '';
    
    switch (period) {
      case 'today':
        dateFilter = `AND DATE(a.start_time) = CURRENT_DATE`;
        break;
      case 'last24h':
        dateFilter = `AND a.start_time > NOW() - INTERVAL '24 hours'`;
        break;
      case 'week':
        dateFilter = `AND a.start_time > NOW() - INTERVAL '7 days'`;
        break;
      case 'month':
        dateFilter = `AND a.start_time > NOW() - INTERVAL '30 days'`;
        break;
      case 'custom':
        if (startDate && endDate) {
          dateFilter = `AND a.start_time >= '${startDate}'::date AND a.start_time <= '${endDate}'::date + INTERVAL '1 day'`;
        }
        break;
    }
    
    // Build group filter
    let groupFilter = '';
    if (group === 'active') {
      groupFilter = `AND u.id IN (
        SELECT DISTINCT user_id 
        FROM activities 
        WHERE start_time >= NOW() - INTERVAL '1 day'
      )`;
    } else if (typeof group === 'string' && group.startsWith('grade-')) {
      const grade = parseInt(group.replace('grade-', ''));
      if (!isNaN(grade) && grade >= 9 && grade <= 12) {
        groupFilter = `AND u.grade = ${grade}`;
      }
    }
    
    // Get summary data with academic split
    const summaryQuery = `
      SELECT
        COUNT(DISTINCT u.id) as student_count,
        COALESCE(SUM(CASE WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as productive_time,
        COALESCE(SUM(CASE WHEN ac.category = 'neutral' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as neutral_time,
        COALESCE(SUM(CASE WHEN ac.category = 'distracting' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as distracting_time,
        COALESCE(SUM(CASE WHEN a.is_idle IS NULL OR a.is_idle = false THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as total_time,
        COALESCE(SUM(CASE WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as academic_time,
        COALESCE(SUM(CASE WHEN (ac.category != 'productive' OR ac.category IS NULL) AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as non_academic_time
      FROM users u
      LEFT JOIN activities a ON u.id = a.user_id ${dateFilter}
      LEFT JOIN app_categories ac ON a.app_name = ac.app_name AND (ac.organization_id IS NULL OR ac.organization_id = u.organization_id)
      WHERE u.role = 'student' ${groupFilter}
    `;
    
    const summaryResult = await pool.query(summaryQuery);
    const summary = summaryResult.rows[0];
    
    // Get subcategory breakdown
    const subcategoryQuery = `
      SELECT
        COALESCE(ac.subcategory, wc.subcategory, 'uncategorized') as subcategory,
        COALESCE(SUM(EXTRACT(EPOCH FROM (a.end_time - a.start_time))), 0) as time_spent
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN app_categories ac ON a.app_name = ac.app_name AND (ac.organization_id IS NULL OR ac.organization_id = u.organization_id)
      LEFT JOIN website_categories wc ON a.url LIKE '%' || wc.pattern || '%'
      WHERE u.role = 'student' 
        AND (a.is_idle IS NULL OR a.is_idle = false)
        ${dateFilter}
        ${groupFilter}
      GROUP BY COALESCE(ac.subcategory, wc.subcategory, 'uncategorized')
      ORDER BY time_spent DESC
    `;
    
    const subcategoryResult = await pool.query(subcategoryQuery);
    const subcategoryTimes: Record<string, number> = {};
    subcategoryResult.rows.forEach(row => {
      if (row.subcategory && row.subcategory !== 'uncategorized') {
        subcategoryTimes[row.subcategory] = parseFloat(row.time_spent) || 0;
      }
    });
    
    // Get student details
    const studentsQuery = `
      SELECT
        u.id,
        u.email,
        u.name,
        u.grade,
        COALESCE(SUM(CASE WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as productive_time,
        COALESCE(SUM(CASE WHEN ac.category = 'neutral' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as neutral_time,
        COALESCE(SUM(CASE WHEN ac.category = 'distracting' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as distracting_time,
        COALESCE(SUM(CASE WHEN a.is_idle IS NULL OR a.is_idle = false THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as total_time
      FROM users u
      LEFT JOIN activities a ON u.id = a.user_id ${dateFilter}
      LEFT JOIN app_categories ac ON a.app_name = ac.app_name AND (ac.organization_id IS NULL OR ac.organization_id = u.organization_id)
      WHERE u.role = 'student' ${groupFilter}
      GROUP BY u.id, u.email, u.name, u.grade
      ORDER BY total_time DESC
    `;
    
    const studentsResult = await pool.query(studentsQuery);
    const students = studentsResult.rows;
    
    // Get hourly trends for today
    interface TrendData {
      label: string;
      productive: number;
      neutral: number;
      distracting: number;
    }
    
    let trendsData: { hour: TrendData[], day: TrendData[], week: TrendData[] } = { 
      hour: [], 
      day: [], 
      week: [] 
    };
    
    if (period === 'today' || period === 'last24h') {
      if (period === 'today') {
        // For today, show hours 0-23 of current day
        const hourlyQuery = `
          SELECT 
            EXTRACT(HOUR FROM a.start_time) as hour,
            COALESCE(SUM(CASE WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as productive,
            COALESCE(SUM(CASE WHEN ac.category = 'neutral' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as neutral,
            COALESCE(SUM(CASE WHEN ac.category = 'distracting' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as distracting
          FROM activities a
          LEFT JOIN app_categories ac ON a.app_name = ac.app_name AND (ac.organization_id IS NULL OR ac.organization_id = a.user_id)
          LEFT JOIN users u ON a.user_id = u.id
          WHERE DATE(a.start_time) = CURRENT_DATE
            AND u.role = 'student' ${groupFilter}
          GROUP BY hour
          ORDER BY hour
        `;
        
        const hourlyResult = await pool.query(hourlyQuery);
        trendsData.hour = hourlyResult.rows.map(row => ({
          label: `${row.hour}:00`,
          productive: parseFloat(row.productive),
          neutral: parseFloat(row.neutral),
          distracting: parseFloat(row.distracting)
        }));
      } else {
        // For last 24 hours, show rolling window with proper hour labels
        const hourlyQuery = `
          WITH hours AS (
            SELECT generate_series(0, 23) as hour_offset
          ),
          hour_data AS (
            SELECT 
              DATE_TRUNC('hour', a.start_time) as hour_slot,
              COALESCE(SUM(CASE WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as productive,
              COALESCE(SUM(CASE WHEN ac.category = 'neutral' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as neutral,
              COALESCE(SUM(CASE WHEN ac.category = 'distracting' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as distracting
            FROM activities a
            LEFT JOIN app_categories ac ON a.app_name = ac.app_name AND (ac.organization_id IS NULL OR ac.organization_id = a.user_id)
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.start_time > NOW() - INTERVAL '24 hours'
              AND u.role = 'student' ${groupFilter}
            GROUP BY hour_slot
          )
          SELECT 
            h.hour_offset,
            DATE_TRUNC('hour', NOW() - (h.hour_offset || ' hours')::interval) as time_slot,
            EXTRACT(HOUR FROM DATE_TRUNC('hour', NOW() - (h.hour_offset || ' hours')::interval)) as display_hour,
            COALESCE(hd.productive, 0) as productive,
            COALESCE(hd.neutral, 0) as neutral,
            COALESCE(hd.distracting, 0) as distracting
          FROM hours h
          LEFT JOIN hour_data hd ON DATE_TRUNC('hour', NOW() - (h.hour_offset || ' hours')::interval) = hd.hour_slot
          ORDER BY h.hour_offset DESC
        `;
        
        const hourlyResult = await pool.query(hourlyQuery);
        // Reverse to show oldest to newest
        trendsData.hour = hourlyResult.rows.reverse().map(row => ({
          label: `${row.display_hour}:00`,
          productive: parseFloat(row.productive),
          neutral: parseFloat(row.neutral),
          distracting: parseFloat(row.distracting)
        }));
      }
    }
    
    // Calculate comparison with previous period
    let scoreChange = 0;
    let focusChange = 0;
    
    if (period !== 'custom') {
      let previousDateFilter = '';
      switch (period) {
        case 'today':
          previousDateFilter = `AND DATE(a.start_time) = CURRENT_DATE - INTERVAL '1 day'`;
          break;
        case 'last24h':
          previousDateFilter = `AND a.start_time > NOW() - INTERVAL '48 hours' AND a.start_time <= NOW() - INTERVAL '24 hours'`;
          break;
        case 'week':
          previousDateFilter = `AND a.start_time > NOW() - INTERVAL '14 days' AND a.start_time <= NOW() - INTERVAL '7 days'`;
          break;
        case 'month':
          previousDateFilter = `AND a.start_time > NOW() - INTERVAL '60 days' AND a.start_time <= NOW() - INTERVAL '30 days'`;
          break;
      }
      
      const previousSummaryResult = await pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as productive_time,
          COALESCE(SUM(CASE WHEN a.is_idle IS NULL OR a.is_idle = false THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as total_time,
          COUNT(DISTINCT u.id) as student_count
        FROM users u
        LEFT JOIN activities a ON u.id = a.user_id ${previousDateFilter}
        LEFT JOIN app_categories ac ON a.app_name = ac.app_name AND (ac.organization_id IS NULL OR ac.organization_id = u.organization_id)
        WHERE u.role = 'student' ${groupFilter}
      `);
      
      const previousSummary = previousSummaryResult.rows[0];
      
      // Calculate changes
      const currentScore = parseFloat(summary.total_time) > 0 
        ? (parseFloat(summary.productive_time) / parseFloat(summary.total_time)) * 100 
        : 0;
      const previousScore = parseFloat(previousSummary.total_time) > 0 
        ? (parseFloat(previousSummary.productive_time) / parseFloat(previousSummary.total_time)) * 100 
        : 0;
      scoreChange = Math.round(currentScore - previousScore);
      
      const currentAvgFocus = parseInt(summary.student_count) > 0 
        ? parseFloat(summary.productive_time) / parseInt(summary.student_count) 
        : 0;
      const previousAvgFocus = parseInt(previousSummary.student_count) > 0 
        ? parseFloat(previousSummary.productive_time) / parseInt(previousSummary.student_count) 
        : 0;
      focusChange = currentAvgFocus - previousAvgFocus;
    }
    
    return res.json({
      summary: {
        studentCount: parseInt(summary.student_count) || 0,
        productiveTime: parseFloat(summary.productive_time) || 0,
        neutralTime: parseFloat(summary.neutral_time) || 0,
        distractingTime: parseFloat(summary.distracting_time) || 0,
        totalTime: parseFloat(summary.total_time) || 0,
        academicTime: parseFloat(summary.academic_time) || 0,
        nonAcademicTime: parseFloat(summary.non_academic_time) || 0,
        scoreChange: scoreChange,
        focusChange: focusChange
      },
      subcategoryTimes: subcategoryTimes,
      students: students.map((student: any) => ({
        id: student.id,
        email: student.email,
        name: student.name,
        grade: student.grade,
        productiveTime: parseFloat(student.productive_time) || 0,
        neutralTime: parseFloat(student.neutral_time) || 0,
        distractingTime: parseFloat(student.distracting_time) || 0,
        totalTime: parseFloat(student.total_time) || 0
      })),
      trends: trendsData
    });
  } catch (error) {
    logger.error('Error fetching productivity analysis:', error);
    return res.status(500).json({ error: 'Failed to fetch productivity analysis' });
  }
});

// Get individual student productivity data
router.get('/students/:studentId/productivity', async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const { period = 'today', startDate, endDate } = req.query;
    const pool = getPool();
    
    // Determine date range
    let dateFilter = '';
    switch (period) {
      case 'today':
        dateFilter = `AND DATE(a.start_time) = CURRENT_DATE`;
        break;
      case 'last24h':
        dateFilter = `AND a.start_time > NOW() - INTERVAL '24 hours'`;
        break;
      case 'week':
        dateFilter = `AND a.start_time > NOW() - INTERVAL '7 days'`;
        break;
      case 'month':
        dateFilter = `AND a.start_time > NOW() - INTERVAL '30 days'`;
        break;
      case 'custom':
        if (startDate && endDate) {
          dateFilter = `AND a.start_time >= '${startDate}'::date AND a.start_time <= '${endDate}'::date + INTERVAL '1 day'`;
        }
        break;
    }
    
    // Get student info and productivity data
    const studentQuery = `
      SELECT 
        u.id,
        u.email,
        u.name,
        u.grade,
        COALESCE(SUM(CASE 
          WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false)
          THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) 
          ELSE 0 
        END), 0) as productive_time,
        COALESCE(SUM(CASE 
          WHEN ac.category = 'neutral' AND (a.is_idle IS NULL OR a.is_idle = false)
          THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) 
          ELSE 0 
        END), 0) as neutral_time,
        COALESCE(SUM(CASE 
          WHEN ac.category = 'distracting' AND (a.is_idle IS NULL OR a.is_idle = false)
          THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) 
          ELSE 0 
        END), 0) as distracting_time,
        COALESCE(SUM(CASE 
          WHEN a.is_idle IS NULL OR a.is_idle = false 
          THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) 
          ELSE 0 
        END), 0) as total_time,
        0 as academic_time,
        COALESCE(SUM(CASE 
          WHEN a.is_idle IS NULL OR a.is_idle = false 
          THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) 
          ELSE 0 
        END), 0) as non_academic_time
      FROM users u
      LEFT JOIN activities a ON u.id = a.user_id ${dateFilter}
      LEFT JOIN app_categories ac ON a.app_name = ac.app_name
      WHERE u.id = $1
      GROUP BY u.id, u.email, u.name, u.grade
    `;
    
    const studentResult = await pool.query(studentQuery, [studentId]);
    
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    const student = studentResult.rows[0];
    
    // Get hourly trends for the student
    const trendsQuery = `
      SELECT 
        DATE_PART('hour', a.start_time) as hour,
        COALESCE(SUM(CASE 
          WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false)
          THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) 
          ELSE 0 
        END), 0) as productive,
        COALESCE(SUM(CASE 
          WHEN ac.category = 'neutral' AND (a.is_idle IS NULL OR a.is_idle = false)
          THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) 
          ELSE 0 
        END), 0) as neutral,
        COALESCE(SUM(CASE 
          WHEN ac.category = 'distracting' AND (a.is_idle IS NULL OR a.is_idle = false)
          THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) 
          ELSE 0 
        END), 0) as distracting
      FROM activities a
      LEFT JOIN app_categories ac ON a.app_name = ac.app_name
      WHERE a.user_id = $1 ${dateFilter}
      GROUP BY hour
      ORDER BY hour
    `;
    
    const trendsResult = await pool.query(trendsQuery, [studentId]);
    
    // Format hourly trends
    const hourlyTrends = [];
    for (let i = 0; i < 24; i++) {
      const hourData = trendsResult.rows.find(row => parseInt(row.hour) === i);
      hourlyTrends.push({
        label: `${i}:00`,
        productive: hourData ? parseFloat(hourData.productive) : 0,
        neutral: hourData ? parseFloat(hourData.neutral) : 0,
        distracting: hourData ? parseFloat(hourData.distracting) : 0
      });
    }
    
    // Return student data
    return res.json({
      id: student.id,
      email: student.email,
      name: student.name,
      grade: student.grade,
      productiveTime: parseFloat(student.productive_time) || 0,
      neutralTime: parseFloat(student.neutral_time) || 0,
      distractingTime: parseFloat(student.distracting_time) || 0,
      totalTime: parseFloat(student.total_time) || 0,
      academicTime: parseFloat(student.academic_time) || 0,
      nonAcademicTime: parseFloat(student.non_academic_time) || 0,
      trends: {
        hour: hourlyTrends,
        day: [],
        week: []
      }
    });
  } catch (error) {
    logger.error('Error fetching student productivity:', error);
    return res.status(500).json({ error: 'Failed to fetch student productivity data' });
  }
});

export default router;