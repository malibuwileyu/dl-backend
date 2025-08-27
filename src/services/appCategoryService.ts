import { AppDataSource } from '../config/database';
import { AppCategory, CategoryType, SubcategoryType } from '../entities/AppCategory';
import { SubcategoryDefinition } from '../entities/SubcategoryDefinition';

interface CategoryInfo {
  category: CategoryType;
  subcategory?: SubcategoryType;
}

export class AppCategoryService {
  private static categoryRepo = AppDataSource.getRepository(AppCategory);
  private static subcategoryRepo = AppDataSource.getRepository(SubcategoryDefinition);
  private static cache = new Map<string, CategoryInfo>();
  private static cacheExpiry: Date | null = null;
  private static CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get category for an app by name or bundle ID
   */
  static async getCategoryForApp(
    appName: string,
    bundleId?: string,
    organizationId?: number
  ): Promise<CategoryInfo> {
    // Check cache first
    const cacheKey = `${appName}-${organizationId || 'global'}`;
    if (this.cache.has(cacheKey) && this.cacheExpiry && this.cacheExpiry > new Date()) {
      return this.cache.get(cacheKey)!;
    }

    try {
      let category: AppCategory | null = null;

      // First, try to find organization-specific category
      if (organizationId) {
        category = await this.categoryRepo.findOne({
          where: [
            { app_name: appName, organization_id: organizationId },
            bundleId ? { bundle_id: bundleId, organization_id: organizationId } : null,
          ].filter(Boolean) as any,
        });
      }

      // If not found, try global category
      if (!category) {
        category = await this.categoryRepo.findOne({
          where: [
            { app_name: appName, is_global: true },
            bundleId ? { bundle_id: bundleId, is_global: true } : null,
          ].filter(Boolean) as any,
        });
      }

      // If still not found, try to determine subcategory from app name
      let result: CategoryInfo;
      if (category) {
        result = {
          category: category.category,
          subcategory: category.subcategory
        };
      } else {
        // Auto-determine subcategory based on app name
        const subcategory = await this.determineSubcategoryFromAppName(appName);
        result = {
          category: subcategory ? await this.getParentCategory(subcategory) : 'neutral',
          subcategory
        };
      }
      
      // Update cache
      this.cache.set(cacheKey, result);
      if (!this.cacheExpiry || this.cacheExpiry < new Date()) {
        this.cacheExpiry = new Date(Date.now() + this.CACHE_DURATION);
      }

      return result;
    } catch (error) {
      console.error('Error getting app category:', error);
      return { category: 'neutral' };
    }
  }

  /**
   * Set category for an app
   */
  static async setCategoryForApp(
    appName: string,
    category: CategoryType,
    organizationId?: number,
    bundleId?: string,
    subcategory?: SubcategoryType
  ): Promise<AppCategory> {
    try {
      // Check if category already exists
      let existingCategory = await this.categoryRepo.findOne({
        where: {
          app_name: appName,
          organization_id: organizationId || undefined,
        },
      });

      if (existingCategory) {
        // Update existing
        existingCategory.category = category;
        existingCategory.subcategory = subcategory;
        if (bundleId) existingCategory.bundle_id = bundleId;
        return await this.categoryRepo.save(existingCategory);
      } else {
        // Create new
        const newCategory = this.categoryRepo.create({
          app_name: appName,
          category,
          subcategory,
          bundle_id: bundleId,
          organization_id: organizationId,
          is_global: !organizationId,
        });
        return await this.categoryRepo.save(newCategory);
      }
    } finally {
      // Clear cache for this app
      const cacheKey = `${appName}-${organizationId || 'global'}`;
      this.cache.delete(cacheKey);
    }
  }

  /**
   * Get all categories for an organization (including global)
   */
  static async getCategoriesForOrganization(
    organizationId?: number
  ): Promise<AppCategory[]> {
    const where: any = [];
    
    // Always include global categories
    where.push({ is_global: true });
    
    // Include organization-specific if provided
    if (organizationId) {
      where.push({ organization_id: organizationId });
    }

    return await this.categoryRepo.find({
      where,
      order: {
        app_name: 'ASC',
      },
    });
  }

