-- This migration fixes the schema mismatch between UUID and INTEGER subject IDs
-- The original subjects table used UUIDs but newer tables expect integers

-- First, check if the subjects table exists with UUID columns
DO $$
BEGIN
    -- Only proceed if subjects table exists and has UUID id column
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'subjects' 
        AND column_name = 'id' 
        AND data_type = 'uuid'
    ) THEN
        -- Drop dependent tables that reference the UUID subjects
        DROP TABLE IF EXISTS subject_activities CASCADE;
        DROP TABLE IF EXISTS subject_detection_rules CASCADE;
        DROP TABLE IF EXISTS current_subject_selections CASCADE;
        DROP TABLE IF EXISTS student_schedules CASCADE;
        
        -- Drop the old subjects table
        DROP TABLE IF EXISTS subjects CASCADE;
    END IF;
END $$;

-- Create subjects table with integer ID
CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7), -- Hex color for UI display
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Student schedules - what subject they should be working on at specific times
CREATE TABLE IF NOT EXISTS student_schedules (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL REFERENCES subjects(id),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (end_time > start_time),
    CONSTRAINT unique_schedule_slot UNIQUE (student_id, day_of_week, start_time)
);

-- Current subject selection - what the student says they're working on now
CREATE TABLE IF NOT EXISTS current_subject_selections (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL REFERENCES subjects(id),
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP,
    device_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Subject detection rules - URLs and keywords for auto-detection
CREATE TABLE IF NOT EXISTS subject_detection_rules (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER NOT NULL REFERENCES subjects(id),
    rule_type VARCHAR(20) NOT NULL CHECK (rule_type IN ('domain', 'keyword', 'app')),
    pattern VARCHAR(255) NOT NULL,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Insert default subjects
INSERT INTO subjects (name, color, description) VALUES
    ('Mathematics', '#2196F3', 'Math, Algebra, Geometry, Calculus'),
    ('Science', '#4CAF50', 'Biology, Chemistry, Physics'),
    ('English', '#FF9800', 'Literature, Writing, Grammar'),
    ('History', '#9C27B0', 'World History, US History, Social Studies'),
    ('Computer Science', '#00BCD4', 'Programming, Computer Skills'),
    ('Foreign Language', '#F44336', 'Spanish, French, Other Languages'),
    ('Art', '#E91E63', 'Visual Arts, Music, Theater'),
    ('Physical Education', '#8BC34A', 'Sports, Health, Fitness'),
    ('Study Hall', '#607D8B', 'General Study Time'),
    ('Break/Free Time', '#FFC107', 'Scheduled breaks')
ON CONFLICT (name) DO NOTHING;

-- Insert some default detection rules
INSERT INTO subject_detection_rules (subject_id, rule_type, pattern, priority) VALUES
    ((SELECT id FROM subjects WHERE name = 'Mathematics'), 'domain', 'khanacademy.org/math', 10),
    ((SELECT id FROM subjects WHERE name = 'Mathematics'), 'domain', 'mathway.com', 10),
    ((SELECT id FROM subjects WHERE name = 'Mathematics'), 'domain', 'wolframalpha.com', 10),
    ((SELECT id FROM subjects WHERE name = 'Mathematics'), 'domain', 'desmos.com', 10),
    ((SELECT id FROM subjects WHERE name = 'Mathematics'), 'keyword', 'algebra', 5),
    ((SELECT id FROM subjects WHERE name = 'Mathematics'), 'keyword', 'calculus', 5),
    ((SELECT id FROM subjects WHERE name = 'Mathematics'), 'app', 'Calculator', 8),
    ((SELECT id FROM subjects WHERE name = 'Science'), 'domain', 'khanacademy.org/science', 10),
    ((SELECT id FROM subjects WHERE name = 'Science'), 'domain', 'phet.colorado.edu', 10),
    ((SELECT id FROM subjects WHERE name = 'Science'), 'keyword', 'biology', 5),
    ((SELECT id FROM subjects WHERE name = 'Science'), 'keyword', 'chemistry', 5),
    ((SELECT id FROM subjects WHERE name = 'Science'), 'keyword', 'physics', 5),
    ((SELECT id FROM subjects WHERE name = 'English'), 'domain', 'docs.google.com', 8),
    ((SELECT id FROM subjects WHERE name = 'English'), 'domain', 'grammarly.com', 10),
    ((SELECT id FROM subjects WHERE name = 'English'), 'domain', 'turnitin.com', 10),
    ((SELECT id FROM subjects WHERE name = 'English'), 'app', 'Microsoft Word', 9),
    ((SELECT id FROM subjects WHERE name = 'English'), 'app', 'Pages', 9),
    ((SELECT id FROM subjects WHERE name = 'Computer Science'), 'domain', 'github.com', 10),
    ((SELECT id FROM subjects WHERE name = 'Computer Science'), 'domain', 'stackoverflow.com', 10),
    ((SELECT id FROM subjects WHERE name = 'Computer Science'), 'domain', 'replit.com', 10),
    ((SELECT id FROM subjects WHERE name = 'Computer Science'), 'app', 'Visual Studio Code', 10),
    ((SELECT id FROM subjects WHERE name = 'Computer Science'), 'app', 'Xcode', 10)
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_schedules_lookup ON student_schedules(student_id, day_of_week, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_current_selections_active ON current_subject_selections(student_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subject_activities_student ON subject_activities(user_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_detection_rules_lookup ON subject_detection_rules(rule_type, pattern);
CREATE INDEX IF NOT EXISTS idx_detection_rules_priority ON subject_detection_rules(priority DESC);