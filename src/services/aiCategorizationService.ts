import OpenAI from 'openai';
import { logger } from '../config/logger';
import { getPool } from '../config/database';

interface WebsiteSuggestion {
  id?: string;
  domain: string;
  category: 'productive' | 'neutral' | 'distracting';
  subcategory?: 'school' | 'research' | 'creativity' | 'productivity' | 
    'communication' | 'reading' | 'health' | 'gaming' | 'scrolling' | 'entertainment';
  confidence: number;
  reason: string;
  visitCount: number;
  avgDuration: number;
}

export class AICategorizationService {
  private static openai: OpenAI | null = null;

  static initialize() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logger.warn('OpenAI API key not configured - AI categorization disabled');
      return;
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey
    });
  }

  static async analyzeWebsites(websites: Array<{
    domain: string;
    visitCount: number;
    avgDuration: number;
  }>): Promise<WebsiteSuggestion[]> {
    if (!this.openai) {
      throw new Error('OpenAI not initialized');
    }

    try {
      const prompt = `Analyze these websites visited by students and categorize them for productivity tracking.

Categories and Subcategories:
- productive: Educational, learning, coding, research, school-related
  - school: Educational platforms, school websites, learning management systems
  - research: Academic research, Wikipedia, scholarly articles
  - creativity: Art, music, video editing, creative tools
  - productivity: Task managers, calendars, organization tools
- neutral: Could be either productive or distracting depending on context
  - communication: Email, messaging, video calls
  - reading: News, blogs, general articles
  - health: Fitness, meditation, health tracking
- distracting: Social media, games, entertainment, non-educational
  - gaming: Game websites, gaming platforms
  - scrolling: Social media (Instagram, TikTok, Reddit, Twitter)
  - entertainment: YouTube, Netflix, streaming services

For each website, provide:
1. Category (productive/neutral/distracting)
2. Subcategory from the list above
3. Confidence score (0.0-1.0)
4. Brief reason for categorization

Websites to analyze:
${websites.map(w => `- ${w.domain} (visited ${w.visitCount} times, avg ${Math.round(w.avgDuration / 60)}min/visit)`).join('\n')}

Respond in JSON format:
{
  "suggestions": [
    {
      "domain": "example.com",
      "category": "productive",
      "subcategory": "school",
      "confidence": 0.85,
      "reason": "Brief explanation"
    }
  ]
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at categorizing websites for student productivity tracking. Be conservative with "productive" categorization - only clearly educational sites should be productive. Gaming, social media, and entertainment should always be distracting. Always provide both a category and a specific subcategory from the list provided.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 2000
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);
      const suggestions = parsed.suggestions || [];

      // Merge with original data
      return websites.map(website => {
        const suggestion = suggestions.find((s: any) => s.domain === website.domain);
        return {
          domain: website.domain,
          category: suggestion?.category || 'neutral',
          subcategory: suggestion?.subcategory,
          confidence: suggestion?.confidence || 0.5,
          reason: suggestion?.reason || 'Unable to categorize',
          visitCount: website.visitCount,
          avgDuration: website.avgDuration
        };
      });
    } catch (error) {
      logger.error('Error analyzing websites with AI:', error);
      throw error;
    }
  }

  static async saveSuggestions(suggestions: WebsiteSuggestion[]) {
    const pool = getPool();
    
    try {
      await pool.query('BEGIN');
      
      // Clear old suggestions
      await pool.query('DELETE FROM ai_categorization_suggestions WHERE status = $1', ['pending']);
      
      // Insert new suggestions
      for (const suggestion of suggestions) {
        await pool.query(`
          INSERT INTO ai_categorization_suggestions (
            pattern, suggested_category, suggested_subcategory, confidence, reason, status
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          suggestion.domain,
          suggestion.category,
          suggestion.subcategory || null,
          suggestion.confidence,
          JSON.stringify({
            reason: suggestion.reason,
            visitCount: suggestion.visitCount,
            avgDuration: suggestion.avgDuration
          }),
          'pending'
        ]);
      }
      
      await pool.query('COMMIT');
      
      logger.info(`Saved ${suggestions.length} AI categorization suggestions`);
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  }

  static async getSuggestions(): Promise<WebsiteSuggestion[]> {
    const result = await getPool().query(`
      SELECT 
        id,
        pattern as domain,
        suggested_category as category,
        suggested_subcategory as subcategory,
        confidence,
        reason,
        created_at
      FROM ai_categorization_suggestions
      WHERE status = 'pending'
      ORDER BY confidence DESC, created_at DESC
    `);

    return result.rows.map(row => ({
      id: row.id,
      domain: row.domain,
      category: row.category,
      subcategory: row.subcategory || undefined,
      confidence: parseFloat(row.confidence),
      reason: typeof row.reason === 'string' ? JSON.parse(row.reason).reason : '',
      visitCount: typeof row.reason === 'string' ? JSON.parse(row.reason).visitCount : 0,
      avgDuration: typeof row.reason === 'string' ? JSON.parse(row.reason).avgDuration : 0
    }));
  }

  static async applySuggestion(suggestionId: string, action: 'approve' | 'reject', newCategory?: string, newSubcategory?: string) {
    const pool = getPool();
    
    try {
      await pool.query('BEGIN');
      
      // Get the suggestion
      const suggestionResult = await pool.query(
        'SELECT * FROM ai_categorization_suggestions WHERE id = $1',
        [suggestionId]
      );
      
      if (suggestionResult.rows.length === 0) {
        throw new Error('Suggestion not found');
      }
      
      const suggestion = suggestionResult.rows[0];
      
      if (action === 'approve') {
        const category = newCategory || suggestion.suggested_category;
        const subcategory = newSubcategory || suggestion.suggested_subcategory;
        
        // Add to website_categories table with subcategory
        await pool.query(`
          INSERT INTO website_categories (pattern, category, subcategory, priority, is_system)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (pattern) DO UPDATE
          SET category = $2, subcategory = $3, updated_at = NOW()
        `, [suggestion.pattern, category, subcategory || null, 1, false]);
        
        logger.info(`Applied categorization for domain ${suggestion.pattern}: category=${category}, subcategory=${subcategory}`);
      }
      
      // Update suggestion status
      await pool.query(`
        UPDATE ai_categorization_suggestions
        SET status = $1, updated_at = NOW()
        WHERE id = $2
      `, [action === 'approve' ? 'approved' : 'rejected', suggestionId]);
      
      await pool.query('COMMIT');
      
      logger.info(`Suggestion ${suggestionId} ${action}ed`);
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  }

  static async runDailyAnalysis() {
    try {
      // Get uncategorized websites
      const result = await getPool().query(`
        SELECT 
          substring(url from 'https?://([^/]+)') as domain,
          COUNT(*) as visit_count,
          AVG(EXTRACT(EPOCH FROM (end_time - start_time))) as avg_duration
        FROM activities
        WHERE url IS NOT NULL AND url <> ''
          -- No category column in activities table, analyze all URLs
          AND start_time > NOW() - INTERVAL '7 days'
        GROUP BY domain
        HAVING COUNT(*) >= 3  -- At least 3 visits to be worth analyzing
        ORDER BY visit_count DESC
        LIMIT 20
      `);

      if (result.rows.length === 0) {
        logger.info('No uncategorized websites to analyze');
        return [];
      }

      const websites = result.rows.map(row => ({
        domain: row.domain,
        visitCount: parseInt(row.visit_count),
        avgDuration: parseFloat(row.avg_duration || 0)
      }));

      logger.info(`Analyzing ${websites.length} uncategorized websites with AI`);
      
      const suggestions = await this.analyzeWebsites(websites);
      await this.saveSuggestions(suggestions);
      
      return suggestions;
    } catch (error) {
      logger.error('Error running daily AI analysis:', error);
      throw error;
    }
  }
}

// Initialize on module load
AICategorizationService.initialize();