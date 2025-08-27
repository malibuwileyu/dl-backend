import { getPool } from '../config/database';
import { logger } from '../config/logger';
import { AppCategoryService } from './appCategoryService';

import { SubcategoryType } from '../entities/AppCategory';

export interface ProductivityCategory {
  category: 'productive' | 'neutral' | 'distracting';
  subcategory?: SubcategoryType;
  confidence: number;
  reason: string;
  subject?: string;
}

export class ProductivityService {
  // Default productive domains - always considered on-task
  private static readonly productiveDomains = [
    // Educational platforms
    'khanacademy.org',
    'coursera.org',
    'udemy.com',
    'edx.org',
    'brilliant.org',
    'codecademy.com',
    'duolingo.com',
    
    // Research & reference
    'wikipedia.org',
    'britannica.com',
    'scholar.google.com',
    'jstor.org',
    'pubmed.ncbi.nlm.nih.gov',
    
    // Development tools
    'github.com',
    'gitlab.com',
    'stackoverflow.com',
    'developer.mozilla.org',
    'docs.microsoft.com',
    'docs.google.com',
    
    // School platforms
    'classroom.google.com',
    'canvas.instructure.com',
    'blackboard.com',
    'moodle.org',
    'schoology.com'
  ];

  // Context-dependent domains - can be productive or distracting
  private static readonly contextDependentDomains = [
    'youtube.com',    // Could be educational videos or entertainment
    'reddit.com',     // Could be r/learnprogramming or r/memes
    'discord.com',    // Could be study groups or gaming
    'slack.com',      // Could be class communication or social
    'notion.so',      // Could be notes or personal use
    'twitter.com',    // Could be edu content or social
    'x.com'          // Same as twitter
  ];

  // Always distracting domains
  private static readonly distractingDomains = [
    'netflix.com',
    'hulu.com',
    'disney.com',
    'hbomax.com',
    'twitch.tv',
    'tiktok.com',
    'instagram.com',
    'facebook.com',
    'snapchat.com',
    'pinterest.com',
    '9gag.com',
    'imgur.com',
    'buzzfeed.com'
  ];

  // Productive apps
  private static readonly productiveApps = [
    'Terminal',
    'iTerm2',
    'Visual Studio Code',
    'Xcode',
    'IntelliJ IDEA',
    'Eclipse',
    'Android Studio',
    'Sublime Text',
    'Atom',
    'PyCharm',
    'WebStorm',
    'Microsoft Word',
    'Microsoft Excel',
    'Microsoft PowerPoint',
    'Pages',
    'Numbers',
    'Keynote',
    'Google Chrome', // When on productive sites
    'Safari',        // When on productive sites
    'Firefox',       // When on productive sites
    'Zoom',
    'Microsoft Teams',
    'Obsidian',
    'Notion',
    'Anki',
    'GoodNotes',
    'Notability'
  ];

  // Distracting apps
  private static readonly distractingApps = [
    'Discord',      // Unless in study mode
    'Slack',        // Unless for school
    'WhatsApp',
    'Telegram',
    'Messages',
    'Steam',
    'Epic Games Launcher',
    'Battle.net',
    'Origin',
    'Minecraft',
    'Roblox',
    'Fortnite',
    'League of Legends',
    'Valorant',
    'Spotify',      // Could be either
    'Apple Music',  // Could be either
    'VLC'          // Could be either
  ];

  static async categorizeActivity(
    appName: string,
    url?: string,
    windowTitle?: string,
    userId?: string,
    organizationId?: string
  ): Promise<ProductivityCategory> {
    // First check database categories
    try {
      const orgId = organizationId ? parseInt(organizationId) : undefined;
      const categoryInfo = await AppCategoryService.getCategoryForApp(appName, undefined, orgId);
      
      // If we have a specific category set, use it with high confidence
      if (categoryInfo.category !== 'neutral' || categoryInfo.subcategory) {
        return {
          category: categoryInfo.category,
          subcategory: categoryInfo.subcategory,
          confidence: 0.95,
          reason: `${appName} is categorized as ${categoryInfo.category}${categoryInfo.subcategory ? ` (${categoryInfo.subcategory})` : ''} by organization policy`
        };
      }
    } catch (error) {
      logger.error('Error checking app categories:', error);
    }

    // Then check custom rules if we have user/org context
    if (userId || organizationId) {
      const customCategory = await this.checkCustomRules(
        appName,
        url,
        windowTitle,
        userId,
        organizationId
      );
      if (customCategory) return customCategory;
    }

    // Check URL-based categorization
    if (url) {
      const urlCategory = await this.categorizeByUrl(url, windowTitle);
      if (urlCategory.category !== 'neutral' || urlCategory.confidence > 0.7) {
        return urlCategory;
      }
    }

    // Check app-based categorization
    const appCategory = this.categorizeByApp(appName, url, windowTitle);
    
    // If both are neutral, return neutral
    if (url && appCategory.category === 'neutral') {
      return {
        category: 'neutral',
        confidence: 0.5,
        reason: 'Activity does not match any productivity rules'
      };
    }

    return appCategory;
  }

