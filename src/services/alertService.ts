import { Server as SocketServer } from 'socket.io';
import { addAlert } from '../routes/alertRoutes';
import { getPool } from '../config/database';
import { logger } from '../config/logger';
import { ProductivityService } from './productivityService';

export interface Alert {
  id: string;
  deviceId: string;
  type: 'distraction' | 'offtask' | 'excessive_usage';
  appName: string;
  duration?: number;
  url?: string;
  timestamp: Date;
}

export class AlertService {
  private static io: SocketServer;

  static setSocketServer(io: SocketServer) {
    this.io = io;
  }

  static async checkForAlerts(activities: any[]) {
    const alerts: Alert[] = [];
    const pool = getPool();
    
    for (const activity of activities) {
      // Get productivity categorization
      const productivity = await ProductivityService.categorizeActivity(
        activity.app_name,
        activity.url,
        activity.window_title,
        activity.userId
      );

      // Only create alerts for distracting activities
      if (productivity.category === 'distracting') {
        alerts.push({
          id: activity.id || Date.now().toString(),
          deviceId: activity.deviceId,
          type: activity.url ? 'offtask' : 'distraction',
          appName: activity.app_name,
          duration: activity.duration,
          url: activity.url,
          timestamp: new Date(activity.start_time)
        });
      }

      // Check for excessive usage (>30 min continuous) - only for neutral and distracting apps
      if (activity.duration > 1800 && productivity.category !== 'productive') {
        alerts.push({
          id: activity.id || Date.now().toString(),
          deviceId: activity.deviceId,
          type: 'excessive_usage',
          appName: activity.app_name,
          duration: activity.duration,
          timestamp: new Date(activity.start_time)
        });
      }

      // Note: activities table doesn't have category/productivity_score columns
      // This update is no longer applicable
      if (activity.id) {
        logger.debug(`Activity ${activity.id} categorized as ${productivity.category}`);
      }
    }

    // Store alerts and emit via WebSocket
    if (alerts.length > 0) {
      logger.info(`[AlertService] Detected ${alerts.length} alerts`);
      
      for (const alert of alerts) {
        logger.info(`[AlertService] - ${alert.type}: ${alert.appName} ${alert.duration ? `(${Math.round(alert.duration / 60)}min)` : ''} ${alert.url || ''}`);
        
        // Store alert in database
        try {
          // Get user_id from the first activity (they should all be from the same user)
          const userId = activities[0].userId;
          
          // Determine severity based on alert type
          const severity = alert.type === 'excessive_usage' ? 'high' : 
                          alert.type === 'distraction' ? 'medium' : 'low';
          
          // Create descriptive title and description
          const title = alert.type === 'distraction' ? `Distracting app detected: ${alert.appName}` :
                       alert.type === 'excessive_usage' ? `Excessive usage: ${alert.appName}` :
                       `Off-task website: ${alert.appName}`;
          
          const description = alert.type === 'distraction' ? 
            `Student spent ${Math.round((alert.duration || 0) / 60)} minutes on ${alert.appName}` :
            alert.type === 'excessive_usage' ? 
            `Student has been using ${alert.appName} for over ${Math.round((alert.duration || 0) / 60)} minutes continuously` :
            `Student visited off-task website: ${alert.url || 'Unknown URL'}`;
          
          // Insert alert into database
          const result = await pool.query(`
            INSERT INTO alerts (
              user_id, alert_type, severity, message, created_at
            ) VALUES ($1, $2, $3, $4, NOW())
            RETURNING id
          `, [
            userId,
            alert.type,
            severity,
            `${title}: ${description}`
          ]);
          
          // Update alert with database ID
          alert.id = result.rows[0].id;
          
          logger.info(`[AlertService] Saved alert to database with ID: ${alert.id}`);
        } catch (error) {
          logger.error('Error saving alert to database:', error);
        }
        
        // Store alert in memory for quick access
        addAlert(alert);
        
        // Emit individual alert via WebSocket
        if (this.io) {
          this.io.emit('alert:new', alert);
          logger.info(`[AlertService] Emitted alert via WebSocket: ${alert.type} - ${alert.appName}`);
        } else {
          logger.warn(`[AlertService] WARNING: No WebSocket instance available to emit alert`);
        }
      }
    }

    return alerts;
  }

}