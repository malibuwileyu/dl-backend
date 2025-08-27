import { getPool } from '../config/database';
import { logger } from '../config/logger';

export interface WebsiteCategory {
  id?: number;
  pattern: string;
  category: string;
  subcategory?: string;
  name?: string;
  description?: string;
  organization_id?: number;
  is_system?: boolean;
  priority?: number;
  created_at?: Date;
  updated_at?: Date;
}

export class WebsiteCategoryService {
  static async getCategories(organizationId?: number): Promise<WebsiteCategory[]> {
    try {
      let query = `
        SELECT 
          id, pattern, category, subcategory, name, description,
          organization_id, is_system, priority,
          created_at, updated_at
        FROM website_categories
      `;
      
      const params: any[] = [];
      const conditions: string[] = [];
      
      if (organizationId) {
        conditions.push('(organization_id = $1 OR organization_id IS NULL)');
        params.push(organizationId);
      }
      
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      query += ' ORDER BY priority DESC, pattern ASC';
      
      const result = await getPool().query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching website categories:', error);
      throw error;
    }
  }
  
  static async createCategory(data: {
    pattern: string;
    category: string;
    subcategory?: string;
    name?: string;
    description?: string;
    organization_id?: number;
  }): Promise<WebsiteCategory> {
    try {
      const result = await getPool().query(`
        INSERT INTO website_categories (
          pattern, category, subcategory, name, description, organization_id, is_system, priority
        ) VALUES ($1, $2, $3, $4, $5, $6, false, 0)
        RETURNING *
      `, [
        data.pattern,
        data.category,
        data.subcategory || null,
        data.name || null,
        data.description || null,
        data.organization_id || null
      ]);
      
      logger.info(`Website category created: ${data.pattern} -> ${data.category}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating website category:', error);
      throw error;
    }
  }
  
  static async updateCategory(id: number, data: {
    pattern?: string;
    category?: string;
    subcategory?: string;
    name?: string;
    description?: string;
  }): Promise<WebsiteCategory> {
    try {
      const updateFields = [];
      const values = [];
      let paramCount = 1;
      
      if (data.pattern !== undefined) {
        updateFields.push(`pattern = $${paramCount}`);
        values.push(data.pattern);
        paramCount++;
      }
      
      if (data.category !== undefined) {
        updateFields.push(`category = $${paramCount}`);
        values.push(data.category);
        paramCount++;
      }
      
      if (data.subcategory !== undefined) {
        updateFields.push(`subcategory = $${paramCount}`);
        values.push(data.subcategory);
        paramCount++;
      }
      
      if (data.name !== undefined) {
        updateFields.push(`name = $${paramCount}`);
        values.push(data.name);
        paramCount++;
      }
      
      if (data.description !== undefined) {
        updateFields.push(`description = $${paramCount}`);
        values.push(data.description);
        paramCount++;
      }
      
      updateFields.push(`updated_at = NOW()`);
      values.push(id);
      
      const result = await getPool().query(`
        UPDATE website_categories
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `, values);
      
      if (result.rows.length === 0) {
        throw new Error('Website category not found');
      }
      
      logger.info(`Website category updated: ${id}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating website category:', error);
      throw error;
    }
  }
  
  static async deleteCategory(id: number): Promise<void> {
    try {
      const result = await getPool().query(
        'DELETE FROM website_categories WHERE id = $1 AND is_system = false RETURNING id',
        [id]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Website category not found or is a system category');
      }
      
      logger.info(`Website category deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting website category:', error);
      throw error;
    }
  }
}