import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Activity } from '../entities/Activity';
import { ManualActivity } from '../entities/ManualActivity';
import { User } from '../entities/User';
import { ProductivityService } from '../services/productivityService';
import { Between } from 'typeorm';
import { logger } from '../config/logger';
import { getPool } from '../config/database';

export class StudentController {
  private activityRepository = AppDataSource.getRepository(Activity);
  private manualActivityRepository = AppDataSource.getRepository(ManualActivity);
  private userRepository = AppDataSource.getRepository(User);

  getDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check if user is a student
      const user = await this.userRepository.findOne({ where: { id: parseInt(userId) } });
      if (user?.role !== 'student') {
        res.status(403).json({ error: 'Access denied. Students only.' });
        return;
      }

      // Get today's start and end
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get computer activities - use raw query to avoid any TypeORM issues
      const pool = getPool();
      const activitiesResult = await pool.query(`
        SELECT * FROM activities 
        WHERE user_id = $1 
        AND start_time >= $2 
        AND start_time < $3
        ORDER BY start_time DESC
      `, [parseInt(userId), today, tomorrow]);
      
      const computerActivities = activitiesResult.rows;

      // Get manual activities
      const manualActivities = await this.manualActivityRepository.find({
        where: {
          user_id: parseInt(userId),
          start_time: Between(today, tomorrow)
        },
        order: {
          start_time: 'DESC'
        }
      });

      // Calculate time by category
      let productiveTime = 0;
      let neutralTime = 0;
      let distractingTime = 0;
      let offlineTime = 0;
      
      // Calculate time by subcategory
      const subcategoryTimes: Record<string, number> = {
        school: 0,
        research: 0,
        creativity: 0,
        productivity: 0,
        communication: 0,
        reading: 0,
        health: 0,
        gaming: 0,
        scrolling: 0,
        entertainment: 0
      };

      // Process computer activities
      logger.info(`[Dashboard] Processing ${computerActivities.length} activities for user ${userId}`);
      for (const activity of computerActivities) {
        const duration = activity.duration || 0;
        const categoryResult = await ProductivityService.categorizeActivity(activity.app_name || '', activity.url, activity.window_title);
        const category = categoryResult.category;
        const subcategory = categoryResult.subcategory;
        
        switch (category) {
          case 'productive':
            productiveTime += duration;
            break;
          case 'neutral':
            neutralTime += duration;
            break;
          case 'distracting':
            distractingTime += duration;
            break;
        }
        
        // Track subcategory time
        if (subcategory && subcategoryTimes.hasOwnProperty(subcategory)) {
          subcategoryTimes[subcategory] += duration;
        }
      }
      logger.info(`[Dashboard] After categorization - productive: ${productiveTime}s, neutral: ${neutralTime}s, distracting: ${distractingTime}s`);

      // Process manual activities (all considered offline/productive)
      for (const activity of manualActivities) {
        const duration = Math.floor((activity.end_time.getTime() - activity.start_time.getTime()) / 1000);
        offlineTime += duration;
      }

      // Combine and sort all activities by start time
      const computerActivitiesWithCategories = await Promise.all(
        computerActivities.map(async a => {
          const categoryResult = await ProductivityService.categorizeActivity(a.app_name || '', a.url, a.window_title);
          return {
            id: a.id,
            title: a.app_name || a.window_title || 'Computer Activity',
            app_name: a.app_name,
            window_title: a.window_title,
            url: a.url,
            start_time: a.start_time,
            end_time: a.end_time,
            duration: a.duration,
            category: categoryResult.category,
            subcategory: categoryResult.subcategory,
            type: 'computer' as const
          };
        })
      );

      const allActivities = [
        ...computerActivitiesWithCategories,
        ...manualActivities.map(a => ({
          id: a.id,
          title: a.activity_name,
          activity_type: a.activity_type,
          start_time: a.start_time,
          end_time: a.end_time,
          duration: Math.floor((a.end_time.getTime() - a.start_time.getTime()) / 1000),
          category: 'offline' as const,
          type: 'manual' as const
        }))
      ].sort((a, b) => b.start_time.getTime() - a.start_time.getTime());

      // Calculate total productive time (productive + offline)
      const totalProductiveTime = productiveTime + offlineTime;

      const response = {
        totalProductiveTime,
        productiveTime,
        neutralTime,
        distractingTime,
        offlineTime,
        subcategoryTimes,
        activities: allActivities,
        summary: {
          date: today.toISOString(),
          totalActivities: allActivities.length,
          totalTime: productiveTime + neutralTime + distractingTime + offlineTime
        }
      };
      
