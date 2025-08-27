import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/authenticate';

const router = Router();

// Require authentication for all routes
router.use(authenticate);

// Stub routes - to be implemented
router.get('/', authorize('admin'), (req, res) => {
  res.json({ organizations: [] });
});

export default router;