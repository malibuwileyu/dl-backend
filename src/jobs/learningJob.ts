import { CronJob } from 'cron';
import { LearningService } from '../services/learningService';
import { logger } from '../config/logger';

export function setupLearningJob() {
  // Run learning analysis daily at 2 AM
  const job = new CronJob(
    '0 2 * * *', // Daily at 2 AM
    async () => {
      logger.info('[LearningJob] Starting daily usage pattern analysis...');
      
      try {
        const suggestions = await LearningService.learnFromUsagePatterns();
        logger.info(`[LearningJob] Generated ${suggestions.length} categorization suggestions`);
        
        // Log some examples
        suggestions.slice(0, 5).forEach(s => {
          logger.info(`[LearningJob] Suggestion: ${s.domain} - ${s.current_category} -> ${s.suggested_category} (confidence: ${s.confidence})`);
        });
        
      } catch (error) {
        logger.error('[LearningJob] Error during learning analysis:', error);
      }
    },
    null,
    true, // Start immediately
    'America/Los_Angeles'
  );
  
  // Also run a quick analysis on startup (after 1 minute)
  setTimeout(async () => {
    logger.info('[LearningJob] Running initial usage pattern analysis...');
    try {
      await LearningService.learnFromUsagePatterns();
    } catch (error) {
      logger.error('[LearningJob] Error during initial analysis:', error);
    }
  }, 60000); // 1 minute after startup
  
  return job;
}