      logger.info(`[Dashboard] Response for user ${userId}:`);
      logger.info(`  - productiveTime: ${productiveTime}s (${productiveTime/3600}h)`);
      logger.info(`  - neutralTime: ${neutralTime}s (${neutralTime/3600}h)`);
      logger.info(`  - distractingTime: ${distractingTime}s (${distractingTime/3600}h)`);
      logger.info(`  - offlineTime: ${offlineTime}s (${offlineTime/3600}h)`);
      logger.info(`  - totalProductiveTime: ${totalProductiveTime}s (${totalProductiveTime/3600}h)`);
      logger.info(`  - summary.totalTime: ${response.summary.totalTime}s (${response.summary.totalTime/3600}h)`);
      
      res.json(response);

    } catch (error) {
      logger.error('Error getting student dashboard:', error);
      res.status(500).json({ error: 'Failed to load dashboard' });
    }
  };

  getTimeSummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { period } = req.params; // 'day', 'week', 'month'

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Calculate date range based on period
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'day':
        default:
          startDate.setHours(0, 0, 0, 0);
          break;
      }

      // Get activities in date range
      const activities = await this.activityRepository.find({
        where: {
          user_id: parseInt(userId),
          start_time: Between(startDate, endDate)
        }
      });

      const manualActivities = await this.manualActivityRepository.find({
        where: {
          user_id: parseInt(userId),
          start_time: Between(startDate, endDate)
        }
      });

      // Calculate daily summaries
      const dailySummaries: Record<string, any> = {};

      // Process computer activities
      for (const activity of activities) {
        const dateKey = activity.start_time.toISOString().split('T')[0];
        if (!dailySummaries[dateKey]) {
          dailySummaries[dateKey] = {
            productive: 0,
            neutral: 0,
            distracting: 0,
            offline: 0,
            total: 0
          };
        }

        const categoryResult = await ProductivityService.categorizeActivity(activity.app_name || '', activity.url, activity.window_title);
        const category = categoryResult.category;
        const duration = activity.duration || 0;
        
        dailySummaries[dateKey][category] += duration;
        dailySummaries[dateKey].total += duration;
      }

      // Process manual activities
      for (const activity of manualActivities) {
        const dateKey = activity.start_time.toISOString().split('T')[0];
        if (!dailySummaries[dateKey]) {
          dailySummaries[dateKey] = {
            productive: 0,
            neutral: 0,
            distracting: 0,
            offline: 0,
            total: 0
          };
        }

        const duration = Math.floor((activity.end_time.getTime() - activity.start_time.getTime()) / 1000);
        dailySummaries[dateKey].offline += duration;
        dailySummaries[dateKey].total += duration;
      }

      res.json({
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        dailySummaries,
        totals: Object.values(dailySummaries).reduce((acc: any, day: any) => ({
          productive: acc.productive + day.productive,
          neutral: acc.neutral + day.neutral,
          distracting: acc.distracting + day.distracting,
          offline: acc.offline + day.offline,
          total: acc.total + day.total
        }), {
          productive: 0,
          neutral: 0,
          distracting: 0,
          offline: 0,
          total: 0
        })
      });

    } catch (error) {
      logger.error('Error getting time summary:', error);
      res.status(500).json({ error: 'Failed to get time summary' });
    }
  };

  getCategoryBreakdown = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { period } = req.query; // 'day' or 'week'
      
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      if (period === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else {
        // Default to today
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(endDate.getDate() + 1);
      }

      const activities = await this.activityRepository.find({
        where: {
          user_id: parseInt(userId),
          start_time: Between(startDate, endDate)
        }
      });

      // Group by app/website
      const breakdown: Record<string, any> = {};

      for (const activity of activities) {
        const key = activity.app_name || activity.url || 'Unknown';
        const categoryResult = await ProductivityService.categorizeActivity(activity.app_name || '', activity.url, activity.window_title);
        const category = categoryResult.category;
        const subcategory = categoryResult.subcategory;
        
        if (!breakdown[key]) {
          breakdown[key] = {
            name: key,
            category,
            subcategory,
            totalTime: 0,
            sessions: 0
          };
        }

        breakdown[key].totalTime += activity.duration || 0;
        breakdown[key].sessions += 1;
      }

      // Sort by total time
      const sortedBreakdown = Object.values(breakdown)
        .sort((a, b) => b.totalTime - a.totalTime)
        .slice(0, 20); // Top 20

      res.json({
        breakdown: sortedBreakdown,
        date: startDate.toISOString()
      });

    } catch (error) {
      logger.error('Error getting category breakdown:', error);
      res.status(500).json({ error: 'Failed to get category breakdown' });
    }
  };
}