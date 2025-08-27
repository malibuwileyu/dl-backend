-- Insert default productivity categorizations for common applications
INSERT INTO applications (bundle_id, name, category, default_productivity_score, platform) VALUES
-- Productive macOS apps
('com.apple.dt.Xcode', 'Xcode', 'development', 0.9, 'macos'),
('com.microsoft.VSCode', 'Visual Studio Code', 'development', 0.9, 'macos'),
('com.google.Chrome', 'Google Chrome', 'browser', 0.5, 'macos'),
('com.apple.Safari', 'Safari', 'browser', 0.5, 'macos'),
('com.microsoft.Word', 'Microsoft Word', 'productivity', 0.8, 'macos'),
('com.microsoft.Excel', 'Microsoft Excel', 'productivity', 0.8, 'macos'),
('com.microsoft.Powerpoint', 'Microsoft PowerPoint', 'productivity', 0.8, 'macos'),
('com.apple.iWork.Keynote', 'Keynote', 'productivity', 0.8, 'macos'),
('com.apple.iWork.Pages', 'Pages', 'productivity', 0.8, 'macos'),
('com.apple.iWork.Numbers', 'Numbers', 'productivity', 0.8, 'macos'),
('com.readdle.PDFExpert', 'PDF Expert', 'productivity', 0.7, 'macos'),
('com.apple.Preview', 'Preview', 'productivity', 0.7, 'macos'),

-- Educational macOS apps
('com.khanacademy.desktop', 'Khan Academy', 'education', 0.9, 'macos'),
('com.wolfram.Mathematica', 'Mathematica', 'education', 0.9, 'macos'),
('com.geogebra.desktop', 'GeoGebra', 'education', 0.9, 'macos'),

-- Communication apps (neutral)
('com.tinyspeck.slackmacgap', 'Slack', 'communication', 0.5, 'macos'),
('us.zoom.xos', 'Zoom', 'communication', 0.6, 'macos'),
('com.microsoft.teams', 'Microsoft Teams', 'communication', 0.6, 'macos'),
('com.apple.mail', 'Mail', 'communication', 0.5, 'macos'),

-- Distracting macOS apps
('com.valvesoftware.Steam', 'Steam', 'games', 0.1, 'macos'),
('com.spotify.client', 'Spotify', 'entertainment', 0.2, 'macos'),
('com.apple.Music', 'Music', 'entertainment', 0.2, 'macos'),
('com.apple.TV', 'TV', 'entertainment', 0.1, 'macos'),
('com.discord.Discord', 'Discord', 'communication', 0.2, 'macos'),

-- Productive iOS apps
('com.apple.mobilesafari', 'Safari', 'browser', 0.5, 'ios'),
('com.google.chrome.ios', 'Chrome', 'browser', 0.5, 'ios'),
('com.microsoft.Office.Word', 'Word', 'productivity', 0.8, 'ios'),
('com.apple.Pages', 'Pages', 'productivity', 0.8, 'ios'),
('com.apple.Keynote', 'Keynote', 'productivity', 0.8, 'ios'),
('com.apple.Numbers', 'Numbers', 'productivity', 0.8, 'ios'),

-- Educational iOS apps
('com.khanacademy.KhanAcademy', 'Khan Academy', 'education', 0.9, 'ios'),
('com.duolingo.DuolingoMobile', 'Duolingo', 'education', 0.9, 'ios'),
('com.photomath.photomath', 'Photomath', 'education', 0.7, 'ios'),

-- Distracting iOS apps
('com.burbn.instagram', 'Instagram', 'social', 0.1, 'ios'),
('com.zhiliaoapp.musically', 'TikTok', 'social', 0.1, 'ios'),
('com.snap.snapchat', 'Snapchat', 'social', 0.1, 'ios'),
('com.facebook.Facebook', 'Facebook', 'social', 0.1, 'ios'),
('com.twitter.twitter', 'Twitter', 'social', 0.1, 'ios'),
('com.reddit.Reddit', 'Reddit', 'social', 0.2, 'ios'),
('com.google.ios.youtube', 'YouTube', 'entertainment', 0.2, 'ios'),
('com.netflix.Netflix', 'Netflix', 'entertainment', 0.1, 'ios'),
('com.spotify.client', 'Spotify', 'entertainment', 0.2, 'ios');

