-- Add Google OAuth fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- Create index for faster Google ID lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Update any existing users to ensure they have the new columns
UPDATE users SET updated_at = NOW() WHERE google_id IS NULL;