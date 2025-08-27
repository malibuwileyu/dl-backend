-- Create table for categorization suggestions from learning service
CREATE TABLE IF NOT EXISTS categorization_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern VARCHAR(255) NOT NULL,
    current_category VARCHAR(50),
    suggested_category VARCHAR(50) NOT NULL,
    current_score DECIMAL(3,2),
    suggested_score DECIMAL(3,2) NOT NULL,
    confidence DECIMAL(3,2) NOT NULL,
    evidence JSONB,
    organization_id UUID REFERENCES organizations(id),
    status VARCHAR(20) DEFAULT 'pending', -- pending, applied, rejected
    applied_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(pattern, organization_id)
);

-- Index for quick lookup
CREATE INDEX idx_suggestions_status ON categorization_suggestions(status);
CREATE INDEX idx_suggestions_org ON categorization_suggestions(organization_id);

-- Add a column to track if activities were auto-categorized or rule-based
ALTER TABLE activities ADD COLUMN IF NOT EXISTS categorization_method VARCHAR(20) DEFAULT 'auto';
-- Values: 'auto', 'rule', 'manual', 'ai'