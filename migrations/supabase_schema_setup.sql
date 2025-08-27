-- Supabase Schema Setup for Student Time Tracker
-- This script creates all necessary tables, indexes, RLS policies, and functions
-- Run this after setting up Supabase Auth with Google SSO

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USER MANAGEMENT
-- =====================================================

-- Extended user profile table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    google_id TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    is_student BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    parent_email TEXT,
    school_id TEXT,
    grade_level INTEGER,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_google_id ON public.users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_school_id ON public.users(school_id);

-- =====================================================
-- ACTIVITY TRACKING
-- =====================================================

-- Main activities table
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    application_name TEXT NOT NULL,
    window_title TEXT,
    url TEXT,
    category TEXT CHECK (category IN ('productive', 'neutral', 'distracting', 'uncategorized')),
    subcategory TEXT CHECK (subcategory IN (
        'school', 'research', 'creativity', 'productivity', 
        'communication', 'reading', 'health', 'gaming', 
        'scrolling', 'entertainment', NULL
    )),
    duration INTEGER NOT NULL DEFAULT 0,
    idle_time INTEGER DEFAULT 0,
    timestamp TIMESTAMPTZ NOT NULL,
    device_id TEXT,
    session_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_activities_user_timestamp ON public.activities(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activities_category ON public.activities(category);
CREATE INDEX IF NOT EXISTS idx_activities_subcategory ON public.activities(subcategory);
CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON public.activities(timestamp DESC);

-- =====================================================
-- PRODUCTIVITY METRICS
-- =====================================================

-- Daily aggregated metrics
CREATE TABLE IF NOT EXISTS public.productivity_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    productive_time INTEGER DEFAULT 0,
    neutral_time INTEGER DEFAULT 0,
    distracting_time INTEGER DEFAULT 0,
    uncategorized_time INTEGER DEFAULT 0,
    total_time INTEGER DEFAULT 0,
    productivity_score DECIMAL(5,2),
    
    -- Subcategory breakdown (stored as JSONB for flexibility)
    subcategory_times JSONB DEFAULT '{}',
    
    -- Additional metrics
    focus_sessions INTEGER DEFAULT 0,
    longest_focus_duration INTEGER DEFAULT 0,
    app_switches INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_metrics_user_date ON public.productivity_metrics(user_id, date DESC);

-- =====================================================
-- WEBSITE CATEGORIZATION
-- =====================================================

-- Global website categories (shared across all users)
CREATE TABLE IF NOT EXISTS public.website_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('productive', 'neutral', 'distracting', 'uncategorized')),
    subcategory TEXT CHECK (subcategory IN (
        'school', 'research', 'creativity', 'productivity', 
        'communication', 'reading', 'health', 'gaming', 
        'scrolling', 'entertainment', NULL
    )),
    confidence_score DECIMAL(3,2) DEFAULT 1.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    created_by UUID REFERENCES public.users(id),
    is_system BOOLEAN DEFAULT false,
    review_count INTEGER DEFAULT 0,
    last_reviewed TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_website_categories_domain ON public.website_categories(domain);

-- User-specific category overrides
CREATE TABLE IF NOT EXISTS public.user_category_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('productive', 'neutral', 'distracting', 'uncategorized')),
    subcategory TEXT CHECK (subcategory IN (
        'school', 'research', 'creativity', 'productivity', 
        'communication', 'reading', 'health', 'gaming', 
        'scrolling', 'entertainment', NULL
    )),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_user_overrides_user_domain ON public.user_category_overrides(user_id, domain);

-- =====================================================
-- AI CATEGORIZATION
-- =====================================================

-- AI categorization suggestions and history
CREATE TABLE IF NOT EXISTS public.ai_categorization_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain TEXT,
    url TEXT,
    suggested_category TEXT NOT NULL,
    suggested_subcategory TEXT,
    confidence_score DECIMAL(3,2) DEFAULT 0.5,
    model_version TEXT DEFAULT 'gpt-3.5-turbo',
    reasoning TEXT,
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES public.users(id),
    approved BOOLEAN,
    approved_by UUID REFERENCES public.users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_domain ON public.ai_categorization_suggestions(domain);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_approved ON public.ai_categorization_suggestions(approved);

-- =====================================================
-- ALERTS AND NOTIFICATIONS
-- =====================================================

-- User alerts
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'productivity_drop', 'excessive_gaming', 'focus_achievement',
        'daily_summary', 'weekly_report', 'parent_notification', 'custom'
    )),
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'info')),
    title TEXT NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user_read ON public.alerts(user_id, is_read, created_at DESC);

-- =====================================================
-- RELATIONSHIPS (Parent/Teacher/Child)
-- =====================================================

