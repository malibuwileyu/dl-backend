-- Create demo students with different grades
INSERT INTO users (email, password, organization_id, role, grade, name) VALUES
('alice.johnson@superbuilders.school', '$2b$10$dummyhash', 1, 'student', 9, 'Alice Johnson'),
('bob.smith@superbuilders.school', '$2b$10$dummyhash', 1, 'student', 10, 'Bob Smith'),
('charlie.davis@superbuilders.school', '$2b$10$dummyhash', 1, 'student', 11, 'Charlie Davis'),
('diana.wilson@superbuilders.school', '$2b$10$dummyhash', 1, 'student', 12, 'Diana Wilson'),
('emma.brown@superbuilders.school', '$2b$10$dummyhash', 1, 'student', 9, 'Emma Brown'),
('frank.miller@superbuilders.school', '$2b$10$dummyhash', 1, 'student', 10, 'Frank Miller')
ON CONFLICT (email) DO NOTHING;

-- Get user IDs for the demo students
WITH student_ids AS (
  SELECT id, email, name FROM users 
  WHERE email IN (
    'alice.johnson@superbuilders.school',
    'bob.smith@superbuilders.school',
    'charlie.davis@superbuilders.school',
    'diana.wilson@superbuilders.school',
    'emma.brown@superbuilders.school',
    'frank.miller@superbuilders.school'
  )
)
-- Insert demo activities for today
INSERT INTO activities (user_id, app_name, window_title, start_time, end_time, duration, is_idle)
SELECT 
  s.id,
  app_name,
  window_title,
  start_time,
  end_time,
  EXTRACT(EPOCH FROM (end_time - start_time))::integer as duration,
  false
