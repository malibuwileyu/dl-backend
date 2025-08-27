-- Add name column to users table
ALTER TABLE users 
ADD COLUMN name VARCHAR(255);

-- Update existing Google users to use email prefix as name
UPDATE users 
SET name = split_part(email, '@', 1) 
WHERE name IS NULL;