-- Insert default website categorizations
INSERT INTO websites (domain, category, default_productivity_score) VALUES
-- Educational sites
('khanacademy.org', 'education', 0.9),
('coursera.org', 'education', 0.9),
('edx.org', 'education', 0.9),
('udemy.com', 'education', 0.8),
('wikipedia.org', 'reference', 0.8),
('wolframalpha.com', 'education', 0.9),
('scholar.google.com', 'research', 0.9),

-- Productivity sites
('docs.google.com', 'productivity', 0.8),
('drive.google.com', 'productivity', 0.8),
('github.com', 'development', 0.8),
('gitlab.com', 'development', 0.8),
('stackoverflow.com', 'development', 0.7),
('office.com', 'productivity', 0.8),
('notion.so', 'productivity', 0.8),

-- News sites (neutral)
('nytimes.com', 'news', 0.5),
('bbc.com', 'news', 0.5),
('cnn.com', 'news', 0.5),
('reuters.com', 'news', 0.5),

-- Social media (distracting)
('facebook.com', 'social', 0.1),
('twitter.com', 'social', 0.1),
('instagram.com', 'social', 0.1),
('tiktok.com', 'social', 0.1),
('reddit.com', 'social', 0.2),
('discord.com', 'communication', 0.2),

-- Entertainment (distracting)
('youtube.com', 'entertainment', 0.2),
('netflix.com', 'entertainment', 0.1),
('twitch.tv', 'entertainment', 0.1),
('spotify.com', 'entertainment', 0.2),
('hulu.com', 'entertainment', 0.1),

-- Gaming (very distracting)
('steampowered.com', 'games', 0.1),
('twitch.tv', 'games', 0.1),
('epicgames.com', 'games', 0.1),
('roblox.com', 'games', 0.1),
('minecraft.net', 'games', 0.1);

-- Create a demo organization for development
INSERT INTO organizations (id, name, domain, settings) VALUES
('00000000-0000-0000-0000-000000000001', 'Demo School', 'demo.school.edu', 
 '{"features": {"screenshots": false, "alerts": true, "realtime": true}}');

-- Create demo users
INSERT INTO users (id, organization_id, email, password_hash, role, grade_level) VALUES
-- Admin (password: admin123)
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 
 'admin@demo.school.edu', '$2b$10$YKvuZRwqUxJ9vKDB7M5sKuGQVwxvQpJXzF/RH0GKHHbE2aEEAF7Ey', 'admin', NULL),
-- Teacher (password: teacher123)
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 
 'teacher@demo.school.edu', '$2b$10$JGqXQ3XPYC0Z9Q5wYzGqZeKRKwZvKwZQVwxvQpJXzF/RH0GKHHbE2', 'teacher', NULL),
-- Student (password: student123)
('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 
 'student@demo.school.edu', '$2b$10$hRKwZvKwZQVwxvQpJXzF/RH0GKHHbE2YKvuZRwqUxJ9vKDB7M5sKu', 'student', 9);

-- Create demo subjects
INSERT INTO subjects (organization_id, name, color, icon) VALUES
('00000000-0000-0000-0000-000000000001', 'Mathematics', '#FF6B6B', 'calculator'),
('00000000-0000-0000-0000-000000000001', 'Science', '#4ECDC4', 'flask'),
('00000000-0000-0000-0000-000000000001', 'English', '#45B7D1', 'book'),
('00000000-0000-0000-0000-000000000001', 'History', '#96CEB4', 'clock'),
('00000000-0000-0000-0000-000000000001', 'Computer Science', '#9B59B6', 'code');