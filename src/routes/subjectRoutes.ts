import { Router, Request, Response } from 'express';
import { SubjectService } from '../services/subjectService';
import { authenticate } from '../middlewares/authenticate';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Get all subjects
router.get('/subjects', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const subjects = await SubjectService.getAllSubjects();
  res.json({ subjects });
}));

// Get student's schedule
router.get('/schedule', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const dayOfWeek = req.query.day ? parseInt(req.query.day as string) : undefined;
  
  const schedule = await SubjectService.getStudentSchedule(userId, dayOfWeek);
  res.json({ schedule });
}));

// Update student's schedule
router.post('/schedule', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { subject_id, day_of_week, start_time, end_time } = req.body;
  
  if (!subject_id || day_of_week === undefined || !start_time || !end_time) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  
  const scheduleEntry = await SubjectService.upsertStudentSchedule(
    userId,
    subject_id,
    day_of_week,
    start_time,
    end_time
  );
  
  res.json({ schedule: scheduleEntry });
}));

// Get current subject selection
router.get('/current', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const currentSubject = await SubjectService.getCurrentSubject(userId);
  res.json({ current_subject: currentSubject });
}));

// Set current subject
router.post('/current', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { subject_id, device_id } = req.body;
  
  if (!subject_id) {
    res.status(400).json({ error: 'subject_id is required' });
    return;
  }
  
  const selection = await SubjectService.setCurrentSubject(userId, subject_id, device_id);
  
  // Emit via WebSocket
  const io = (req as any).io;
  if (io) {
    io.to(`user:${userId}`).emit('subject:changed', {
      subject_id,
      selection
    });
  }
  
  res.json({ selection });
}));

// End current subject
router.delete('/current', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  await SubjectService.endCurrentSubject(userId);
  
  // Emit via WebSocket
  const io = (req as any).io;
  if (io) {
    io.to(`user:${userId}`).emit('subject:ended', {});
  }
  
  res.json({ message: 'Current subject ended' });
}));

// Get subject activity summary
router.get('/activity-summary', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { start_date, end_date } = req.query;
  
  if (!start_date || !end_date) {
    res.status(400).json({ error: 'start_date and end_date are required' });
    return;
  }
  
  const summary = await SubjectService.getSubjectActivitySummary(
    userId,
    new Date(start_date as string),
    new Date(end_date as string)
  );
  
  res.json({ summary });
}));

// Detect subject from activity (used by macOS app)
router.post('/detect', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { app_name, url, window_title } = req.body;
  
  if (!app_name) {
    res.status(400).json({ error: 'app_name is required' });
    return;
  }
  
  const detection = await SubjectService.detectSubject(app_name, url, window_title);
  res.json({ detection });
}));

// Check subject compliance
router.post('/check-compliance', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { detected_subject_id } = req.body;
  
  if (!detected_subject_id) {
    res.status(400).json({ error: 'detected_subject_id is required' });
    return;
  }
  
  const compliance = await SubjectService.checkSubjectCompliance(userId, detected_subject_id);
  res.json(compliance);
}));

// Admin endpoints for managing detection rules
router.post('/detection-rules', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  
  // Check if admin
  if (user.role !== 'admin' && user.role !== 'teacher') {
    res.status(403).json({ error: 'Unauthorized' });
    return;
  }
  
  const { subject_id, rule_type, pattern, priority } = req.body;
  
  if (!subject_id || !rule_type || !pattern) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  
  const rule = await SubjectService.addDetectionRule(subject_id, rule_type, pattern, priority);
  res.json({ rule });
}));

export default router;