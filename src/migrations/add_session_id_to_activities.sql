-- Add session_id column to activities table for proper session tracking
-- This allows continuous tracking to update existing sessions instead of creating duplicates

-- Add the column
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS session_id UUID;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_activities_session_id 
ON activities(session_id);

-- Create a unique constraint to prevent duplicate session_ids
-- Note: No WHERE clause so ON CONFLICT works properly
CREATE UNIQUE INDEX IF NOT EXISTS idx_activities_session_id_unique 
ON activities(session_id);

-- Add a composite index for efficient session updates
CREATE INDEX IF NOT EXISTS idx_activities_user_session 
ON activities(user_id, session_id);

-- Clean up existing duplicate sessions before we enforce uniqueness
-- Keep only the longest session for each app/start_time combination
DELETE FROM activities a
WHERE EXISTS (
    SELECT 1 
    FROM activities b 
    WHERE b.user_id = a.user_id 
    AND b.app_name = a.app_name 
    AND b.start_time = a.start_time 
    AND b.end_time > a.end_time
    AND b.id != a.id
);

-- Generate session_ids for existing records based on user_id, app_name, and start_time
-- This ensures existing sessions get unique IDs
UPDATE activities 
SET session_id = gen_random_uuid()
WHERE session_id IS NULL;

-- Now make session_id NOT NULL for future inserts
ALTER TABLE activities 
ALTER COLUMN session_id SET NOT NULL;

-- Add a comment explaining the column
COMMENT ON COLUMN activities.session_id IS 'Unique identifier for a continuous activity session, used to update existing records during periodic saves';