  private static async categorizeByUrl(url: string, windowTitle?: string): Promise<ProductivityCategory> {
    const domain = this.extractDomain(url);
    
    // Check if it's localhost (development work)
    if (domain.includes('localhost') || domain.includes('127.0.0.1') || domain.includes('0.0.0.0')) {
      return {
        category: 'productive',
        subcategory: 'productivity',
        confidence: 0.95,
        reason: 'Local development server'
      };
    }
    
    // Check database for website categories
    try {
      const result = await getPool().query(`
        SELECT category, subcategory, name, description
        FROM website_categories
        WHERE $1 LIKE '%' || pattern || '%' OR pattern = $1
        ORDER BY priority DESC, LENGTH(pattern) DESC
        LIMIT 1
      `, [domain]);
      
      if (result.rows.length > 0) {
        const { category, subcategory, description } = result.rows[0];
        return {
          category: category as 'productive' | 'neutral' | 'distracting',
          subcategory: subcategory as SubcategoryType | undefined,
          confidence: 0.9,
          reason: description || `${domain} is categorized as ${category}${subcategory ? ` (${subcategory})` : ''}`
        };
      }
    } catch (error) {
      logger.error('Error checking website categories:', error);
    }
    
    // Fallback to hardcoded lists
    // Check productive domains
    if (this.productiveDomains.some(d => domain.includes(d))) {
      return {
        category: 'productive',
        confidence: 0.8,
        reason: `${domain} is an educational/productive website`
      };
    }

    // Check distracting domains
    if (this.distractingDomains.some(d => domain.includes(d))) {
      return {
        category: 'distracting',
        confidence: 0.8,
        reason: `${domain} is a distracting website`
      };
    }

    // Check context-dependent domains
    if (this.contextDependentDomains.some(d => domain.includes(d))) {
      return this.analyzeContextDependentSite(domain, url, windowTitle);
    }

    // Unknown domain - analyze further
    return this.analyzeUnknownSite(domain, url, windowTitle);
  }

  private static analyzeContextDependentSite(
    domain: string,
    url: string,
    windowTitle?: string
  ): ProductivityCategory {
    const lowerUrl = url.toLowerCase();
    const lowerTitle = (windowTitle || '').toLowerCase();

    // YouTube analysis
    if (domain.includes('youtube.com')) {
      // Educational keywords
      const eduKeywords = [
        'tutorial', 'learn', 'course', 'lecture', 'class',
        'education', 'study', 'math', 'science', 'history',
        'programming', 'coding', 'development', 'algorithm',
        'physics', 'chemistry', 'biology', 'economics'
      ];

      // Entertainment keywords
      const entertainmentKeywords = [
        'vlog', 'gaming', 'reaction', 'prank', 'meme',
        'funny', 'comedy', 'music video', 'trailer',
        'highlights', 'compilation', 'tiktok'
      ];

      const hasEduKeyword = eduKeywords.some(k => 
        lowerUrl.includes(k) || lowerTitle.includes(k)
      );
      const hasEntertainmentKeyword = entertainmentKeywords.some(k => 
        lowerUrl.includes(k) || lowerTitle.includes(k)
      );

      if (hasEduKeyword && !hasEntertainmentKeyword) {
        return {
          category: 'productive',
          confidence: 0.8,
          reason: 'Educational YouTube content detected'
        };
      } else if (hasEntertainmentKeyword && !hasEduKeyword) {
        return {
          category: 'distracting',
          confidence: 0.8,
          reason: 'Entertainment YouTube content detected'
        };
      }
    }

    // Twitter/X analysis - default to distracting unless proven otherwise
    if (domain.includes('twitter.com') || domain.includes('x.com')) {
      // Educational Twitter keywords (very rare)
      const eduKeywords = ['edtech', 'academic', 'research', 'study'];
      const hasEduKeyword = eduKeywords.some(k => 
        lowerUrl.includes(k) || lowerTitle.includes(k)
      );
      
      if (hasEduKeyword) {
        return {
          category: 'neutral',
          confidence: 0.6,
          reason: 'Potentially educational Twitter/X content'
        };
      }
      
      // Default Twitter/X to distracting
      return {
        category: 'distracting',
        confidence: 0.8,
        reason: 'Twitter/X is typically used for social media'
      };
    }

    // Reddit analysis
    if (domain.includes('reddit.com')) {
      const productiveSubreddits = [
        'learnprogramming', 'askscience', 'explainlikeimfive',
        'homeworkhelp', 'languagelearning', 'getmotivated',
        'getstudying', 'apstudents', 'sat', 'cscareerquestions'
      ];

      const hasProductiveSubreddit = productiveSubreddits.some(sub => 
        lowerUrl.includes(`r/${sub}`)
      );

      if (hasProductiveSubreddit) {
        return {
          category: 'productive',
          confidence: 0.8,
          reason: 'Educational subreddit detected'
        };
      }
    }

    // Default to neutral for context-dependent sites
    return {
      category: 'neutral',
      confidence: 0.6,
      reason: `${domain} can be either productive or distracting`
    };
  }