FROM student_ids s
CROSS JOIN (
  VALUES
  -- Alice (Grade 9) - High productivity student
  ('alice.johnson@superbuilders.school', 'Visual Studio Code', 'index.js - StudentProject', CURRENT_DATE + INTERVAL '8 hours', CURRENT_DATE + INTERVAL '9 hours 30 minutes'),
  ('alice.johnson@superbuilders.school', 'Google Chrome', 'Khan Academy - Algebra', CURRENT_DATE + INTERVAL '9 hours 30 minutes', CURRENT_DATE + INTERVAL '10 hours 15 minutes'),
  ('alice.johnson@superbuilders.school', 'Microsoft Word', 'Essay - English Assignment', CURRENT_DATE + INTERVAL '10 hours 30 minutes', CURRENT_DATE + INTERVAL '11 hours 45 minutes'),
  ('alice.johnson@superbuilders.school', 'Discord', 'Gaming Server', CURRENT_DATE + INTERVAL '12 hours', CURRENT_DATE + INTERVAL '12 hours 15 minutes'),
  
  -- Bob (Grade 10) - Medium productivity
  ('bob.smith@superbuilders.school', 'Google Chrome', 'YouTube - Music Videos', CURRENT_DATE + INTERVAL '8 hours', CURRENT_DATE + INTERVAL '8 hours 45 minutes'),
  ('bob.smith@superbuilders.school', 'Microsoft Teams', 'Chemistry Class', CURRENT_DATE + INTERVAL '9 hours', CURRENT_DATE + INTERVAL '10 hours'),
  ('bob.smith@superbuilders.school', 'Notion', 'Study Notes', CURRENT_DATE + INTERVAL '10 hours 15 minutes', CURRENT_DATE + INTERVAL '11 hours'),
  ('bob.smith@superbuilders.school', 'Steam', 'Counter-Strike 2', CURRENT_DATE + INTERVAL '11 hours 30 minutes', CURRENT_DATE + INTERVAL '12 hours 30 minutes'),
  
  -- Charlie (Grade 11) - Low productivity (needs intervention)
  ('charlie.davis@superbuilders.school', 'Discord', 'Friends Chat', CURRENT_DATE + INTERVAL '8 hours', CURRENT_DATE + INTERVAL '9 hours 30 minutes'),
  ('charlie.davis@superbuilders.school', 'YouTube', 'Gaming Videos', CURRENT_DATE + INTERVAL '9 hours 45 minutes', CURRENT_DATE + INTERVAL '11 hours'),
  ('charlie.davis@superbuilders.school', 'Spotify', 'My Playlist', CURRENT_DATE + INTERVAL '11 hours', CURRENT_DATE + INTERVAL '11 hours 45 minutes'),
  ('charlie.davis@superbuilders.school', 'Google Docs', 'History Report', CURRENT_DATE + INTERVAL '11 hours 45 minutes', CURRENT_DATE + INTERVAL '12 hours 15 minutes'),
  
  -- Diana (Grade 12) - Very high productivity
  ('diana.wilson@superbuilders.school', 'IntelliJ IDEA', 'AP Computer Science Project', CURRENT_DATE + INTERVAL '7 hours 30 minutes', CURRENT_DATE + INTERVAL '9 hours 45 minutes'),
  ('diana.wilson@superbuilders.school', 'Wolfram Mathematica', 'Calculus Assignment', CURRENT_DATE + INTERVAL '10 hours', CURRENT_DATE + INTERVAL '11 hours 15 minutes'),
  ('diana.wilson@superbuilders.school', 'Anki', 'SAT Vocabulary', CURRENT_DATE + INTERVAL '11 hours 30 minutes', CURRENT_DATE + INTERVAL '12 hours'),
  ('diana.wilson@superbuilders.school', 'Canvas', 'Submit Assignments', CURRENT_DATE + INTERVAL '12 hours', CURRENT_DATE + INTERVAL '12 hours 20 minutes'),
  
  -- Emma (Grade 9) - Balanced student
  ('emma.brown@superbuilders.school', 'Pages', 'Book Report', CURRENT_DATE + INTERVAL '8 hours 15 minutes', CURRENT_DATE + INTERVAL '9 hours 30 minutes'),
  ('emma.brown@superbuilders.school', 'Safari', 'Research - Science Project', CURRENT_DATE + INTERVAL '9 hours 45 minutes', CURRENT_DATE + INTERVAL '10 hours 30 minutes'),
  ('emma.brown@superbuilders.school', 'Messages', 'Group Chat', CURRENT_DATE + INTERVAL '10 hours 30 minutes', CURRENT_DATE + INTERVAL '10 hours 45 minutes'),
  ('emma.brown@superbuilders.school', 'GeoGebra', 'Geometry Homework', CURRENT_DATE + INTERVAL '11 hours', CURRENT_DATE + INTERVAL '12 hours'),
  
  -- Frank (Grade 10) - Gaming addiction pattern
  ('frank.miller@superbuilders.school', 'Microsoft Word', 'Essay Outline', CURRENT_DATE + INTERVAL '8 hours', CURRENT_DATE + INTERVAL '8 hours 20 minutes'),
  ('frank.miller@superbuilders.school', 'Steam', 'Minecraft', CURRENT_DATE + INTERVAL '8 hours 30 minutes', CURRENT_DATE + INTERVAL '10 hours 30 minutes'),
  ('frank.miller@superbuilders.school', 'Discord', 'Gaming Voice Chat', CURRENT_DATE + INTERVAL '10 hours 30 minutes', CURRENT_DATE + INTERVAL '11 hours'),
  ('frank.miller@superbuilders.school', 'League of Legends', 'Ranked Match', CURRENT_DATE + INTERVAL '11 hours', CURRENT_DATE + INTERVAL '12 hours 30 minutes')
) AS activity_data(email, app_name, window_title, start_time, end_time)
WHERE s.email = activity_data.email;

-- Update app categories if needed
INSERT INTO app_categories (app_name, category, is_global) VALUES
('Canvas', 'productive', true),
('GeoGebra', 'productive', true),
('Wolfram Mathematica', 'productive', true),
('Anki', 'productive', true),
('League of Legends', 'distracting', true)
ON CONFLICT (app_name, organization_id) DO UPDATE 
SET category = EXCLUDED.category;