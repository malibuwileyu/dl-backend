import { getPool } from '../config/database';
import { logger } from '../config/logger';

export class LearningService {
  /**
   * Learn from user behavior patterns to improve categorization
   * Called periodically to analyze usage and update categorization rules
   */
  static async learnFromUsagePatterns(organizationId?: string) {
    const pool = getPool();
    
    try {
      // Analyze domains with low confidence scores
      const query = `
        WITH domain_stats AS (
          SELECT 
            LOWER(SUBSTRING(url FROM '(?:.*://)?(?:www\.)?([^/]+)')) as domain,
            url,
            window_title,
            AVG(EXTRACT(EPOCH FROM (end_time - start_time))) as avg_duration,
            COUNT(*) as visit_count,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(DISTINCT DATE(start_time)) as days_visited,
            -- Calculate focus metric: long sessions = more focused
            AVG(CASE 
              WHEN EXTRACT(EPOCH FROM (end_time - start_time)) > 300 THEN 1  -- >5 min
              ELSE 0 
            END) as focus_score,
            -- Time of day analysis
            AVG(EXTRACT(HOUR FROM start_time)) as avg_hour
          FROM activities
          WHERE url IS NOT NULL
            AND end_time > start_time
            AND start_time > NOW() - INTERVAL '30 days'
            ${organizationId ? 'AND user_id IN (SELECT id FROM users WHERE organization_id = $1)' : ''}
          GROUP BY domain, url, window_title
          HAVING COUNT(*) >= 5  -- Minimum visits to consider
        )
        SELECT 
          domain,
          'neutral' as category,
          0.5 as productivity_score,
          avg_duration,
          visit_count,
          unique_users,
          focus_score,
          CASE
            -- Long focused sessions during work hours = likely productive
            WHEN avg_duration > 600 AND avg_hour BETWEEN 9 AND 17 AND focus_score > 0.7 
              THEN 'productive'
            -- Short scattered visits = likely distracting  
            WHEN avg_duration < 120 AND focus_score < 0.3
              THEN 'distracting'
            -- High engagement from multiple users = worth investigating
            WHEN unique_users >= 3 AND days_visited >= 5
              THEN 'popular'
            ELSE 'neutral'
          END as suggested_category,
          CASE
            WHEN avg_duration > 600 AND focus_score > 0.7 THEN 0.8
            WHEN avg_duration < 120 AND focus_score < 0.3 THEN 0.2
            ELSE 0.5
          END as suggested_score
        FROM domain_stats
        ORDER BY visit_count DESC
        LIMIT 50
      `;
      
      const params = organizationId ? [organizationId] : [];
      const result = await pool.query(query, params);
      
      logger.info(`[LearningService] Found ${result.rows.length} domains to analyze`);
      
      // Create suggested rules based on patterns
      const suggestedRules: any[] = [];
      
      for (const row of result.rows) {
        if (row.suggested_category !== row.category || 
            Math.abs(row.suggested_score - row.productivity_score) > 0.2) {
          
          suggestedRules.push({
            domain: row.domain,
            current_category: row.category,
            suggested_category: row.suggested_category,
            current_score: row.productivity_score,
            suggested_score: row.suggested_score,
            confidence: row.focus_score,
            evidence: {
              avg_duration_seconds: Math.round(row.avg_duration),
              visit_count: row.visit_count,
              unique_users: row.unique_users,
              focus_score: row.focus_score
            }
          });
        }
      }
      
      // Store suggestions for admin review
      if (suggestedRules.length > 0) {
        await this.storeSuggestions(suggestedRules, organizationId);
      }
      
      return suggestedRules;
      
    } catch (error) {
      logger.error('[LearningService] Error learning from patterns:', error);
      return [];
    }
  }
  
  /**
   * Store categorization suggestions for admin review
   */
  private static async storeSuggestions(suggestions: any[], organizationId?: string) {
    const pool = getPool();
    
    try {
      for (const suggestion of suggestions) {
        await pool.query(`
          INSERT INTO ai_categorization_suggestions (
            pattern, suggested_category, confidence,
            reason, organization_id, status
          ) VALUES ($1, $2, $3, $4, $5, 'pending')
        `, [
          suggestion.domain,
          suggestion.suggested_category,
          suggestion.confidence,
          JSON.stringify(suggestion.evidence || {}),
          organizationId
        ]);
      }
      
      logger.info(`[LearningService] Stored ${suggestions.length} categorization suggestions`);
      
    } catch (error) {
      logger.error('[LearningService] Error storing suggestions:', error);
    }
  }
  
  /**
   * Apply approved suggestions to create new productivity rules
   */
  static async applySuggestion(suggestionId: string) {
    const pool = getPool();
    
    try {
      // Get the suggestion
      const result = await pool.query(`
        SELECT * FROM categorization_suggestions WHERE id = $1
      `, [suggestionId]);
      
      if (result.rows.length === 0) {
        throw new Error('Suggestion not found');
      }
      
      const suggestion = result.rows[0];
      
      // Create a new productivity rule
      await pool.query(`
        INSERT INTO productivity_rules (
          pattern, category, productivity_score,
          organization_id, priority, active
        ) VALUES ($1, $2, $3, $4, 100, true)
      `, [
        suggestion.pattern,
        suggestion.suggested_category,
        suggestion.suggested_score,
        suggestion.organization_id
      ]);
      
      // Mark suggestion as applied
      await pool.query(`
        UPDATE categorization_suggestions 
        SET status = 'applied', applied_at = NOW()
        WHERE id = $1
      `, [suggestionId]);
      
      logger.info(`[LearningService] Applied suggestion for ${suggestion.pattern}`);
      
    } catch (error) {
      logger.error('[LearningService] Error applying suggestion:', error);
      throw error;
    }
  }
}