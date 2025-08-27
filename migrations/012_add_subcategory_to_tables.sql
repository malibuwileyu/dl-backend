-- Add subcategory column to website_categories table
ALTER TABLE website_categories ADD COLUMN IF NOT EXISTS subcategory VARCHAR(50);

-- Add subcategory column to ai_categorization_suggestions table  
ALTER TABLE ai_categorization_suggestions ADD COLUMN IF NOT EXISTS suggested_subcategory VARCHAR(50);

-- Update existing website_categories with subcategories based on common patterns
UPDATE website_categories SET subcategory = 'school' WHERE pattern IN ('classroom.google.com', 'canvas.instructure.com', 'khanacademy.org', 'coursera.org', 'edx.org');
UPDATE website_categories SET subcategory = 'research' WHERE pattern IN ('wikipedia.org', 'scholar.google.com', 'jstor.org', 'arxiv.org');
UPDATE website_categories SET subcategory = 'creativity' WHERE pattern IN ('figma.com', 'canva.com', 'adobe.com', 'dribbble.com');
UPDATE website_categories SET subcategory = 'productivity' WHERE pattern IN ('notion.so', 'todoist.com', 'trello.com', 'asana.com');
UPDATE website_categories SET subcategory = 'communication' WHERE pattern IN ('gmail.com', 'outlook.com', 'slack.com', 'zoom.us', 'teams.microsoft.com');
UPDATE website_categories SET subcategory = 'reading' WHERE pattern IN ('medium.com', 'nytimes.com', 'bbc.com', 'cnn.com');
UPDATE website_categories SET subcategory = 'health' WHERE pattern IN ('myfitnesspal.com', 'strava.com', 'headspace.com', 'calm.com');
UPDATE website_categories SET subcategory = 'gaming' WHERE pattern IN ('steam.com', 'epicgames.com', 'twitch.tv', 'minecraft.net', 'roblox.com');
UPDATE website_categories SET subcategory = 'scrolling' WHERE pattern IN ('instagram.com', 'twitter.com', 'reddit.com', 'tiktok.com', 'facebook.com');
UPDATE website_categories SET subcategory = 'entertainment' WHERE pattern IN ('youtube.com', 'netflix.com', 'hulu.com', 'spotify.com', 'disney.com');