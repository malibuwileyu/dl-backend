-- Populate academic app categories
-- This migration adds common educational apps and marks them as productive

-- Update all productive apps to be educational by default
UPDATE app_categories 
SET is_educational = true 
WHERE category = 'productive';

-- Educational/Academic Apps
INSERT INTO app_categories (app_name, category, is_educational, is_global) VALUES
-- Coding/Development
('Visual Studio Code', 'productive', true, true),
('Xcode', 'productive', true, true),
('IntelliJ IDEA', 'productive', true, true),
('PyCharm', 'productive', true, true),
('Sublime Text', 'productive', true, true),
('Atom', 'productive', true, true),
('Terminal', 'productive', true, true),
('iTerm', 'productive', true, true),

-- Math & Science
('GeoGebra', 'productive', true, true),
('Desmos Graphing Calculator', 'productive', true, true),
('Wolfram Mathematica', 'productive', true, true),
('MATLAB', 'productive', true, true),
('RStudio', 'productive', true, true),

-- Writing & Research
('Microsoft Word', 'productive', true, true),
('Google Docs', 'productive', true, true),
('Pages', 'productive', true, true),
('Scrivener', 'productive', true, true),
('Notion', 'productive', true, true),
('Obsidian', 'productive', true, true),
('Roam Research', 'productive', true, true),

-- Educational Platforms
('Zoom', 'productive', true, true),
('Microsoft Teams', 'productive', true, true),
('Google Meet', 'productive', true, true),
('Canvas', 'productive', true, true),
('Blackboard', 'productive', true, true),
('Moodle', 'productive', true, true),

-- Study Tools
('Anki', 'productive', true, true),
('Quizlet', 'productive', true, true),
('Khan Academy', 'productive', true, true),
('Duolingo', 'productive', true, true),
('Coursera', 'productive', true, true),
('edX', 'productive', true, true),

-- Productivity Tools
('Todoist', 'productive', true, true),
('Things', 'productive', true, true),
('Forest', 'productive', true, true),
('Pomodoro Timer', 'productive', true, true)
ON CONFLICT (app_name, organization_id) DO UPDATE 
SET category = EXCLUDED.category,
    is_educational = EXCLUDED.is_educational;

-- Non-academic apps (distracting)
INSERT INTO app_categories (app_name, category, is_educational, is_global) VALUES
-- Social Media
('Discord', 'distracting', false, true),
('Slack', 'neutral', false, true),
('WhatsApp', 'distracting', false, true),
('Messages', 'distracting', false, true),
('Telegram', 'distracting', false, true),

-- Entertainment
('YouTube', 'distracting', false, true),
('Netflix', 'distracting', false, true),
('Spotify', 'distracting', false, true),
('Apple Music', 'distracting', false, true),
('Twitch', 'distracting', false, true),

-- Games
('Steam', 'distracting', false, true),
('Epic Games Launcher', 'distracting', false, true),
('Minecraft', 'distracting', false, true),
('League of Legends', 'distracting', false, true),
('Roblox', 'distracting', false, true),

-- Browsers (neutral - depends on usage)
('Google Chrome', 'neutral', false, true),
('Safari', 'neutral', false, true),
('Firefox', 'neutral', false, true),
('Microsoft Edge', 'neutral', false, true),
('Brave', 'neutral', false, true)
ON CONFLICT (app_name, organization_id) DO UPDATE 
SET category = EXCLUDED.category,
    is_educational = EXCLUDED.is_educational;