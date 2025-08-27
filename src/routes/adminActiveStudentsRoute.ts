import { Router, Request, Response, NextFunction } from 'express';
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

// Temporary admin check middleware
const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  // Temporarily disabled - allow all access
  next();
};

router.get('/active-students', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Get data from the active student service (already cached and updating)
    const { activeStudentService } = await import('../services/activeStudentService');
    const data = activeStudentService.getActiveStudents();
    
    res.json(data);
  } catch (error) {
    logger.error('Error fetching active students:', error);
    res.status(500).json({ error: 'Failed to fetch active students' });
  }
});

export default router;