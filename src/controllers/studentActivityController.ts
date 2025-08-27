import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { ManualActivity } from '../entities/ManualActivity';
import { User } from '../entities/User';
import { logger } from '../config/logger';
import { Between } from 'typeorm';

export class StudentActivityController {
  private manualActivityRepository = AppDataSource.getRepository(ManualActivity);
  private userRepository = AppDataSource.getRepository(User);

  addManualActivity = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Validate user is a student
      const user = await this.userRepository.findOne({ where: { id: parseInt(userId) } });
      if (user?.role !== 'student') {
        res.status(403).json({ error: 'Access denied. Students only.' });
        return;
      }

      const { activity_name, activity_type, start_time, end_time, notes } = req.body;

      // Validate required fields
      if (!activity_name || !activity_type || !start_time || !end_time) {
        res.status(400).json({ 
          error: 'Missing required fields: activity_name, activity_type, start_time, end_time' 
        });
        return;
      }

      // Validate dates
      const startDate = new Date(start_time);
      const endDate = new Date(end_time);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        res.status(400).json({ error: 'Invalid date format' });
        return;
      }

      if (endDate <= startDate) {
        res.status(400).json({ error: 'End time must be after start time' });
        return;
      }

      // Don't allow future activities
      if (endDate > new Date()) {
        res.status(400).json({ error: 'Cannot add future activities' });
        return;
      }

      // Create manual activity
      const activity = this.manualActivityRepository.create({
        user_id: parseInt(userId),
        activity_name,
        activity_type,
        start_time: startDate,
        end_time: endDate,
        notes
      });

      await this.manualActivityRepository.save(activity);

      logger.info(`Manual activity added for user ${userId}: ${activity_name}`);

      res.status(201).json({
        message: 'Activity added successfully',
        activity: {
          id: activity.id,
          activity_name: activity.activity_name,
          activity_type: activity.activity_type,
          start_time: activity.start_time,
          end_time: activity.end_time,
          duration: Math.floor((endDate.getTime() - startDate.getTime()) / 1000),
          notes: activity.notes
        }
      });

    } catch (error) {
      logger.error('Error adding manual activity:', error);
      res.status(500).json({ error: 'Failed to add activity' });
    }
  };

  getActivities = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { date, start_date, end_date } = req.query;

      let whereConditions: any = { user_id: parseInt(userId) };

      // Handle date filtering
      if (date) {
        const targetDate = new Date(date as string);
        targetDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        whereConditions.start_time = Between(targetDate, nextDay);
      } else if (start_date && end_date) {
        whereConditions.start_time = Between(
          new Date(start_date as string),
          new Date(end_date as string)
        );
      }

      const activities = await this.manualActivityRepository.find({
        where: whereConditions,
        order: {
          start_time: 'DESC'
        }
      });

      res.json({
        activities: activities.map(a => ({
          id: a.id,
          activity_name: a.activity_name,
          activity_type: a.activity_type,
          start_time: a.start_time,
          end_time: a.end_time,
          duration: Math.floor((a.end_time.getTime() - a.start_time.getTime()) / 1000),
          notes: a.notes,
          created_at: a.created_at
        }))
      });

    } catch (error) {
      logger.error('Error getting manual activities:', error);
      res.status(500).json({ error: 'Failed to get activities' });
    }
  };

  updateManualActivity = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Find activity and verify ownership
      const activity = await this.manualActivityRepository.findOne({
        where: { id: parseInt(id), user_id: parseInt(userId) }
      });

      if (!activity) {
        res.status(404).json({ error: 'Activity not found' });
        return;
      }

      const { activity_name, activity_type, start_time, end_time, notes } = req.body;

      // Update fields if provided
      if (activity_name) activity.activity_name = activity_name;
      if (activity_type) activity.activity_type = activity_type;
      if (notes !== undefined) activity.notes = notes;

      if (start_time) {
        const startDate = new Date(start_time);
        if (!isNaN(startDate.getTime())) {
          activity.start_time = startDate;
        }
      }

      if (end_time) {
        const endDate = new Date(end_time);
        if (!isNaN(endDate.getTime())) {
          activity.end_time = endDate;
        }
      }

      // Validate dates
      if (activity.end_time <= activity.start_time) {
        res.status(400).json({ error: 'End time must be after start time' });
        return;
      }

      await this.manualActivityRepository.save(activity);

      res.json({
        message: 'Activity updated successfully',
        activity: {
          id: activity.id,
          activity_name: activity.activity_name,
          activity_type: activity.activity_type,
          start_time: activity.start_time,
          end_time: activity.end_time,
          duration: Math.floor((activity.end_time.getTime() - activity.start_time.getTime()) / 1000),
          notes: activity.notes
        }
      });

    } catch (error) {
      logger.error('Error updating manual activity:', error);
      res.status(500).json({ error: 'Failed to update activity' });
    }
  };

  deleteManualActivity = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Find activity and verify ownership
      const activity = await this.manualActivityRepository.findOne({
        where: { id: parseInt(id), user_id: parseInt(userId) }
      });

      if (!activity) {
        res.status(404).json({ error: 'Activity not found' });
        return;
      }

      await this.manualActivityRepository.remove(activity);

      logger.info(`Manual activity deleted: ${id} for user ${userId}`);

      res.json({ message: 'Activity deleted successfully' });

    } catch (error) {
      logger.error('Error deleting manual activity:', error);
      res.status(500).json({ error: 'Failed to delete activity' });
    }
  };
}