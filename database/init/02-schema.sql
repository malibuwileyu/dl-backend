-- Organizations (Schools)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role user_role NOT NULL,
    grade_level INTEGER,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Devices
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_identifier VARCHAR(255) UNIQUE NOT NULL,
    platform platform_type NOT NULL,
    device_name VARCHAR(255),
    os_version VARCHAR(50),
    app_version VARCHAR(50),
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity Sessions (will be converted to TimescaleDB hypertable)
CREATE TABLE activity_sessions (
    id UUID DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    app_bundle_id VARCHAR(255),
    app_name VARCHAR(255),
    window_title TEXT,
    url TEXT,
    category VARCHAR(50),
    productivity_score FLOAT CHECK (productivity_score >= 0 AND productivity_score <= 1),
    subject VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    PRIMARY KEY (id, start_time)
);

-- Convert to hypertable
SELECT create_hypertable('activity_sessions', 'start_time');

-- Applications catalog
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50),
    default_productivity_score FLOAT DEFAULT 0.5 CHECK (default_productivity_score >= 0 AND default_productivity_score <= 1),
    platform platform_type,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Websites catalog
CREATE TABLE websites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(50),
    default_productivity_score FLOAT DEFAULT 0.5 CHECK (default_productivity_score >= 0 AND default_productivity_score <= 1),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Custom productivity rules
CREATE TABLE productivity_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    rule_type rule_type NOT NULL,
    pattern VARCHAR(255) NOT NULL,
    category VARCHAR(50),
    productivity_score FLOAT CHECK (productivity_score >= 0 AND productivity_score <= 1),
    subject VARCHAR(50),
    priority INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alerts
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    severity alert_severity NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Academic subjects
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7),
    icon VARCHAR(50),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

-- Class schedules
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Refresh tokens for JWT
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_activity_sessions_user_time ON activity_sessions(user_id, start_time DESC);
CREATE INDEX idx_activity_sessions_device_time ON activity_sessions(device_id, start_time DESC);
CREATE INDEX idx_activity_sessions_category ON activity_sessions(category, start_time DESC);
CREATE INDEX idx_activity_sessions_subject ON activity_sessions(subject, start_time DESC);
CREATE INDEX idx_alerts_user_created ON alerts(user_id, created_at DESC);
CREATE INDEX idx_alerts_unacknowledged ON alerts(acknowledged, created_at DESC) WHERE acknowledged = false;
CREATE INDEX idx_devices_user ON devices(user_id);
CREATE INDEX idx_productivity_rules_org ON productivity_rules(organization_id, active);
CREATE INDEX idx_schedules_user ON schedules(user_id, day_of_week);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- Create update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to tables with updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_websites_updated_at BEFORE UPDATE ON websites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_productivity_rules_updated_at BEFORE UPDATE ON productivity_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();