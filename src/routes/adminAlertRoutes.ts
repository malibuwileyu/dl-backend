import { Router, Request, Response } from 'express';
import { getPool } from '../config/database';
import { logger } from '../config/logger';

const router = Router();

// Extend Request type to include user
interface AuthRequest extends Request {
  user?: {
    userId: string;
    organizationId: string;
    role: 'student' | 'teacher' | 'admin';
  };
}

// Get today's alerts
router.get('/alerts/today', async (req: AuthRequest, res: Response) => {
  try {
    const pool = getPool();
    
    const result = await pool.query(`
      SELECT 
        a.id,
        a.alert_type,
        a.severity,
        a.message,
        a.created_at,
        a.user_id,
        u.email,
        u.name
      FROM alerts a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE DATE(a.created_at) = CURRENT_DATE
        AND (a.acknowledged_at IS NULL)
      ORDER BY a.created_at DESC
      LIMIT 50
    `);
    
    const alerts = result.rows.map(alert => {
      // Parse title and description from message field
      let title = '';
      let description = '';
      
      if (alert.message) {
        // Message format is "Title: Description"
        const parts = alert.message.split(': ');
        if (parts.length >= 2) {
          title = parts[0];
          description = parts.slice(1).join(': ');
        } else {
          title = alert.alert_type === 'distraction' ? 'Distracting App Alert' :
                  alert.alert_type === 'excessive_usage' ? 'Excessive Usage Alert' :
                  alert.alert_type === 'offtask' ? 'Off-Task Website Alert' : 'Alert';
          description = alert.message;
        }
      } else {
        // Fallback values
        title = alert.alert_type === 'distraction' ? 'Distracting App Alert' :
                alert.alert_type === 'excessive_usage' ? 'Excessive Usage Alert' :
                alert.alert_type === 'offtask' ? 'Off-Task Website Alert' : 'Alert';
        description = 'No details available';
      }
      
      return {
        id: alert.id,
        alert_type: alert.alert_type,
        severity: alert.severity,
        title: title,
        description: description,
        created_at: alert.created_at,
        user_id: alert.user_id,
        user_email: alert.email,
        user_name: alert.name
      };
    });
    
    res.json({ alerts });
  } catch (error) {
    logger.error('Error fetching today\'s alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Get alerts for a specific user
router.get('/alerts/user/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const pool = getPool();
    
    const result = await pool.query(`
      SELECT 
        id,
        alert_type,
        severity,
        message,
        created_at
      FROM alerts
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [userId]);
    
    const alerts = result.rows.map(alert => {
      // Parse title and description from message field
      let title = '';
      let description = '';
      
      if (alert.message) {
        // Message format is "Title: Description"
        const parts = alert.message.split(': ');
        if (parts.length >= 2) {
          title = parts[0];
          description = parts.slice(1).join(': ');
        } else {
          title = alert.alert_type === 'distraction' ? 'Distracting App Alert' :
                  alert.alert_type === 'excessive_usage' ? 'Excessive Usage Alert' :
                  alert.alert_type === 'offtask' ? 'Off-Task Website Alert' : 'Alert';
          description = alert.message;
        }
      } else {
        // Fallback values
        title = alert.alert_type === 'distraction' ? 'Distracting App Alert' :
                alert.alert_type === 'excessive_usage' ? 'Excessive Usage Alert' :
                alert.alert_type === 'offtask' ? 'Off-Task Website Alert' : 'Alert';
        description = 'No details available';
      }
      
      return {
        id: alert.id,
        alert_type: alert.alert_type,
        severity: alert.severity,
        title: title,
        description: description,
        created_at: alert.created_at
      };
    });
    
    res.json({ alerts });
  } catch (error) {
    logger.error('Error fetching user alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

export default router;