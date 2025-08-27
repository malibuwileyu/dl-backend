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

// Get summary report for all students
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const pool = getPool();
    
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `AND a.start_time >= '${startDate}'::date AND a.start_time <= '${endDate}'::date + INTERVAL '1 day'`;
    } else {
      // Default to last 30 days
      dateFilter = `AND a.start_time > NOW() - INTERVAL '30 days'`;
    }
    
    // Get overall summary statistics
    const summaryQuery = `
      WITH student_stats AS (
        SELECT 
          u.id,
          u.name,
          u.email,
          u.grade,
          COALESCE(SUM(CASE WHEN a.is_idle IS NULL OR a.is_idle = false THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as total_time,
          COALESCE(SUM(CASE WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as productive_time,
          COALESCE(SUM(CASE WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as academic_time,
          COUNT(DISTINCT DATE(a.start_time)) as active_days
        FROM users u
        LEFT JOIN activities a ON u.id = a.user_id ${dateFilter}
        LEFT JOIN app_categories ac ON a.app_name = ac.app_name AND (ac.organization_id IS NULL OR ac.organization_id = u.organization_id)
        WHERE u.role = 'student'
        GROUP BY u.id, u.name, u.email, u.grade
      )
      SELECT 
        COUNT(DISTINCT id) as total_students,
        COUNT(DISTINCT CASE WHEN total_time > 0 THEN id END) as active_students,
        AVG(CASE WHEN total_time > 0 THEN (productive_time / NULLIF(total_time, 0)) * 100 ELSE 0 END) as avg_productivity_score,
        AVG(CASE WHEN total_time > 0 THEN total_time / 3600.0 ELSE 0 END) as avg_hours_per_student,
        AVG(CASE WHEN total_time > 0 THEN productive_time / 3600.0 ELSE 0 END) as avg_productive_hours,
        AVG(CASE WHEN total_time > 0 THEN academic_time / 3600.0 ELSE 0 END) as avg_academic_hours,
        AVG(active_days) as avg_active_days,
        
        -- Grade breakdowns
        COUNT(DISTINCT CASE WHEN grade = 9 THEN id END) as grade_9_students,
        COUNT(DISTINCT CASE WHEN grade = 10 THEN id END) as grade_10_students,
        COUNT(DISTINCT CASE WHEN grade = 11 THEN id END) as grade_11_students,
        COUNT(DISTINCT CASE WHEN grade = 12 THEN id END) as grade_12_students,
        
        -- Top performing metrics
        MAX(CASE WHEN total_time > 0 THEN (productive_time / NULLIF(total_time, 0)) * 100 ELSE 0 END) as highest_productivity_score,
        MIN(CASE WHEN total_time > 0 THEN (productive_time / NULLIF(total_time, 0)) * 100 ELSE 0 END) as lowest_productivity_score
      FROM student_stats
    `;
    
    const summaryResult = await pool.query(summaryQuery);
    const summary = summaryResult.rows[0];
    
    // Get top 5 most productive students
    const topStudentsQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.grade,
        COALESCE(SUM(CASE WHEN a.is_idle IS NULL OR a.is_idle = false THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as total_time,
        COALESCE(SUM(CASE WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as productive_time,
        CASE 
          WHEN COALESCE(SUM(CASE WHEN a.is_idle IS NULL OR a.is_idle = false THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) > 0 
          THEN (COALESCE(SUM(CASE WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) / 
                COALESCE(SUM(CASE WHEN a.is_idle IS NULL OR a.is_idle = false THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0)) * 100
          ELSE 0 
        END as productivity_score
      FROM users u
      LEFT JOIN activities a ON u.id = a.user_id ${dateFilter}
      LEFT JOIN app_categories ac ON a.app_name = ac.app_name AND (ac.organization_id IS NULL OR ac.organization_id = u.organization_id)
      WHERE u.role = 'student'
      GROUP BY u.id, u.name, u.email, u.grade
      HAVING COALESCE(SUM(CASE WHEN a.is_idle IS NULL OR a.is_idle = false THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) > 0
      ORDER BY productivity_score DESC
      LIMIT 5
    `;
    
    const topStudentsResult = await pool.query(topStudentsQuery);
    
    return res.json({
      summary: {
        totalStudents: parseInt(summary.total_students) || 0,
        activeStudents: parseInt(summary.active_students) || 0,
        avgProductivityScore: parseFloat(summary.avg_productivity_score) || 0,
        avgHoursPerStudent: parseFloat(summary.avg_hours_per_student) || 0,
        avgProductiveHours: parseFloat(summary.avg_productive_hours) || 0,
        avgAcademicHours: parseFloat(summary.avg_academic_hours) || 0,
        avgActiveDays: parseFloat(summary.avg_active_days) || 0,
        gradeDistribution: {
          grade9: parseInt(summary.grade_9_students) || 0,
          grade10: parseInt(summary.grade_10_students) || 0,
          grade11: parseInt(summary.grade_11_students) || 0,
          grade12: parseInt(summary.grade_12_students) || 0
        },
        highestProductivityScore: parseFloat(summary.highest_productivity_score) || 0,
        lowestProductivityScore: parseFloat(summary.lowest_productivity_score) || 0
      },
      topStudents: topStudentsResult.rows.map(student => ({
        id: student.id,
        name: student.name,
        email: student.email,
        grade: student.grade,
        totalHours: parseFloat(student.total_time) / 3600,
        productiveHours: parseFloat(student.productive_time) / 3600,
        productivityScore: parseFloat(student.productivity_score)
      }))
    });
  } catch (error) {
    logger.error('Error generating summary report:', error);
    return res.status(500).json({ error: 'Failed to generate summary report' });
  }
});

// Get report by grade
router.get('/by-grade/:grade', async (req: AuthRequest, res: Response) => {
  try {
    const { grade } = req.params;
    const { startDate, endDate } = req.query;
    const pool = getPool();
    
    // Validate grade
    const gradeNum = parseInt(grade);
    if (isNaN(gradeNum) || gradeNum < 9 || gradeNum > 12) {
      return res.status(400).json({ error: 'Invalid grade. Must be between 9 and 12.' });
    }
    
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `AND a.start_time >= '${startDate}'::date AND a.start_time <= '${endDate}'::date + INTERVAL '1 day'`;
    } else {
      dateFilter = `AND a.start_time > NOW() - INTERVAL '30 days'`;
    }
    
    // Get grade-specific statistics
    const gradeStatsQuery = `
      WITH grade_students AS (
        SELECT 
          u.id,
          u.name,
          u.email,
          COALESCE(SUM(CASE WHEN a.is_idle IS NULL OR a.is_idle = false THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as total_time,
          COALESCE(SUM(CASE WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as productive_time,
          COALESCE(SUM(CASE WHEN ac.category = 'neutral' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as neutral_time,
          COALESCE(SUM(CASE WHEN ac.category = 'distracting' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as distracting_time,
          COALESCE(SUM(CASE WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as academic_time,
          COUNT(DISTINCT DATE(a.start_time)) as active_days
        FROM users u
        LEFT JOIN activities a ON u.id = a.user_id ${dateFilter}
        LEFT JOIN app_categories ac ON a.app_name = ac.app_name AND (ac.organization_id IS NULL OR ac.organization_id = u.organization_id)
        WHERE u.role = 'student' AND u.grade = $1
        GROUP BY u.id, u.name, u.email
      )
      SELECT 
        COUNT(*) as total_students,
        COUNT(CASE WHEN total_time > 0 THEN 1 END) as active_students,
        AVG(CASE WHEN total_time > 0 THEN (productive_time / NULLIF(total_time, 0)) * 100 ELSE 0 END) as avg_productivity_score,
        AVG(total_time / 3600.0) as avg_total_hours,
        AVG(productive_time / 3600.0) as avg_productive_hours,
        AVG(neutral_time / 3600.0) as avg_neutral_hours,
        AVG(distracting_time / 3600.0) as avg_distracting_hours,
        AVG(academic_time / 3600.0) as avg_academic_hours,
        AVG(active_days) as avg_active_days,
        STDDEV(CASE WHEN total_time > 0 THEN (productive_time / NULLIF(total_time, 0)) * 100 ELSE 0 END) as productivity_std_dev
      FROM grade_students
    `;
    
    const gradeStatsResult = await pool.query(gradeStatsQuery, [gradeNum]);
    const gradeStats = gradeStatsResult.rows[0];
    
    // Get individual student details for this grade
    const studentsQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        COALESCE(SUM(CASE WHEN a.is_idle IS NULL OR a.is_idle = false THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as total_time,
        COALESCE(SUM(CASE WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as productive_time,
        COALESCE(SUM(CASE WHEN ac.category = 'neutral' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as neutral_time,
        COALESCE(SUM(CASE WHEN ac.category = 'distracting' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as distracting_time,
        COALESCE(SUM(CASE WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as academic_time,
        COUNT(DISTINCT DATE(a.start_time)) as active_days,
        CASE 
          WHEN COALESCE(SUM(CASE WHEN a.is_idle IS NULL OR a.is_idle = false THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) > 0 
          THEN (COALESCE(SUM(CASE WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) / 
                COALESCE(SUM(CASE WHEN a.is_idle IS NULL OR a.is_idle = false THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0)) * 100
          ELSE 0 
        END as productivity_score
      FROM users u
      LEFT JOIN activities a ON u.id = a.user_id ${dateFilter}
      LEFT JOIN app_categories ac ON a.app_name = ac.app_name AND (ac.organization_id IS NULL OR ac.organization_id = u.organization_id)
      WHERE u.role = 'student' AND u.grade = $1
      GROUP BY u.id, u.name, u.email
      ORDER BY productivity_score DESC
    `;
    
    const studentsResult = await pool.query(studentsQuery, [gradeNum]);
    
    return res.json({
      grade: gradeNum,
      statistics: {
        totalStudents: parseInt(gradeStats.total_students) || 0,
        activeStudents: parseInt(gradeStats.active_students) || 0,
        avgProductivityScore: parseFloat(gradeStats.avg_productivity_score) || 0,
        avgTotalHours: parseFloat(gradeStats.avg_total_hours) || 0,
        avgProductiveHours: parseFloat(gradeStats.avg_productive_hours) || 0,
        avgNeutralHours: parseFloat(gradeStats.avg_neutral_hours) || 0,
        avgDistractingHours: parseFloat(gradeStats.avg_distracting_hours) || 0,
        avgAcademicHours: parseFloat(gradeStats.avg_academic_hours) || 0,
        avgActiveDays: parseFloat(gradeStats.avg_active_days) || 0,
        productivityStdDev: parseFloat(gradeStats.productivity_std_dev) || 0
      },
      students: studentsResult.rows.map(student => ({
        id: student.id,
        name: student.name,
        email: student.email,
        totalHours: parseFloat(student.total_time) / 3600,
        productiveHours: parseFloat(student.productive_time) / 3600,
        neutralHours: parseFloat(student.neutral_time) / 3600,
        distractingHours: parseFloat(student.distracting_time) / 3600,
        academicHours: parseFloat(student.academic_time) / 3600,
        activeDays: parseInt(student.active_days),
        productivityScore: parseFloat(student.productivity_score)
      }))
    });
  } catch (error) {
    logger.error('Error generating grade report:', error);
    return res.status(500).json({ error: 'Failed to generate grade report' });
  }
});

// Get outliers report (students with concerning patterns)
router.get('/outliers', async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, threshold = 30 } = req.query;
    const pool = getPool();
    
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `AND a.start_time >= '${startDate}'::date AND a.start_time <= '${endDate}'::date + INTERVAL '1 day'`;
    } else {
      dateFilter = `AND a.start_time > NOW() - INTERVAL '7 days'`;
    }
    
    const academicThreshold = parseFloat(threshold as string);
    
    // Find students with low academic time percentage
    const outliersQuery = `
      WITH student_metrics AS (
        SELECT 
          u.id,
          u.name,
          u.email,
          u.grade,
          COALESCE(SUM(CASE WHEN a.is_idle IS NULL OR a.is_idle = false THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as total_time,
          COALESCE(SUM(CASE WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as academic_time,
          COALESCE(SUM(CASE WHEN ac.category = 'distracting' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as distracting_time,
          COUNT(DISTINCT DATE(a.start_time)) as active_days,
          
          -- Calculate academic percentage
          CASE 
            WHEN COALESCE(SUM(CASE WHEN a.is_idle IS NULL OR a.is_idle = false THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) > 0 
            THEN (COALESCE(SUM(CASE WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) / 
                  COALESCE(SUM(CASE WHEN a.is_idle IS NULL OR a.is_idle = false THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0)) * 100
            ELSE 0 
          END as academic_percentage,
          
          -- Most used distracting apps
          ARRAY_AGG(DISTINCT a.app_name ORDER BY a.app_name) FILTER (WHERE ac.category = 'distracting') as distracting_apps
        FROM users u
        LEFT JOIN activities a ON u.id = a.user_id ${dateFilter}
        LEFT JOIN app_categories ac ON a.app_name = ac.app_name AND (ac.organization_id IS NULL OR ac.organization_id = u.organization_id)
        WHERE u.role = 'student'
        GROUP BY u.id, u.name, u.email, u.grade
        HAVING COALESCE(SUM(CASE WHEN a.is_idle IS NULL OR a.is_idle = false THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) > 3600 -- At least 1 hour of activity
      )
      SELECT 
        *,
        -- Flag different types of outliers
        CASE 
          WHEN academic_percentage < $1 THEN 'Low Academic Time'
          WHEN distracting_time > total_time * 0.5 THEN 'High Distraction'
          WHEN active_days = 1 AND total_time > 28800 THEN 'Single Day Burst'
          ELSE 'Other'
        END as outlier_type
      FROM student_metrics
      WHERE academic_percentage < $1 
         OR distracting_time > total_time * 0.5
         OR (active_days = 1 AND total_time > 28800)
      ORDER BY academic_percentage ASC
    `;
    
    const outliersResult = await pool.query(outliersQuery, [academicThreshold]);
    
    // Get overall statistics for comparison
    const overallStatsQuery = `
      SELECT 
        AVG(CASE 
          WHEN total_time > 0 
          THEN (productive_time / total_time) * 100
          ELSE 0 
        END) as avg_academic_percentage,
        AVG(total_time / 3600.0) as avg_total_hours
      FROM (
        SELECT 
          u.id,
          COALESCE(SUM(CASE WHEN a.is_idle IS NULL OR a.is_idle = false THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as total_time,
          COALESCE(SUM(CASE WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as productive_time
        FROM users u
        LEFT JOIN activities a ON u.id = a.user_id ${dateFilter}
        LEFT JOIN app_categories ac ON a.app_name = ac.app_name AND (ac.organization_id IS NULL OR ac.organization_id = u.organization_id)
        WHERE u.role = 'student'
        GROUP BY u.id
      ) student_totals
    `;
    
    const overallStatsResult = await pool.query(overallStatsQuery);
    const overallStats = overallStatsResult.rows[0];
    
    return res.json({
      threshold: academicThreshold,
      overallStats: {
        avgAcademicPercentage: parseFloat(overallStats.avg_academic_percentage) || 0,
        avgTotalHours: parseFloat(overallStats.avg_total_hours) || 0
      },
      outliers: outliersResult.rows.map(student => ({
        id: student.id,
        name: student.name,
        email: student.email,
        grade: student.grade,
        totalHours: parseFloat(student.total_time) / 3600,
        academicHours: parseFloat(student.academic_time) / 3600,
        distractingHours: parseFloat(student.distracting_time) / 3600,
        academicPercentage: parseFloat(student.academic_percentage),
        activeDays: parseInt(student.active_days),
        outlierType: student.outlier_type,
        distractingApps: student.distracting_apps || []
      })),
      totalOutliers: outliersResult.rows.length
    });
  } catch (error) {
    logger.error('Error generating outliers report:', error);
    return res.status(500).json({ error: 'Failed to generate outliers report' });
  }
});

// Get individual student report
router.get('/student/:studentId', async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate } = req.query;
    const pool = getPool();
    
    // Validate studentId is a number
    const studentIdNum = parseInt(studentId);
    if (isNaN(studentIdNum)) {
      return res.status(400).json({ error: 'Invalid student ID format' });
    }
    
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `AND a.start_time >= '${startDate}'::date AND a.start_time <= '${endDate}'::date + INTERVAL '1 day'`;
    } else {
      dateFilter = `AND a.start_time > NOW() - INTERVAL '30 days'`;
    }
    
    // Get student info and overall stats
    const studentStatsQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.grade,
        COALESCE(SUM(CASE WHEN a.is_idle IS NULL OR a.is_idle = false THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as total_time,
        COALESCE(SUM(CASE WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as productive_time,
        COALESCE(SUM(CASE WHEN ac.category = 'neutral' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as neutral_time,
        COALESCE(SUM(CASE WHEN ac.category = 'distracting' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as distracting_time,
        COALESCE(SUM(CASE WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END), 0) as academic_time,
        COUNT(DISTINCT DATE(a.start_time)) as active_days,
        MIN(DATE(a.start_time)) as first_active_date,
        MAX(DATE(a.start_time)) as last_active_date
      FROM users u
      LEFT JOIN activities a ON u.id = a.user_id ${dateFilter}
      LEFT JOIN app_categories ac ON a.app_name = ac.app_name AND (ac.organization_id IS NULL OR ac.organization_id = u.organization_id)
      WHERE u.id = $1 AND u.role = 'student'
      GROUP BY u.id, u.name, u.email, u.grade
    `;
    
    const studentStatsResult = await pool.query(studentStatsQuery, [studentIdNum]);
    
    if (studentStatsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    const studentStats = studentStatsResult.rows[0];
    
    // Get app usage breakdown
    const appUsageQuery = `
      SELECT 
        a.app_name,
        ac.category,
        SUM(CASE WHEN a.is_idle IS NULL OR a.is_idle = false THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END) as usage_time
      FROM activities a
      LEFT JOIN app_categories ac ON a.app_name = ac.app_name AND (ac.organization_id IS NULL OR ac.organization_id = a.user_id)
      WHERE a.user_id = $1 ${dateFilter}
      GROUP BY a.app_name, ac.category
      ORDER BY usage_time DESC
      LIMIT 10
    `;
    
    const appUsageResult = await pool.query(appUsageQuery, [studentIdNum]);
    
    // Get daily activity pattern
    const dailyPatternQuery = `
      SELECT 
        DATE(a.start_time) as activity_date,
        SUM(CASE WHEN a.is_idle IS NULL OR a.is_idle = false THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END) as total_time,
        SUM(CASE WHEN ac.category = 'productive' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END) as productive_time,
        SUM(CASE WHEN ac.category = 'distracting' AND (a.is_idle IS NULL OR a.is_idle = false) THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) ELSE 0 END) as distracting_time
      FROM activities a
      LEFT JOIN app_categories ac ON a.app_name = ac.app_name AND (ac.organization_id IS NULL OR ac.organization_id = a.user_id)
      WHERE a.user_id = $1 ${dateFilter}
      GROUP BY DATE(a.start_time)
      ORDER BY activity_date DESC
      LIMIT 14
    `;
    
    const dailyPatternResult = await pool.query(dailyPatternQuery, [studentIdNum]);
    
    // Calculate productivity score
    const productivityScore = parseFloat(studentStats.total_time) > 0 
      ? (parseFloat(studentStats.productive_time) / parseFloat(studentStats.total_time)) * 100 
      : 0;
    
    // Calculate academic percentage
    const academicPercentage = parseFloat(studentStats.total_time) > 0 
      ? (parseFloat(studentStats.academic_time) / parseFloat(studentStats.total_time)) * 100 
      : 0;
    
    return res.json({
      student: {
        id: studentStats.id,
        name: studentStats.name,
        email: studentStats.email,
        grade: studentStats.grade
      },
      statistics: {
        totalHours: parseFloat(studentStats.total_time) / 3600,
        productiveHours: parseFloat(studentStats.productive_time) / 3600,
        neutralHours: parseFloat(studentStats.neutral_time) / 3600,
        distractingHours: parseFloat(studentStats.distracting_time) / 3600,
        academicHours: parseFloat(studentStats.academic_time) / 3600,
        productivityScore: productivityScore,
        academicPercentage: academicPercentage,
        activeDays: parseInt(studentStats.active_days),
        firstActiveDate: studentStats.first_active_date,
        lastActiveDate: studentStats.last_active_date
      },
      topApps: appUsageResult.rows.map(app => ({
        appName: app.app_name,
        category: app.category || 'uncategorized',
        usageHours: parseFloat(app.usage_time) / 3600
      })),
      dailyActivity: dailyPatternResult.rows.map(day => ({
        date: day.activity_date,
        totalHours: parseFloat(day.total_time) / 3600,
        productiveHours: parseFloat(day.productive_time) / 3600,
        distractingHours: parseFloat(day.distracting_time) / 3600
      }))
    });
  } catch (error) {
    logger.error('Error generating student report:', error);
    return res.status(500).json({ error: 'Failed to generate student report' });
  }
});

export default router;