  /**
   * Delete a category
   */
  static async deleteCategory(id: number): Promise<void> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (category) {
      await this.categoryRepo.delete(id);
      // Clear cache
      const cacheKey = `${category.app_name}-${category.organization_id || 'global'}`;
      this.cache.delete(cacheKey);
    }
  }

  /**
   * Clear the cache
   */
  static clearCache(): void {
    this.cache.clear();
    this.cacheExpiry = null;
  }

  /**
   * Determine subcategory from app name using heuristics
   */
  private static async determineSubcategoryFromAppName(appName: string): Promise<SubcategoryType | undefined> {
    const lowerName = appName.toLowerCase();

    // School & Education apps
    if (lowerName.includes('school') || lowerName.includes('classroom') || 
        lowerName.includes('homework') || lowerName.includes('study') ||
        lowerName.includes('khan') || lowerName.includes('duolingo') ||
        lowerName.includes('coursera') || lowerName.includes('udemy')) {
      return 'school';
    }

    // Research apps
    if (lowerName.includes('wikipedia') || lowerName.includes('scholar') ||
        lowerName.includes('research') || lowerName.includes('pubmed') ||
        lowerName.includes('jstor') || lowerName === 'safari' || 
        lowerName === 'chrome' || lowerName === 'firefox') {
      return 'research';
    }

    // Creativity apps
    if (lowerName.includes('photoshop') || lowerName.includes('illustrator') ||
        lowerName.includes('garageband') || lowerName.includes('imovie') ||
        lowerName.includes('procreate') || lowerName.includes('sketch') ||
        lowerName.includes('figma') || lowerName.includes('canva')) {
      return 'creativity';
    }

    // Productivity apps
    if (lowerName.includes('notion') || lowerName.includes('todoist') ||
        lowerName.includes('calendar') || lowerName.includes('reminders') ||
        lowerName.includes('notes') || lowerName.includes('evernote') ||
        lowerName.includes('trello') || lowerName.includes('asana')) {
      return 'productivity';
    }

    // Communication apps
    if (lowerName.includes('messages') || lowerName.includes('mail') ||
        lowerName.includes('slack') || lowerName.includes('teams') ||
        lowerName.includes('zoom') || lowerName.includes('facetime') ||
        lowerName.includes('whatsapp') || lowerName.includes('discord')) {
      return 'communication';
    }

    // Reading apps
    if (lowerName.includes('kindle') || lowerName.includes('books') ||
        lowerName.includes('news') || lowerName.includes('reader') ||
        lowerName.includes('medium') || lowerName.includes('pocket')) {
      return 'reading';
    }

    // Health & Fitness apps
    if (lowerName.includes('fitness') || lowerName.includes('health') ||
        lowerName.includes('meditation') || lowerName.includes('calm') ||
        lowerName.includes('headspace') || lowerName.includes('strava') ||
        lowerName.includes('workout')) {
      return 'health';
    }

    // Gaming apps
    if (lowerName.includes('game') || lowerName.includes('minecraft') ||
        lowerName.includes('roblox') || lowerName.includes('fortnite') ||
        lowerName.includes('pokemon') || lowerName.includes('clash') ||
        lowerName.includes('candy crush') || lowerName.includes('steam')) {
      return 'gaming';
    }

    // Social Media / Scrolling apps
    if (lowerName.includes('instagram') || lowerName.includes('facebook') ||
        lowerName.includes('twitter') || lowerName.includes('tiktok') ||
        lowerName.includes('snapchat') || lowerName.includes('reddit') ||
        lowerName.includes('pinterest') || lowerName.includes('tumblr')) {
      return 'scrolling';
    }

    // Entertainment apps
    if (lowerName.includes('youtube') || lowerName.includes('netflix') ||
        lowerName.includes('disney') || lowerName.includes('hulu') ||
        lowerName.includes('spotify') || lowerName.includes('music') ||
        lowerName.includes('twitch') || lowerName.includes('hbo')) {
      return 'entertainment';
    }

    return undefined;
  }

  /**
   * Get parent category for a subcategory
   */
  private static async getParentCategory(subcategory: SubcategoryType): Promise<CategoryType> {
    const subcategoryDef = await this.subcategoryRepo.findOne({
      where: { name: subcategory }
    });
    return subcategoryDef?.parent_category || 'neutral';
  }

  /**
   * Get all subcategory definitions
   */
  static async getAllSubcategories(): Promise<SubcategoryDefinition[]> {
    return await this.subcategoryRepo.find({
      order: { sort_order: 'ASC' }
    });
  }
}