-- Migration to add subcategory system to app_categories and activities
-- This adds subcategories as a refinement of the existing category system

-- First, add subcategory to app_categories table
ALTER TABLE app_categories 
ADD COLUMN subcategory VARCHAR(50);

-- Add index for better query performance
CREATE INDEX idx_app_categories_subcategory ON app_categories(subcategory);

-- Update existing app_categories with default subcategories based on current categories
UPDATE app_categories 
SET subcategory = CASE 
    WHEN category = 'productive' THEN 'productivity'
    WHEN category = 'neutral' THEN 'communication'
    WHEN category = 'distracting' THEN 'entertainment'
    ELSE NULL
END
WHERE subcategory IS NULL;

-- Create a subcategory reference table for consistency
CREATE TABLE IF NOT EXISTS subcategory_definitions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    parent_category VARCHAR(20) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    color_hex VARCHAR(7),
    icon_name VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert the 10 predefined subcategories
INSERT INTO subcategory_definitions (name, parent_category, display_name, description, color_hex, icon_name, sort_order) VALUES
-- Productive subcategories
('school', 'productive', 'School', 'Educational apps and learning platforms', '#4ADE80', 'book.fill', 1),
('research', 'productive', 'Research', 'Browsers and tools used for academic research', '#22C55E', 'magnifyingglass', 2),
('creativity', 'productive', 'Creativity', 'Art, music, video editing, and creative tools', '#10B981', 'paintbrush.fill', 3),
('productivity', 'productive', 'Productivity', 'Task managers, calendars, and organization tools', '#059669', 'checkmark.circle.fill', 4),
-- Neutral subcategories
('communication', 'neutral', 'Communication', 'Messaging, email, and video calls', '#94A3B8', 'message.fill', 5),
('reading', 'neutral', 'Reading', 'News, e-readers, and general browsing', '#64748B', 'book.closed.fill', 6),
('health', 'neutral', 'Health & Fitness', 'Meditation, workout, and health tracking apps', '#475569', 'heart.fill', 7),
-- Distracting subcategories
('gaming', 'distracting', 'Gaming', 'All game applications', '#A855F7', 'gamecontroller.fill', 8),
('scrolling', 'distracting', 'Scrolling', 'Social media apps like Instagram, TikTok, Reddit', '#EC4899', 'scroll.fill', 9),
('entertainment', 'distracting', 'Entertainment', 'YouTube, Netflix, and streaming services', '#6366F1', 'tv.fill', 10);

-- Add foreign key constraint to ensure subcategory validity
ALTER TABLE app_categories
ADD CONSTRAINT fk_app_categories_subcategory
FOREIGN KEY (subcategory) REFERENCES subcategory_definitions(name)
ON UPDATE CASCADE;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for subcategory_definitions
CREATE TRIGGER update_subcategory_definitions_updated_at BEFORE UPDATE
ON subcategory_definitions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();