  private static categorizeByApp(
    appName: string,
    url?: string,
    windowTitle?: string
  ): ProductivityCategory {
    const lowerApp = appName.toLowerCase();

    // Check productive apps
    if (this.productiveApps.some(app => lowerApp.includes(app.toLowerCase()))) {
      // Special handling for browsers
      if (['chrome', 'safari', 'firefox', 'edge'].some(b => lowerApp.includes(b))) {
        if (!url) {
          return {
            category: 'neutral',
            confidence: 0.5,
            reason: 'Browser activity depends on website visited'
          };
        }
        // Browser categorization handled by URL
        return {
          category: 'neutral',
          confidence: 0.5,
          reason: 'Browser categorization based on URL'
        };
      }

      return {
        category: 'productive',
        confidence: 0.85,
        reason: `${appName} is a productive application`
      };
    }

    // Check distracting apps
    if (this.distractingApps.some(app => lowerApp.includes(app.toLowerCase()))) {
      // Special cases
      if (lowerApp.includes('discord') && windowTitle?.toLowerCase().includes('study')) {
        return {
          category: 'neutral',
          confidence: 0.6,
          reason: 'Discord might be used for study groups'
        };
      }

      return {
        category: 'distracting',
        confidence: 0.85,
        reason: `${appName} is typically a distracting application`
      };
    }

    // System apps - neutral
    const systemApps = ['finder', 'dock', 'systemuiserver', 'loginwindow'];
    if (systemApps.some(app => lowerApp.includes(app))) {
      return {
        category: 'neutral',
        confidence: 1.0,
        reason: 'System application'
      };
    }

    // Unknown app
    return {
      category: 'neutral',
      confidence: 0.5,
      reason: 'Unknown application'
    };
  }

  private static async checkCustomRules(
    appName: string,
    url?: string,
    windowTitle?: string,
    userId?: string,
    organizationId?: string
  ): Promise<ProductivityCategory | null> {
    try {
      const pool = getPool();
      
      // Build query for custom rules
      let query = `
        SELECT app_name, url_pattern, window_title_pattern, category, productivity_score, subject_id
        FROM productivity_rules
        WHERE 1=1
      `;
      const params: any[] = [];
      
      if (organizationId) {
        query += ' AND organization_id = $1';
        params.push(organizationId);
      } else if (userId) {
        query += ` AND organization_id = (
          SELECT organization_id FROM users WHERE id = $1
        )`;
        params.push(userId);
      }
      
      query += ' ORDER BY priority DESC, created_at DESC';
      
      const result = await pool.query(query, params);
      
      // Check each rule
      for (const rule of result.rows) {
        let matches = false;
        let matchedPattern = '';
        
        // Check app name match
        if (rule.app_name && appName.toLowerCase().includes(rule.app_name.toLowerCase())) {
          matches = true;
          matchedPattern = rule.app_name;
        }
        
        // Check URL pattern match
        if (!matches && rule.url_pattern && url && url.toLowerCase().includes(rule.url_pattern.toLowerCase())) {
          matches = true;
          matchedPattern = rule.url_pattern;
        }
        
        // Check window title pattern match
        if (!matches && rule.window_title_pattern && windowTitle && windowTitle.toLowerCase().includes(rule.window_title_pattern.toLowerCase())) {
          matches = true;
          matchedPattern = rule.window_title_pattern;
        }
        
        if (matches) {
          // Already have category from database
          const category = rule.category as 'productive' | 'neutral' | 'distracting';
          
          return {
            category,
            confidence: 0.95, // High confidence for custom rules
            reason: `Matches organization rule: ${matchedPattern}`,
            subject: rule.subject_id ? `Subject ID: ${rule.subject_id}` : undefined
          };
        }
      }
    } catch (error) {
      logger.error('Error checking custom productivity rules:', error);
    }
    
    return null;
  }

