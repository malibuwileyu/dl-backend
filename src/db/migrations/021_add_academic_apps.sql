-- Pre-populate academic app categories
-- This migration adds common educational apps and marks them as productive

-- Educational/Academic Apps
INSERT INTO app_categories (app_name, category, description, is_educational) VALUES
-- Coding/Development
('Visual Studio Code', 'productive', 'Code editor for programming', true),
('Xcode', 'productive', 'Apple development environment', true),
('IntelliJ IDEA', 'productive', 'Java/Kotlin development', true),
('PyCharm', 'productive', 'Python development', true),
('Sublime Text', 'productive', 'Text editor for coding', true),
('Atom', 'productive', 'Text editor for coding', true),
('Terminal', 'productive', 'Command line interface', true),
('iTerm', 'productive', 'Terminal emulator', true),

-- Math & Science
('GeoGebra', 'productive', 'Mathematics software', true),
('Desmos Graphing Calculator', 'productive', 'Online graphing calculator', true),
('Wolfram Mathematica', 'productive', 'Computational software', true),
('MATLAB', 'productive', 'Numerical computing', true),
('RStudio', 'productive', 'Statistical computing', true),

-- Writing & Research
('Microsoft Word', 'productive', 'Word processor', true),
('Google Docs', 'productive', 'Online word processor', true),
('Pages', 'productive', 'Apple word processor', true),
('Scrivener', 'productive', 'Writing software', true),
('Notion', 'productive', 'Note-taking and organization', true),
('Obsidian', 'productive', 'Note-taking app', true),
('Roam Research', 'productive', 'Research tool', true),

-- Educational Platforms
('Zoom', 'productive', 'Video conferencing for classes', true),
('Microsoft Teams', 'productive', 'Collaboration for education', true),
('Google Meet', 'productive', 'Video conferencing', true),
('Canvas', 'productive', 'Learning management system', true),
('Blackboard', 'productive', 'Learning management system', true),
('Moodle', 'productive', 'Learning management system', true),

-- Study Tools
('Anki', 'productive', 'Flashcard app', true),
('Quizlet', 'productive', 'Study tool', true),
('Khan Academy', 'productive', 'Educational platform', true),
('Duolingo', 'productive', 'Language learning', true),
('Coursera', 'productive', 'Online courses', true),
('edX', 'productive', 'Online courses', true),

-- Productivity Tools
('Todoist', 'productive', 'Task management', true),
('Things', 'productive', 'Task management', true),
('Forest', 'productive', 'Focus app', true),
('Pomodoro Timer', 'productive', 'Time management', true)
ON CONFLICT (app_name) DO UPDATE 
SET category = EXCLUDED.category,
    is_educational = EXCLUDED.is_educational;

-- Non-academic apps (distracting)
INSERT INTO app_categories (app_name, category, description, is_educational) VALUES
-- Social Media
('Discord', 'distracting', 'Chat application', false),
('Slack', 'neutral', 'Team communication', false),
('WhatsApp', 'distracting', 'Messaging', false),
('Messages', 'distracting', 'Apple Messages', false),
('Telegram', 'distracting', 'Messaging', false),

-- Entertainment
('YouTube', 'distracting', 'Video streaming', false),
('Netflix', 'distracting', 'Video streaming', false),
('Spotify', 'distracting', 'Music streaming', false),
('Apple Music', 'distracting', 'Music streaming', false),
('Twitch', 'distracting', 'Live streaming', false),

-- Games
('Steam', 'distracting', 'Gaming platform', false),
('Epic Games Launcher', 'distracting', 'Gaming platform', false),
('Minecraft', 'distracting', 'Game', false),
('League of Legends', 'distracting', 'Game', false),
('Roblox', 'distracting', 'Game', false),

-- Browsers (neutral - depends on usage)
('Google Chrome', 'neutral', 'Web browser', false),
('Safari', 'neutral', 'Web browser', false),
('Firefox', 'neutral', 'Web browser', false),
('Microsoft Edge', 'neutral', 'Web browser', false),
('Brave', 'neutral', 'Web browser', false)
ON CONFLICT (app_name) DO UPDATE 
SET category = EXCLUDED.category,
    is_educational = EXCLUDED.is_educational;

-- Add is_educational column if it doesn't exist
ALTER TABLE app_categories 
ADD COLUMN IF NOT EXISTS is_educational BOOLEAN DEFAULT false;

-- Update existing entries based on category
UPDATE app_categories 
SET is_educational = true 
WHERE category = 'productive' 
AND app_name IN (
  'Visual Studio Code', 'Xcode', 'IntelliJ IDEA', 'PyCharm',
  'Microsoft Word', 'Google Docs', 'Pages',
  'Zoom', 'Microsoft Teams', 'Canvas',
  'Khan Academy', 'Coursera', 'Duolingo'
);