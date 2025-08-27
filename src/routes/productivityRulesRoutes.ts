import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { getPool } from '../config/database';
import { logger } from '../config/logger';

const router = Router();

// Get productivity rules for organization
router.get('/organization', authenticate, async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = (req as any).user?.userId;
    
    // Get user's organization
    const userResult = await getPool().query(
      'SELECT organization_id, role FROM users WHERE id = $1',
      [userId]
    );
    
    if (!userResult.rows[0]?.organization_id) {
      return res.status(400).json({ error: 'User not associated with organization' });
    }
    
    const { organization_id, role } = userResult.rows[0];
    
    // Get rules
    const rulesResult = await getPool().query(`
      SELECT 
        id, rule_type, pattern, category, productivity_score, 
        subject, priority, active, created_at
      FROM productivity_rules
      WHERE organization_id = $1
      ORDER BY priority DESC, created_at DESC
    `, [organization_id]);
    
    return res.json({
      rules: rulesResult.rows,
      canEdit: role === 'admin' || role === 'teacher'
    });
  } catch (error) {
    logger.error('Error fetching productivity rules:', error);
    return res.status(500).json({ error: 'Failed to fetch productivity rules' });
  }
});

// Create new rule (admin/teacher only)
router.post('/', authenticate, async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = (req as any).user?.userId;
    const { rule_type, pattern, category, productivity_score, subject, priority } = req.body;
    
    // Validate inputs
    if (!rule_type || !pattern) {
      return res.status(400).json({ error: 'Rule type and pattern are required' });
    }
    
    // Get user's organization and check permissions
    const userResult = await getPool().query(
      'SELECT organization_id, role FROM users WHERE id = $1',
      [userId]
    );
    
    const { organization_id, role } = userResult.rows[0];
    
    if (role !== 'admin' && role !== 'teacher') {
      return res.status(403).json({ error: 'Only admins and teachers can create rules' });
    }
    
    // Create rule
    const result = await getPool().query(`
      INSERT INTO productivity_rules (
        organization_id, created_by, rule_type, pattern, 
        category, productivity_score, subject, priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      organization_id,
      userId,
      rule_type,
      pattern.toLowerCase(),
      category || null,
      productivity_score || 0.5,
      subject || null,
      priority || 0
    ]);
    
    logger.info(`Productivity rule created: ${pattern} by user ${userId}`);
    
    return res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating productivity rule:', error);
    return res.status(500).json({ error: 'Failed to create productivity rule' });
  }
});

// Update rule (admin/teacher only)
router.put('/:ruleId', authenticate, async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = (req as any).user?.userId;
    const { ruleId } = req.params;
    const updates = req.body;
    
    // Check permissions
    const userResult = await getPool().query(
      'SELECT organization_id, role FROM users WHERE id = $1',
      [userId]
    );
    
    const { organization_id, role } = userResult.rows[0];
    
    if (role !== 'admin' && role !== 'teacher') {
      return res.status(403).json({ error: 'Only admins and teachers can update rules' });
    }
    
    // Build update query
    const allowedFields = ['pattern', 'category', 'productivity_score', 'subject', 'priority', 'active'];
    const updateFields = [];
    const values = [];
    let paramCount = 1;
    
    for (const field of allowedFields) {
      if (field in updates) {
        updateFields.push(`${field} = $${paramCount}`);
        values.push(field === 'pattern' ? updates[field].toLowerCase() : updates[field]);
        paramCount++;
      }
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    values.push(ruleId, organization_id);
    
    const result = await getPool().query(`
      UPDATE productivity_rules
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount} AND organization_id = $${paramCount + 1}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    return res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating productivity rule:', error);
    return res.status(500).json({ error: 'Failed to update productivity rule' });
  }
});

// Delete rule (admin only)
router.delete('/:ruleId', authenticate, async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = (req as any).user?.userId;
    const { ruleId } = req.params;
    
    // Check permissions
    const userResult = await getPool().query(
      'SELECT organization_id, role FROM users WHERE id = $1',
      [userId]
    );
    
    const { organization_id, role } = userResult.rows[0];
    
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete rules' });
    }
    
    const result = await getPool().query(
      'DELETE FROM productivity_rules WHERE id = $1 AND organization_id = $2 RETURNING id',
      [ruleId, organization_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    return res.json({ message: 'Rule deleted successfully' });
  } catch (error) {
    logger.error('Error deleting productivity rule:', error);
    return res.status(500).json({ error: 'Failed to delete productivity rule' });
  }
});

// Get website categorizations (no auth for testing)
router.get('/websites', async (req: Request, res: Response): Promise<Response> => {
  try {
    // Get all website categorizations from websites table
    const websitesResult = await getPool().query(`
      SELECT domain, category, default_productivity_score as productivity_score
      FROM websites
      ORDER BY domain
    `);
    
    // Also get domain-based rules from productivity_rules
    const rulesResult = await getPool().query(`
      SELECT pattern as domain, category, productivity_score
      FROM productivity_rules
      WHERE rule_type = 'website' AND active = true
      ORDER BY priority DESC, pattern
    `);
    
    // Combine and deduplicate
    const allRules = [...websitesResult.rows, ...rulesResult.rows];
    const uniqueRules = Array.from(
      new Map(allRules.map(rule => [rule.domain, rule])).values()
    );
    
    return res.json({
      rules: uniqueRules.map(rule => ({
        domain: rule.domain,
        category: rule.category || 'neutral',
        productivity_score: rule.productivity_score || 0.5
      }))
    });
  } catch (error) {
    logger.error('Error fetching website categorizations:', error);
    return res.status(500).json({ error: 'Failed to fetch website categorizations' });
  }
});

