-- Create subject_activities table
CREATE TABLE IF NOT EXISTS subject_activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    subject_id INTEGER,
    duration INTEGER NOT NULL DEFAULT 0,
    activity_date DATE NOT NULL,
    confidence DECIMAL(3,2) DEFAULT 0.00,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subject_activities_user_id ON subject_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_subject_activities_subject_id ON subject_activities(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_activities_date ON subject_activities(activity_date);
CREATE INDEX IF NOT EXISTS idx_subject_activities_user_date ON subject_activities(user_id, activity_date);

-- Create or update aggregate tracking
CREATE UNIQUE INDEX IF NOT EXISTS idx_subject_activities_unique 
    ON subject_activities(user_id, subject_id, activity_date);