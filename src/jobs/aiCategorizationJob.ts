import { CronJob } from 'cron';
import { AICategorizationService } from '../services/aiCategorizationService';
import { logger } from '../config/logger';

export function setupAICategorizationJob() {
  // Run AI categorization daily at 3 AM (after learning job)
  const job = new CronJob(
    '0 3 * * *', // Daily at 3 AM
    async () => {
      logger.info('[AICategorizationJob] Starting daily AI website categorization...');
      
      try {
        const suggestions = await AICategorizationService.runDailyAnalysis();
        logger.info(`[AICategorizationJob] Generated ${suggestions.length} AI categorization suggestions`);
        
        if (suggestions.length > 0) {
          logger.info('[AICategorizationJob] Suggestions are available for admin review at /ai-suggestions.html');
          
          // Log first few suggestions
          suggestions.slice(0, 3).forEach(s => {
            logger.info(`[AICategorizationJob] Suggested: ${s.domain} -> ${s.category} (confidence: ${s.confidence})`);
          });
        }
        
      } catch (error) {
        logger.error('[AICategorizationJob] Error during AI categorization:', error);
      }
    },
    null,
    true, // Start immediately
    'America/Los_Angeles'
  );
  
  logger.info('[AICategorizationJob] AI categorization job scheduled for 3 AM daily');
  
  return job;
}