-- User relationships for parent/teacher access
CREATE TABLE IF NOT EXISTS public.user_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('parent', 'teacher', 'guardian')),
    permissions JSONB DEFAULT '{"view_activities": true, "view_reports": true, "manage_settings": false}',
    is_active BOOLEAN DEFAULT true,
    invitation_code TEXT UNIQUE,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(parent_id, child_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_relationships_parent ON public.user_relationships(parent_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_relationships_child ON public.user_relationships(child_id) WHERE is_active = true;

-- =====================================================
-- GOALS AND ACHIEVEMENTS
-- =====================================================

-- User goals
CREATE TABLE IF NOT EXISTS public.user_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT CHECK (type IN ('daily', 'weekly', 'custom')),
    target_minutes INTEGER,
    category TEXT,
    subcategory TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goal progress tracking
CREATE TABLE IF NOT EXISTS public.goal_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES public.user_goals(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    progress_minutes INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(goal_id, date)
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productivity_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_category_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_categorization_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_progress ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Activities policies
CREATE POLICY "Users can view own activities" ON public.activities
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activities" ON public.activities
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Parents can view child activities" ON public.activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_relationships
            WHERE parent_id = auth.uid()
            AND child_id = activities.user_id
            AND is_active = true
            AND (permissions->>'view_activities')::boolean = true
        )
    );

-- Productivity metrics policies
CREATE POLICY "Users can manage own metrics" ON public.productivity_metrics
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Parents can view child metrics" ON public.productivity_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_relationships
            WHERE parent_id = auth.uid()
            AND child_id = productivity_metrics.user_id
            AND is_active = true
            AND (permissions->>'view_reports')::boolean = true
        )
    );

-- Website categories policies (public read, admin write)
CREATE POLICY "Anyone can read website categories" ON public.website_categories
    FOR SELECT USING (true);

CREATE POLICY "Only admins can modify website categories" ON public.website_categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND is_admin = true
        )
    );

-- User category overrides policies
CREATE POLICY "Users manage own category overrides" ON public.user_category_overrides
    FOR ALL USING (auth.uid() = user_id);

-- AI suggestions policies
CREATE POLICY "Admins can view all AI suggestions" ON public.ai_categorization_suggestions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND is_admin = true
        )
    );

CREATE POLICY "Admins can manage AI suggestions" ON public.ai_categorization_suggestions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND is_admin = true
        )
    );

-- Alerts policies
CREATE POLICY "Users can manage own alerts" ON public.alerts
    FOR ALL USING (auth.uid() = user_id);

-- Relationships policies
CREATE POLICY "Users can view own relationships" ON public.user_relationships
    FOR SELECT USING (
        auth.uid() = parent_id OR auth.uid() = child_id
    );

CREATE POLICY "Parents can manage relationships" ON public.user_relationships
    FOR ALL USING (auth.uid() = parent_id);

-- Goals policies
CREATE POLICY "Users can manage own goals" ON public.user_goals
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own goal progress" ON public.goal_progress
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_goals
            WHERE id = goal_progress.goal_id
            AND user_id = auth.uid()
        )
    );

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to handle new auth user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            split_part(NEW.email, '@', 1)
        ),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for automatic user profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update productivity metrics
CREATE OR REPLACE FUNCTION public.update_productivity_metrics(
    p_user_id UUID,
    p_date DATE
)
RETURNS void AS $$
DECLARE
    v_productive_time INTEGER;
    v_neutral_time INTEGER;
    v_distracting_time INTEGER;
    v_uncategorized_time INTEGER;
    v_total_time INTEGER;
    v_subcategory_times JSONB;
    v_productivity_score DECIMAL(5,2);
BEGIN
    -- Calculate time by category
    SELECT 
        COALESCE(SUM(CASE WHEN category = 'productive' THEN duration ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN category = 'neutral' THEN duration ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN category = 'distracting' THEN duration ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN category = 'uncategorized' THEN duration ELSE 0 END), 0),
        COALESCE(SUM(duration), 0)
    INTO v_productive_time, v_neutral_time, v_distracting_time, v_uncategorized_time, v_total_time
    FROM public.activities
    WHERE user_id = p_user_id
    AND DATE(timestamp) = p_date;
    
    -- Calculate subcategory breakdown
    SELECT 
        COALESCE(
            jsonb_object_agg(
                subcategory, 
                total_duration
            ) FILTER (WHERE subcategory IS NOT NULL),
            '{}'::jsonb
        )
    INTO v_subcategory_times
    FROM (
        SELECT 
            subcategory,
            SUM(duration) as total_duration
        FROM public.activities
        WHERE user_id = p_user_id
        AND DATE(timestamp) = p_date
        AND subcategory IS NOT NULL
        GROUP BY subcategory
    ) sub;
    
    -- Calculate productivity score
    IF v_total_time > 0 THEN
        v_productivity_score := ROUND(
            ((v_productive_time::DECIMAL - v_distracting_time::DECIMAL) / v_total_time::DECIMAL * 100)::DECIMAL,
            2
        );
        -- Clamp between 0 and 100
        v_productivity_score := GREATEST(0, LEAST(100, v_productivity_score));
    ELSE
        v_productivity_score := 0;
    END IF;
    
    -- Upsert metrics
    INSERT INTO public.productivity_metrics (
        user_id,
        date,
        productive_time,
        neutral_time,
        distracting_time,
        uncategorized_time,
        total_time,
        subcategory_times,
        productivity_score
    ) VALUES (
        p_user_id,
        p_date,
        v_productive_time,
        v_neutral_time,
        v_distracting_time,
        v_uncategorized_time,
        v_total_time,
        v_subcategory_times,
        v_productivity_score
    )
    ON CONFLICT (user_id, date) DO UPDATE SET
        productive_time = EXCLUDED.productive_time,
        neutral_time = EXCLUDED.neutral_time,
        distracting_time = EXCLUDED.distracting_time,
        uncategorized_time = EXCLUDED.uncategorized_time,
        total_time = EXCLUDED.total_time,
        subcategory_times = EXCLUDED.subcategory_times,
        productivity_score = EXCLUDED.productivity_score,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and create alerts
