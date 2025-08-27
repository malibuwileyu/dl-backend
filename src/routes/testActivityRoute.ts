import { Router, Response } from 'express';
import { getPool } from '../config/database';
import { logger } from '../config/logger';

const router = Router();

// Test endpoint to create activity
router.post('/test-activity', async (req, res: Response) => {
  try {
    const pool = getPool();
    const now = new Date();
    
    // Insert test activity for user 1
    await pool.query(`
      INSERT INTO activities (
        user_id, device_id, start_time, end_time, 
        app_name, window_title, url, 
        duration, is_idle
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      '1', // user_id
      'test-device', // device_id
      now, // start_time
      new Date(now.getTime() + 60000), // end_time (1 minute later)
      'Test Application', // app_name
      'Test Window', // window_title
      null, // url
      60, // duration in seconds
      false // is_idle
    ]);
    
    logger.info('Test activity created');
    res.json({ success: true, message: 'Test activity created' });
  } catch (error) {
    logger.error('Error creating test activity:', error);
    res.status(500).json({ error: 'Failed to create test activity' });
  }
});

export default router;