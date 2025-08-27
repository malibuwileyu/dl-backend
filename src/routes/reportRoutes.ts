import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/authenticate';

const router = Router();

// Require authentication for all routes
router.use(authenticate);

// Stub routes - to be implemented
router.get('/daily', authorize('teacher', 'admin'), (req, res) => {
  res.json({ report: {} });
});

router.get('/weekly', authorize('teacher', 'admin'), (req, res) => {
  res.json({ report: {} });
});

router.get('/subjects', authorize('teacher', 'admin'), (req, res) => {
  res.json({ subjects: [] });
});

export default router;