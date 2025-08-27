import { Router, Request, Response } from 'express';
import { logger } from '../config/logger';
import { AICategorizationService } from '../services/aiCategorizationService';

const router = Router();

// Extend Request type to include user
interface AuthRequest extends Request {
  user?: {
    userId: string;
    organizationId: string;
    role: 'student' | 'teacher' | 'admin';
  };
}

// Get pending AI suggestions
router.get('/suggestions', async (req: AuthRequest, res: Response) => {
  try {
    const suggestions = await AICategorizationService.getSuggestions();
    return res.json({ suggestions });
  } catch (error) {
    logger.error('Error fetching AI suggestions:', error);
    return res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// Apply or reject a suggestion
router.post('/suggestions/:id/review', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action, newCategory } = req.body;
    
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be approve or reject.' });
    }
    
    if (action === 'approve' && newCategory) {
      if (!['productive', 'neutral', 'distracting'].includes(newCategory)) {
        return res.status(400).json({ error: 'Invalid category' });
      }
    }
    
    await AICategorizationService.applySuggestion(id, action, newCategory);
    
    return res.json({ success: true });
  } catch (error) {
    logger.error('Error reviewing suggestion:', error);
    return res.status(500).json({ error: 'Failed to review suggestion' });
  }
});

// Manually trigger AI analysis (admin only)
router.post('/analyze', async (req: AuthRequest, res: Response) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    logger.info('Manual AI categorization triggered by admin');
    
    const suggestions = await AICategorizationService.runDailyAnalysis();
    
    return res.json({ 
      success: true, 
      suggestionsCount: suggestions.length,
      suggestions: suggestions.slice(0, 5) // Return first 5 for preview
    });
  } catch (error) {
    logger.error('Error running manual AI analysis:', error);
    return res.status(500).json({ error: 'Failed to run AI analysis' });
  }
});

export default router;