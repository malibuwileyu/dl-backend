import { getPool } from '../config/database';
import { logger } from '../config/logger';

interface ActiveStudent {
  userId: string;
  lastSeen: Date;
  currentApp?: string;
  category?: string;
}

class ActiveStudentService {
  private activeStudents: Map<string, ActiveStudent> = new Map();
  private recentActivities: any[] = [];
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start polling immediately
    this.startPolling();
  }

  // Start polling for active students
  startPolling() {
    // Initial update
    this.updateActiveStudents();
    
    // Update every 5 seconds
    this.updateInterval = setInterval(() => {
      this.updateActiveStudents();
    }, 5000);
    
    logger.info('[ActiveStudentService] Started polling for active students');
  }

  // Stop polling
  stopPolling() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // Update active students from database
  private async updateActiveStudents() {
    try {
      const pool = getPool();
      
      // Get students active in the last 5 minutes
      // Use end_time to check if the activity is still ongoing
      const activeResult = await pool.query(`
        SELECT DISTINCT user_id
        FROM activities
        WHERE end_time >= NOW() - INTERVAL '5 minutes'
           OR (start_time >= NOW() - INTERVAL '5 minutes' AND end_time IS NULL)
        ORDER BY user_id
      `);
      
      const activeIds = new Set(activeResult.rows.map(row => String(row.user_id)));
      
      // Update active students map
      // Remove students no longer active
      for (const [userId] of this.activeStudents.entries()) {
        if (!activeIds.has(userId)) {
          this.activeStudents.delete(userId);
          logger.debug(`[ActiveStudentService] Student ${userId} is no longer active`);
        }
      }
      
      // Add new active students
      for (const userId of activeIds) {
        if (!this.activeStudents.has(userId)) {
          this.activeStudents.set(userId, {
            userId,
            lastSeen: new Date()
          });
          logger.debug(`[ActiveStudentService] Student ${userId} is now active`);
        }
      }
      
      // Get recent activities for the feed
      const recentResult = await pool.query(`
        SELECT DISTINCT ON (a.user_id, a.app_name)
          a.user_id,
          a.app_name,
          a.start_time,
          a.end_time,
          ac.category
        FROM activities a
        LEFT JOIN app_categories ac ON a.app_name = ac.app_name
        WHERE a.end_time >= NOW() - INTERVAL '5 minutes'
           OR (a.start_time >= NOW() - INTERVAL '5 minutes' AND a.end_time IS NULL)
        ORDER BY a.user_id, a.app_name, a.start_time DESC
        LIMIT 20
      `);
      
      this.recentActivities = recentResult.rows;
      
      // Update current app for active students
      for (const activity of recentResult.rows) {
        const student = this.activeStudents.get(String(activity.user_id));
        if (student) {
          student.currentApp = activity.app_name;
          student.category = activity.category;
          student.lastSeen = new Date(activity.start_time);
        }
      }
      
      logger.debug(`[ActiveStudentService] Updated: ${this.activeStudents.size} active students`);
      
    } catch (error) {
      logger.error('[ActiveStudentService] Error updating active students:', error);
    }
  }

  // Get current active students
  getActiveStudents() {
    return {
      activeStudents: Array.from(this.activeStudents.keys()),
      recentActivities: this.recentActivities,
      timestamp: new Date()
    };
  }

  // Check if a specific student is active
  isStudentActive(userId: string): boolean {
    return this.activeStudents.has(String(userId));
  }

  // Get active student details
  getActiveStudentDetails(userId: string): ActiveStudent | undefined {
    return this.activeStudents.get(String(userId));
  }

  // Manually mark a student as active (e.g., from WebSocket activity)
  markStudentActive(userId: string, app?: string, category?: string) {
    this.activeStudents.set(String(userId), {
      userId: String(userId),
      lastSeen: new Date(),
      currentApp: app,
      category
    });
  }
}

// Export singleton instance
export const activeStudentService = new ActiveStudentService();