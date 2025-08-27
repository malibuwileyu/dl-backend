-- Create productivity_rules table without foreign keys
CREATE TABLE IF NOT EXISTS productivity_rules (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER,
    app_name VARCHAR(255),
    url_pattern VARCHAR(500),
    window_title_pattern VARCHAR(500),
    category VARCHAR(50) NOT NULL CHECK (category IN ('productive', 'neutral', 'distracting')),
    productivity_score INTEGER DEFAULT 50 CHECK (productivity_score >= 0 AND productivity_score <= 100),
    subject_id INTEGER,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_productivity_rules_organization ON productivity_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_productivity_rules_app_name ON productivity_rules(app_name);
CREATE INDEX IF NOT EXISTS idx_productivity_rules_category ON productivity_rules(category);

-- Add missing columns to activities table
DO $$ 
BEGIN
    -- Add category column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'activities' AND column_name = 'category'
    ) THEN
        ALTER TABLE activities ADD COLUMN category VARCHAR(50);
    END IF;
    
    -- Add productivity_score column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'activities' AND column_name = 'productivity_score'
    ) THEN
        ALTER TABLE activities ADD COLUMN productivity_score INTEGER;
    END IF;
    
    -- Add app_bundle_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'activities' AND column_name = 'app_bundle_id'
    ) THEN
        ALTER TABLE activities ADD COLUMN app_bundle_id VARCHAR(255);
    END IF;
    
    -- Add subject column (text, not id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'activities' AND column_name = 'subject'
    ) THEN
        ALTER TABLE activities ADD COLUMN subject VARCHAR(100);
    END IF;
END $$;