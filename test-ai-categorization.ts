import 'dotenv/config';
import { AICategorizationService } from './src/services/aiCategorizationService';
import { connectDatabase, getPool } from './src/config/database';
import { logger } from './src/config/logger';

async function testAICategorization() {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('Connected to database');

    // Initialize AI service
    AICategorizationService.initialize();
    logger.info('AI service initialized');

    // Check for uncategorized websites in activities
    const result = await getPool().query(`
      SELECT 
        substring(url from 'https?://([^/]+)') as domain,
        COUNT(*) as visit_count,
        AVG(EXTRACT(EPOCH FROM (end_time - start_time))) as avg_duration
      FROM activities
      WHERE url IS NOT NULL AND url <> ''
        AND start_time > NOW() - INTERVAL '7 days'
      GROUP BY domain
      HAVING COUNT(*) >= 1  -- Lower threshold for testing
      ORDER BY visit_count DESC
      LIMIT 10
    `);

    logger.info(`Found ${result.rows.length} websites to analyze`);
    
    if (result.rows.length === 0) {
      logger.info('No websites found in activities table');
      
      // Let's create some test data
      const testWebsites = [
        { domain: 'github.com', visitCount: 50, avgDuration: 600 },
        { domain: 'stackoverflow.com', visitCount: 30, avgDuration: 300 },
        { domain: 'facebook.com', visitCount: 20, avgDuration: 900 },
        { domain: 'youtube.com', visitCount: 40, avgDuration: 1200 },
        { domain: 'coursera.org', visitCount: 15, avgDuration: 1800 }
      ];
      
      logger.info('Testing with sample websites:', testWebsites);
      
      const suggestions = await AICategorizationService.analyzeWebsites(testWebsites);
      logger.info('AI suggestions:', suggestions);
      
      await AICategorizationService.saveSuggestions(suggestions);
      logger.info('Suggestions saved to database');
    } else {
      // Use actual data
      const websites = result.rows.map(row => ({
        domain: row.domain,
        visitCount: parseInt(row.visit_count),
        avgDuration: parseFloat(row.avg_duration || 0)
      }));
      
      logger.info('Analyzing websites:', websites);
      
      const suggestions = await AICategorizationService.analyzeWebsites(websites);
      logger.info('AI suggestions:', suggestions);
      
      await AICategorizationService.saveSuggestions(suggestions);
      logger.info('Suggestions saved to database');
    }

    // Verify saved suggestions
    const savedResult = await getPool().query(`
      SELECT * FROM ai_categorization_suggestions 
      WHERE status = 'pending' 
      ORDER BY created_at DESC
    `);
    
    logger.info(`Saved ${savedResult.rows.length} suggestions in database`);
    savedResult.rows.forEach(row => {
      logger.info(`- ${row.pattern}: ${row.suggested_category} (confidence: ${row.confidence})`);
    });

    process.exit(0);
  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testAICategorization();