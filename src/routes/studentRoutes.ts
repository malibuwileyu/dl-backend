import { Router } from 'express';
import { StudentController } from '../controllers/studentController';
import { authenticate } from '../middlewares/authenticate';
import { StudentActivityController } from '../controllers/studentActivityController';

const router = Router();
const studentController = new StudentController();
const activityController = new StudentActivityController();

// All routes require authentication
router.use(authenticate);

// Dashboard endpoint - get student's daily summary and activities
router.get('/dashboard', studentController.getDashboard);

// Manual activity endpoints
router.post('/activities/manual', activityController.addManualActivity);
router.get('/activities', activityController.getActivities);
router.put('/activities/manual/:id', activityController.updateManualActivity);
router.delete('/activities/manual/:id', activityController.deleteManualActivity);

// Time reflection endpoints
router.get('/time-summary/:period', studentController.getTimeSummary);
router.get('/category-breakdown', studentController.getCategoryBreakdown);

export { router as studentRoutes };