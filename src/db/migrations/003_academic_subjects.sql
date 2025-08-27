-- Academic subjects table
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7), -- Hex color for UI display
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student schedules - what subject they should be working on at specific times
CREATE TABLE IF NOT EXISTS student_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id),
    subject_id UUID NOT NULL REFERENCES subjects(id),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Current subject selection - what the student says they're working on now
CREATE TABLE IF NOT EXISTS current_subject_selections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id),
    subject_id UUID NOT NULL REFERENCES subjects(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    device_id VARCHAR(255),
    CONSTRAINT one_active_per_student UNIQUE (student_id, ended_at)
);

-- Subject activity tracking - actual time spent on detected subjects
CREATE TABLE IF NOT EXISTS subject_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id),
    subject_id UUID NOT NULL REFERENCES subjects(id),
    activity_id UUID REFERENCES activities(id),
    detected_confidence DECIMAL(3,2), -- 0.00 to 1.00
    duration INTEGER NOT NULL, -- seconds
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subject detection rules - URLs and keywords for auto-detection
CREATE TABLE IF NOT EXISTS subject_detection_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES subjects(id),
    rule_type VARCHAR(20) NOT NULL CHECK (rule_type IN ('domain', 'keyword', 'app')),
    pattern VARCHAR(255) NOT NULL,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
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
INSERT INTO subject_detection_rules (subject_id, rule_type, pattern) VALUES
    ((SELECT id FROM subjects WHERE name = 'Mathematics'), 'domain', 'khanacademy.org/math'),
    ((SELECT id FROM subjects WHERE name = 'Mathematics'), 'domain', 'mathway.com'),
    ((SELECT id FROM subjects WHERE name = 'Mathematics'), 'domain', 'wolframalpha.com'),
    ((SELECT id FROM subjects WHERE name = 'Mathematics'), 'domain', 'desmos.com'),
    ((SELECT id FROM subjects WHERE name = 'Mathematics'), 'keyword', 'algebra'),
    ((SELECT id FROM subjects WHERE name = 'Mathematics'), 'keyword', 'calculus'),
    ((SELECT id FROM subjects WHERE name = 'Mathematics'), 'app', 'Calculator'),
    ((SELECT id FROM subjects WHERE name = 'Science'), 'domain', 'khanacademy.org/science'),
    ((SELECT id FROM subjects WHERE name = 'Science'), 'domain', 'phet.colorado.edu'),
    ((SELECT id FROM subjects WHERE name = 'Science'), 'keyword', 'biology'),
    ((SELECT id FROM subjects WHERE name = 'Science'), 'keyword', 'chemistry'),
    ((SELECT id FROM subjects WHERE name = 'Science'), 'keyword', 'physics'),
    ((SELECT id FROM subjects WHERE name = 'English'), 'domain', 'docs.google.com'),
    ((SELECT id FROM subjects WHERE name = 'English'), 'domain', 'grammarly.com'),
    ((SELECT id FROM subjects WHERE name = 'English'), 'domain', 'turnitin.com'),
    ((SELECT id FROM subjects WHERE name = 'English'), 'app', 'Microsoft Word'),
    ((SELECT id FROM subjects WHERE name = 'English'), 'app', 'Pages'),
    ((SELECT id FROM subjects WHERE name = 'Computer Science'), 'domain', 'github.com'),
    ((SELECT id FROM subjects WHERE name = 'Computer Science'), 'domain', 'stackoverflow.com'),
    ((SELECT id FROM subjects WHERE name = 'Computer Science'), 'domain', 'replit.com'),
    ((SELECT id FROM subjects WHERE name = 'Computer Science'), 'app', 'Visual Studio Code'),
    ((SELECT id FROM subjects WHERE name = 'Computer Science'), 'app', 'Xcode')
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX idx_student_schedules_lookup ON student_schedules(student_id, day_of_week, start_time, end_time);
CREATE INDEX idx_current_selections_active ON current_subject_selections(student_id) WHERE ended_at IS NULL;
CREATE INDEX idx_subject_activities_student ON subject_activities(student_id, started_at);
CREATE INDEX idx_detection_rules_lookup ON subject_detection_rules(rule_type, pattern);