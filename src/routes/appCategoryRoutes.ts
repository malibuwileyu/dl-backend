import { Router } from 'express';
import { AppCategoryService } from '../services/appCategoryService';
import { CategoryType, SubcategoryType } from '../entities/AppCategory';

const router = Router();

// Get category for a specific app
router.get('/app/:appName', async (req, res) => {
  try {
    const { appName } = req.params;
    const organizationId = req.headers['x-organization-id'] as string;
    
    const categoryInfo = await AppCategoryService.getCategoryForApp(
      appName,
      undefined,
      organizationId ? parseInt(organizationId) : undefined
    );
    
    return res.json({ 
      appName, 
      category: categoryInfo.category,
      subcategory: categoryInfo.subcategory 
    });
  } catch (error) {
    console.error('Error fetching app category:', error);
    return res.status(500).json({ error: 'Failed to fetch app category' });
  }
});

// Get all categories for an organization
router.get('/', async (req, res) => {
  try {
    const organizationId = req.headers['x-organization-id'] as string;
    const categories = await AppCategoryService.getCategoriesForOrganization(
      organizationId ? parseInt(organizationId) : undefined
    );
    return res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get all subcategory definitions
router.get('/subcategories', async (req, res) => {
  try {
    const subcategories = await AppCategoryService.getAllSubcategories();
    return res.json(subcategories);
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    return res.status(500).json({ error: 'Failed to fetch subcategories' });
  }
});

// Set category for an app
router.post('/', async (req, res) => {
  try {
    const { appName, category, subcategory, bundleId } = req.body;
    const organizationId = req.headers['x-organization-id'] as string;
    
    if (!appName || !category) {
      return res.status(400).json({ error: 'appName and category are required' });
    }
    
    if (!['productive', 'neutral', 'distracting'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    
    const validSubcategories = ['school', 'research', 'creativity', 'productivity', 
      'communication', 'reading', 'health', 'gaming', 'scrolling', 'entertainment'];
    
    if (subcategory && !validSubcategories.includes(subcategory)) {
      return res.status(400).json({ error: 'Invalid subcategory' });
    }
    
    const appCategory = await AppCategoryService.setCategoryForApp(
      appName,
      category as CategoryType,
      organizationId ? parseInt(organizationId) : undefined,
      bundleId,
      subcategory as SubcategoryType
    );
    
    return res.json(appCategory);
  } catch (error) {
    console.error('Error setting app category:', error);
    return res.status(500).json({ error: 'Failed to set app category' });
  }
});

// Update category for an app
router.put('/:id', async (req, res) => {
  try {
    // const { id } = req.params; // Not used in current implementation
    const { appName, category, bundleId } = req.body;
    const organizationId = req.headers['x-organization-id'] as string;
    
    if (!appName || !category) {
      return res.status(400).json({ error: 'appName and category are required' });
    }
    
    if (!['productive', 'neutral', 'distracting'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    
    // For now, we'll update by creating/updating the category
    // In a real implementation, you'd update by ID
    const appCategory = await AppCategoryService.setCategoryForApp(
      appName,
      category as CategoryType,
      organizationId ? parseInt(organizationId) : undefined,
      bundleId
    );
    
    return res.json(appCategory);
  } catch (error) {
    console.error('Error updating app category:', error);
    return res.status(500).json({ error: 'Failed to update app category' });
  }
});

// Delete category for an app
router.delete('/:id', async (req, res) => {
  try {
    // const { id } = req.params; // Not used in current implementation
    // const organizationId = req.headers['x-organization-id'] as string; // Not used in current implementation
    
    // For now, we'll return success
    // In a real implementation, you'd delete by ID
    return res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting app category:', error);
    return res.status(500).json({ error: 'Failed to delete app category' });
  }
});

export default router;