// Save website categorizations (no auth for testing)
router.post('/websites', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { rules } = req.body;
    
    if (!Array.isArray(rules)) {
      return res.status(400).json({ error: 'Rules must be an array' });
    }
    
    const pool = getPool();
    
    // Start transaction
    await pool.query('BEGIN');
    
    try {
      // Clear existing website entries
      await pool.query('DELETE FROM websites');
      
      // Insert new website categorizations
      for (const rule of rules) {
        const score = rule.category === 'productive' ? 0.8 :
                      rule.category === 'distracting' ? 0.2 : 0.5;
        
        await pool.query(`
          INSERT INTO websites (domain, category, default_productivity_score)
          VALUES ($1, $2, $3)
          ON CONFLICT (domain) DO UPDATE
          SET category = $2, default_productivity_score = $3, updated_at = NOW()
        `, [rule.domain, rule.category, score]);
      }
      
      await pool.query('COMMIT');
      
      return res.json({ success: true, rulesUpdated: rules.length });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('Error saving website categorizations:', error);
    return res.status(500).json({ error: 'Failed to save website categorizations' });
  }
});

// Get uncategorized websites for AI analysis
router.get('/uncategorized', async (req: Request, res: Response): Promise<Response> => {
  try {
    // Get domains that have been visited but aren't categorized
    // Get domains that have been visited
    const result = await getPool().query(`
      SELECT 
        substring(url from 'https?://([^/]+)') as domain,
        COUNT(*) as visit_count,
        AVG(EXTRACT(EPOCH FROM (end_time - start_time))) as avg_duration
      FROM activities
      WHERE url IS NOT NULL AND url <> ''
      GROUP BY domain
      ORDER BY visit_count DESC
      LIMIT 50
    `);
    
    return res.json({
      websites: result.rows.map(row => ({
        domain: row.domain,
        visitCount: parseInt(row.visit_count),
        avgDuration: parseFloat(row.avg_duration || 0),
        needsCategorization: true
      }))
    });
  } catch (error) {
    logger.error('Error fetching uncategorized websites:', error);
    return res.status(500).json({ error: 'Failed to fetch uncategorized websites' });
  }
});

// AI Suggestions endpoints
router.get('/ai-suggestions', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { AICategorizationService } = require('../services/aiCategorizationService');
    const suggestions = await AICategorizationService.getSuggestions();
    
    // Get last analysis time from metadata
    const lastAnalysisResult = await getPool().query(`
      SELECT MAX(created_at) as last_analysis
      FROM categorization_suggestions
    `);
    
    return res.json({
      suggestions,
      lastAnalysis: lastAnalysisResult.rows[0]?.last_analysis || null,
      count: suggestions.length
    });
  } catch (error) {
    logger.error('Error fetching AI suggestions:', error);
    return res.status(500).json({ error: 'Failed to fetch AI suggestions' });
  }
});

// Run AI analysis
router.post('/ai-suggestions/analyze', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { AICategorizationService } = require('../services/aiCategorizationService');
    const suggestions = await AICategorizationService.runDailyAnalysis();
    
    return res.json({
      success: true,
      suggestionsCount: suggestions.length,
      suggestions
    });
  } catch (error) {
    logger.error('Error running AI analysis:', error);
    return res.status(500).json({ error: 'Failed to run AI analysis' });
  }
});

// Apply AI suggestion
router.post('/ai-suggestions/:id/apply', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { action, category } = req.body;
    
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    const { AICategorizationService } = require('../services/aiCategorizationService');
    await AICategorizationService.applySuggestion(id, action, category);
    
    return res.json({ success: true });
  } catch (error) {
    logger.error('Error applying AI suggestion:', error);
    return res.status(500).json({ error: 'Failed to apply suggestion' });
  }
});

// Apply multiple AI suggestions
router.post('/ai-suggestions/apply-batch', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { suggestions } = req.body;
    
    if (!Array.isArray(suggestions)) {
      return res.status(400).json({ error: 'Suggestions must be an array' });
    }
    
    const { AICategorizationService } = require('../services/aiCategorizationService');
    let successCount = 0;
    
    for (const suggestion of suggestions) {
      try {
        await AICategorizationService.applySuggestion(
          suggestion.id,
          'approve',
          suggestion.category
        );
        successCount++;
      } catch (error) {
        logger.error(`Error applying suggestion ${suggestion.id}:`, error);
      }
    }
    
    return res.json({ 
      success: true, 
      applied: successCount,
      total: suggestions.length 
    });
  } catch (error) {
    logger.error('Error applying batch suggestions:', error);
    return res.status(500).json({ error: 'Failed to apply suggestions' });
  }
});

export default router;