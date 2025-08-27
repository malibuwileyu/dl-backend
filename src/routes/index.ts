import { Router } from 'express';
import authRoutes from './authRoutes';
import googleAuthRoutes from './googleAuthRoutes';
import userRoutes from './userRoutes';
import organizationRoutes from './organizationRoutes';
import activityRoutes from './activityRoutes';
import deviceRoutes from './deviceRoutes';
import alertRoutes from './alertRoutes';
import reportRoutes from './reportRoutes';
import analysisRoutes from './analysisRoutes';
import subjectRoutes from './subjectRoutes';
import analyticsRoutes from './analyticsRoutes';
import productivityRulesRoutes from './productivityRulesRoutes';
import adminRoutes from './adminRoutes';
import adminProductivityRoutes from './adminProductivityRoutes';
import adminReportsRoutes from './adminReportsRoutes';
import adminAlertRoutes from './adminAlertRoutes';
import aiCategorizationRoutes from './aiCategorizationRoutes';
import { studentRoutes } from './studentRoutes';
import appCategoryRoutes from './appCategoryRoutes';
import websiteCategoryRoutes from './websiteCategoryRoutes';
import adminActiveStudentsRoute from './adminActiveStudentsRoute';
import testActivityRoute from './testActivityRoute';

export function setupRoutes(): Router {
  const router = Router();

  // Public routes
  router.use('/auth', authRoutes);
  router.use('/auth', googleAuthRoutes);
  
  // Protected routes
  router.use('/users', userRoutes);
  router.use('/organizations', organizationRoutes);
  router.use('/activities', activityRoutes);
  router.use('/devices', deviceRoutes);
  router.use('/alerts', alertRoutes);
  router.use('/reports', reportRoutes);
  router.use('/analysis', analysisRoutes);
  router.use('/subjects', subjectRoutes);
  router.use('/analytics', analyticsRoutes);
  router.use('/productivity-rules', productivityRulesRoutes);
  router.use('/admin', adminRoutes);
  router.use('/admin', adminProductivityRoutes);
  router.use('/admin', adminAlertRoutes);
  router.use('/admin', adminActiveStudentsRoute);
  router.use('/admin/reports', adminReportsRoutes);
  router.use('/admin/ai-categorization', aiCategorizationRoutes);
  router.use('/student', studentRoutes);
  router.use('/app-categories', appCategoryRoutes);
  router.use('/website-categories', websiteCategoryRoutes);
  router.use('/test', testActivityRoute);

  return router;
}