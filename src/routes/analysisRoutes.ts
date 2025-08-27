import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { ProductivityService } from '../services/productivityService';

const router = Router();

// Require authentication for all routes
router.use(authenticate);

// Analyze browser content
router.post('/categorize', async (req, res) => {
  const { url, title } = req.body;
  
  if (!url || !title) {
    return res.status(400).json({ error: 'URL and title are required' });
  }
  
  try {
    const result = await ProductivityService.categorizeActivity('Browser', url, title);
    
    if (result) {
      return res.json({
        success: true,
        categorization: result
      });
    } else {
      // Fallback to basic keyword categorization
      return res.json({
        success: false,
        message: 'AI categorization unavailable, use local categorization'
      });
    }
  } catch (error) {
    console.error('[Analysis Route] Error:', error instanceof Error ? error.message : 'Unknown error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;