  private static analyzeUnknownSite(
    domain: string,
    url: string,
    windowTitle?: string
  ): ProductivityCategory {
    const lowerUrl = url.toLowerCase();
    const lowerTitle = (windowTitle || '').toLowerCase();
    const lowerDomain = domain.toLowerCase();

    // Check TLD patterns
    if (lowerDomain.endsWith('.edu') || lowerDomain.endsWith('.gov')) {
      return {
        category: 'productive',
        confidence: 0.8,
        reason: 'Educational or government domain'
      };
    }

    // Gaming/entertainment domain patterns
    const gamingPatterns = ['game', 'play', 'arcade', 'flash', 'io-games'];
    if (gamingPatterns.some(p => lowerDomain.includes(p))) {
      return {
        category: 'distracting',
        confidence: 0.85,
        reason: 'Gaming website detected'
      };
    }

    // News sites - context dependent
    const newsPatterns = ['news', 'times', 'post', 'herald', 'tribune', 'journal'];
    if (newsPatterns.some(p => lowerDomain.includes(p))) {
      // Check if it's tech/science news vs general news
      const techNewsKeywords = ['tech', 'science', 'research', 'study'];
      if (techNewsKeywords.some(k => lowerTitle.includes(k))) {
        return {
          category: 'productive',
          confidence: 0.7,
          reason: 'Educational news content'
        };
      }
      return {
        category: 'neutral',
        confidence: 0.6,
        reason: 'News website - productivity depends on content'
      };
    }

    // Check URL path and title for educational keywords
    const eduPathKeywords = [
      'learn', 'tutorial', 'guide', 'course', 'lesson', 'education',
      'study', 'academic', 'research', 'science', 'math', 'physics',
      'chemistry', 'biology', 'history', 'literature', 'language'
    ];
    
    const eduMatches = eduPathKeywords.filter(k => 
      lowerUrl.includes(k) || lowerTitle.includes(k)
    ).length;

    if (eduMatches >= 2) {
      return {
        category: 'productive',
        confidence: 0.75,
        reason: 'Educational content indicators found'
      };
    }

    // Check for entertainment/distraction keywords
    const distractionKeywords = [
      'watch', 'stream', 'movie', 'show', 'series', 'episode',
      'meme', 'funny', 'lol', 'viral', 'trending', 'celebrity',
      'gossip', 'fashion', 'lifestyle', 'blog', 'vlog'
    ];

    const distractionMatches = distractionKeywords.filter(k => 
      lowerUrl.includes(k) || lowerTitle.includes(k)
    ).length;

    if (distractionMatches >= 2) {
      return {
        category: 'distracting',
        confidence: 0.75,
        reason: 'Entertainment content indicators found'
      };
    }

    // Check for shopping/commerce
    const commerceKeywords = ['shop', 'buy', 'sale', 'deal', 'discount', 'cart', 'checkout'];
    if (commerceKeywords.some(k => lowerUrl.includes(k) || lowerDomain.includes(k))) {
      return {
        category: 'distracting',
        confidence: 0.8,
        reason: 'Shopping/commerce website'
      };
    }

    // Check for productivity tools
    const toolKeywords = ['app', 'tool', 'platform', 'workspace', 'dashboard', 'analytics'];
    if (toolKeywords.some(k => lowerDomain.includes(k))) {
      return {
        category: 'neutral',
        confidence: 0.6,
        reason: 'Potential productivity tool'
      };
    }

    // True unknown - mark as neutral with low confidence
    // This allows the system to learn from user behavior
    return {
      category: 'neutral',
      confidence: 0.4,
      reason: 'Unknown website - will learn from usage patterns'
    };
  }

  private static extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }
}