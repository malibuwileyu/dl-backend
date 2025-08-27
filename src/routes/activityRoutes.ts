import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { AlertService } from '../services/alertService';
import { SubjectService } from '../services/subjectService';
import { logger } from '../config/logger';
import { getPool } from '../config/database';

const router = Router();

// Require authentication for all routes
router.use(authenticate);

// Batch endpoint for DreamLauncher academic activities
router.post('/batch', async (req, res) => {
  const { activities } = req.body;
  
  if (!activities || !Array.isArray(activities)) {
    return res.status(400).json({ error: 'Activities array required' });
  }
  
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(400).json({ error: 'User ID not found in token' });
  }
  
  const userIdInt = parseInt(userId, 10);
  if (isNaN(userIdInt)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  
  const pool = getPool();
  
  try {
    for (const activity of activities) {
      const startTime = new Date(activity.start_time);
      const endTime = new Date(activity.end_time);
      
      // Insert academic activity
      await pool.query(`
        INSERT INTO activities (
          user_id, start_time, end_time, 
          app_name, window_title, url, 
          duration, is_idle, activity_type,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT DO NOTHING
      `, [
        userIdInt,
        startTime,
        endTime,
        activity.app_name || 'DreamLauncher',
        activity.window_title || null,
        activity.url || null,
        activity.duration,
        false,
        activity.activity_type || 'academic',
        JSON.stringify({
          subject: activity.subject,
          is_academic: activity.is_academic,
          session_id: activity.session_id
        })
      ]);
    }
    
    logger.info(`[Activities] Saved ${activities.length} academic activities from DreamLauncher`);
    return res.json({ 
      message: 'Activities recorded',
      count: activities.length,
      synced: true
    });
  } catch (error) {
    logger.error('[Activities] Error saving DreamLauncher activities:', error);
    return res.status(500).json({ error: 'Failed to save activities' });
  }
});

// Bulk upload activities from device
router.post('/bulk', async (req, res) => {
  const { activities } = req.body;
  
  if (!activities || !Array.isArray(activities)) {
    return res.status(400).json({ error: 'Activities array required' });
  }
  
  // Save activities to database
  logger.info(`[Activities] Received ${activities.length} activities from device`);
  
  const userId = (req as any).user?.userId;
  const deviceId = (req as any).user?.deviceId;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID not found in token' });
  }
  
  // Convert userId string to integer for database operations
  const userIdInt = parseInt(userId, 10);
  if (isNaN(userIdInt)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  
  const pool = getPool();
  
  const categorizedActivities = [];
  
  try {
    // Save each activity to the database
    for (const activity of activities) {
      const startTime = new Date(activity.start_time || new Date());
      const endTime = new Date(startTime.getTime() + (activity.duration * 1000));
      
      // Store activity for alert checking
      categorizedActivities.push({
        ...activity
      });
      
      // Generate session_id if not provided
      const sessionId = activity.session_id || require('crypto').randomUUID();
      
      // Log session handling for debugging
      if (activity.app_name === 'Terminal' && activity.session_id) {
        logger.info(`[Activities] Terminal session: provided=${activity.session_id}, using=${sessionId}`);
      }
      
      await pool.query(`
        INSERT INTO activities (
          user_id, device_id, start_time, end_time, 
          app_name, window_title, url, 
          duration, is_idle, subject_id, session_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (session_id) DO UPDATE SET
          end_time = EXCLUDED.end_time,
          duration = EXCLUDED.duration,
          window_title = EXCLUDED.window_title,
          url = EXCLUDED.url,
          updated_at = NOW()
      `, [
        userIdInt,
        deviceId || null,
        startTime,
        endTime,
        activity.app_name,
        activity.window_title || null,
        activity.url || null,
        Math.round((endTime.getTime() - startTime.getTime()) / 1000), // duration in seconds
        activity.is_idle || false,
        null, // subject_id - will be handled by SubjectService later
        sessionId
      ]);
    }
    
    logger.info(`[Activities] Saved ${activities.length} activities to database`);
    
    // Immediately mark the student as active (don't wait for next poll)
    const { activeStudentService } = await import('../services/activeStudentService');
    if (activities.length > 0) {
      const latestActivity = activities[activities.length - 1];
      activeStudentService.markStudentActive(
        String(userIdInt), 
        latestActivity.app_name
      );
    }
  } catch (error) {
    logger.error('[Activities] Error saving to database:', error);
    return res.status(500).json({ error: 'Failed to save activities' });
  }
  
  // Add deviceId and userId to activities before checking alerts
  const activitiesWithDevice = categorizedActivities.map(activity => ({
    ...activity,
    deviceId: req.user?.deviceId || 'unknown',
    userId: userIdInt
  }));
  
  // Log activities that will be checked for alerts
  logger.info(`[Activities] Checking ${activitiesWithDevice.length} activities for alerts`);
  activitiesWithDevice.forEach(activity => {
    if (activity.url) {
      logger.info(`[Activities] Activity with URL: ${activity.app_name} - ${activity.url}`);
    }
  });
  
  // Check for alerts
  await AlertService.checkForAlerts(activitiesWithDevice);
  
  // Process subject detection for each activity
  if (userIdInt) {
    for (const activity of activitiesWithDevice) {
      try {
        // Detect subject from activity
        const detection = await SubjectService.detectSubject(
          activity.app_name,
          activity.url,
          activity.window_title
        );
        
        if (detection) {
          logger.info(`[Activities] Subject detected: ${detection.subject_name} (ID: ${detection.subject_id})`);
          
          // Record subject activity
          await SubjectService.recordSubjectActivity(
            String(userIdInt),
            detection.subject_id,
            Math.round(activity.duration || 0),
            new Date(activity.start_time),
            detection.confidence
          );
          
          // Check compliance
          const compliance = await SubjectService.checkSubjectCompliance(
            String(userIdInt),
            detection.subject_id
          );
          
          if (!compliance.compliant) {
            // Create alert for subject mismatch
            const alert = {
              id: Date.now().toString(),
              deviceId: activity.deviceId,
              type: 'offtask' as const,
              appName: activity.app_name,
              duration: activity.duration,
              timestamp: new Date(activity.start_time),
              metadata: {
                detected_subject: detection.subject_name,
                expected_subject: compliance.expectedSubject?.name || compliance.currentSelection?.subject_name,
                reason: compliance.currentSelection ? 'manual_selection' : 'schedule'
              }
            };
            
            // Emit subject mismatch alert
            const io = (req as any).io;
            if (io) {
              io.emit('alert:subject_mismatch', alert);
            }
          }
        }
      } catch (error) {
        logger.error('Error processing subject detection:', error);
      }
    }
  }
  
  return res.json({ 
    message: 'Activities recorded',
    count: activities.length,
    synced: true
  });
});

// Single activity recording
router.post('/', (req, res) => {
  res.json({ message: 'Activity recorded' });
});

router.get('/summary', (req, res) => {
  res.json({ activities: [] });
});

export default router;