CREATE OR REPLACE FUNCTION public.check_productivity_alerts(
    p_user_id UUID,
    p_date DATE
)
RETURNS void AS $$
DECLARE
    v_productivity_score DECIMAL(5,2);
    v_gaming_time INTEGER;
    v_yesterday_score DECIMAL(5,2);
BEGIN
    -- Get today's productivity score
    SELECT productivity_score 
    INTO v_productivity_score
    FROM public.productivity_metrics
    WHERE user_id = p_user_id AND date = p_date;
    
    -- Get yesterday's score for comparison
    SELECT productivity_score 
    INTO v_yesterday_score
    FROM public.productivity_metrics
    WHERE user_id = p_user_id AND date = p_date - INTERVAL '1 day';
    
    -- Get gaming time from subcategory
    SELECT (subcategory_times->>'gaming')::INTEGER
    INTO v_gaming_time
    FROM public.productivity_metrics
    WHERE user_id = p_user_id AND date = p_date;
    
    -- Check for low productivity
    IF v_productivity_score < 50 AND v_productivity_score IS NOT NULL THEN
        INSERT INTO public.alerts (
            user_id,
            type,
            severity,
            title,
            message,
            data
        ) VALUES (
            p_user_id,
            'productivity_drop',
            'medium',
            'Low Productivity Alert',
            'Your productivity score today is ' || v_productivity_score || '%. Try focusing on productive tasks!',
            jsonb_build_object(
                'score', v_productivity_score,
                'date', p_date
            )
        );
    END IF;
    
    -- Check for excessive gaming (more than 2 hours)
    IF v_gaming_time > 7200 THEN
        INSERT INTO public.alerts (
            user_id,
            type,
            severity,
            title,
            message,
            data
        ) VALUES (
            p_user_id,
            'excessive_gaming',
            'high',
            'Gaming Time Alert',
            'You''ve spent ' || (v_gaming_time / 3600) || ' hours gaming today. Time for a break!',
            jsonb_build_object(
                'gaming_time', v_gaming_time,
                'date', p_date
            )
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Insert default system website categories
INSERT INTO public.website_categories (domain, category, subcategory, confidence_score, is_system) VALUES
    -- School & Research
    ('google.com/classroom', 'productive', 'school', 1.0, true),
    ('docs.google.com', 'productive', 'school', 0.9, true),
    ('wikipedia.org', 'productive', 'research', 0.9, true),
    ('khanacademy.org', 'productive', 'school', 1.0, true),
    ('scholar.google.com', 'productive', 'research', 1.0, true),
    
    -- Productivity
    ('notion.so', 'productive', 'productivity', 0.9, true),
    ('todoist.com', 'productive', 'productivity', 1.0, true),
    ('github.com', 'productive', 'productivity', 0.8, true),
    
    -- Communication
    ('gmail.com', 'neutral', 'communication', 0.8, true),
    ('slack.com', 'neutral', 'communication', 0.8, true),
    ('discord.com', 'neutral', 'communication', 0.7, true),
    
    -- Entertainment
    ('youtube.com', 'distracting', 'entertainment', 0.8, true),
    ('netflix.com', 'distracting', 'entertainment', 1.0, true),
    ('twitch.tv', 'distracting', 'entertainment', 1.0, true),
    
    -- Gaming
    ('roblox.com', 'distracting', 'gaming', 1.0, true),
    ('minecraft.net', 'distracting', 'gaming', 1.0, true),
    ('coolmathgames.com', 'distracting', 'gaming', 0.9, true),
    
    -- Social Media
    ('instagram.com', 'distracting', 'scrolling', 1.0, true),
    ('tiktok.com', 'distracting', 'scrolling', 1.0, true),
    ('reddit.com', 'distracting', 'scrolling', 0.9, true),
    
    -- Reading
    ('medium.com', 'productive', 'reading', 0.8, true),
    ('arxiv.org', 'productive', 'reading', 1.0, true),
    
    -- Health
    ('myfitnesspal.com', 'productive', 'health', 1.0, true),
    ('headspace.com', 'productive', 'health', 1.0, true)
ON CONFLICT (domain) DO NOTHING;

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;