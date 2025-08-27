-- Create productivity_rules table
CREATE TABLE IF NOT EXISTS productivity_rules (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER,
    app_name VARCHAR(255),
    url_pattern VARCHAR(500),
    window_title_pattern VARCHAR(500),
    category VARCHAR(50) NOT NULL CHECK (category IN ('productive', 'neutral', 'distracting')),
    productivity_score INTEGER DEFAULT 50 CHECK (productivity_score >= 0 AND productivity_score <= 100),
    subject_id INTEGER REFERENCES subjects(id),
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_productivity_rules_organization ON productivity_rules(organization_id);
CREATE INDEX idx_productivity_rules_app_name ON productivity_rules(app_name);
CREATE INDEX idx_productivity_rules_category ON productivity_rules(category);

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    message TEXT NOT NULL,
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);
CREATE INDEX idx_alerts_acknowledged ON alerts(acknowledged_at);

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add organization_id foreign key to users if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE users ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
    END IF;
END $$;

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