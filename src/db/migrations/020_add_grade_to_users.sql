-- Add grade field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS grade INTEGER;

-- Add check constraint for valid grades (9-12)
ALTER TABLE users ADD CONSTRAINT check_valid_grade 
CHECK (grade IS NULL OR (grade >= 9 AND grade <= 12));

-- Create index for grade-based queries
CREATE INDEX IF NOT EXISTS idx_users_grade ON users(grade);

-- Update existing test users with sample grades
UPDATE users SET grade = 9 WHERE email LIKE '%freshman%';
UPDATE users SET grade = 10 WHERE email LIKE '%sophomore%';
UPDATE users SET grade = 11 WHERE email LIKE '%junior%';
UPDATE users SET grade = 12 WHERE email LIKE '%senior%';

-- Add grade to the sample users if they exist
UPDATE users SET grade = 10 WHERE email = 'test@school.edu';
UPDATE users SET grade = 11 WHERE email = 'student2@school.edu';
UPDATE users SET grade = 12 WHERE email = 'student3@school.edu';