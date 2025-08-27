import { Router } from 'express';
import { WebsiteCategoryService } from '../services/websiteCategoryService';

const router = Router();

// Get all website categories
router.get('/', async (req, res) => {
  try {
    const organizationId = req.headers['x-organization-id'] as string;
    
    const categories = await WebsiteCategoryService.getCategories(
      organizationId ? parseInt(organizationId) : undefined
    );
    
    return res.json(categories);
  } catch (error) {
    console.error('Error fetching website categories:', error);
    return res.status(500).json({ error: 'Failed to fetch website categories' });
  }
});

// Create new website category
router.post('/', async (req, res) => {
  try {
    const { pattern, category, subcategory, name, description } = req.body;
    const organizationId = req.headers['x-organization-id'] as string;
    
    if (!pattern || !category) {
      return res.status(400).json({ error: 'pattern and category are required' });
    }
    
    if (!['productive', 'neutral', 'distracting'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    
    const websiteCategory = await WebsiteCategoryService.createCategory({
      pattern,
      category,
      subcategory,
      name,
      description,
      organization_id: organizationId ? parseInt(organizationId) : undefined
    });
    
    return res.json(websiteCategory);
  } catch (error) {
    console.error('Error creating website category:', error);
    return res.status(500).json({ error: 'Failed to create website category' });
  }
});

// Update website category
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { pattern, category, subcategory, name, description } = req.body;
    
    if (!pattern || !category) {
      return res.status(400).json({ error: 'pattern and category are required' });
    }
    
    if (!['productive', 'neutral', 'distracting'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    
    const websiteCategory = await WebsiteCategoryService.updateCategory(parseInt(id), {
      pattern,
      category,
      subcategory,
      name,
      description
    });
    
    return res.json(websiteCategory);
  } catch (error) {
    console.error('Error updating website category:', error);
    return res.status(500).json({ error: 'Failed to update website category' });
  }
});

// Delete website category
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await WebsiteCategoryService.deleteCategory(parseInt(id));
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting website category:', error);
    return res.status(500).json({ error: 'Failed to delete website category' });
  }
});

export default router;