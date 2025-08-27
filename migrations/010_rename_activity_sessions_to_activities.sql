-- Migration to rename activity_sessions table to activities
-- Note: This migration assumes you want to keep the existing table structure
-- but just rename the table. The column mapping will be handled in the application layer.

-- First, rename the table
ALTER TABLE activity_sessions RENAME TO activities;

-- Update indexes to use new table name (they get renamed automatically)
-- But let's rename them for clarity
ALTER INDEX idx_activity_sessions_user_time RENAME TO idx_activities_user_time;
ALTER INDEX idx_activity_sessions_device_time RENAME TO idx_activities_device_time;
ALTER INDEX idx_activity_sessions_category RENAME TO idx_activities_category;
ALTER INDEX idx_activity_sessions_subject RENAME TO idx_activities_subject;

-- Note: The activities table in your requirements has different columns than activity_sessions.
-- The current activity_sessions table has: id (UUID), device_id, user_id, start_time, end_time,
-- app_bundle_id, app_name, window_title, url, category, productivity_score, subject, metadata
-- 
-- Your required activities table should have: id (integer), user_id, device_id, app_name,
-- window_title, url, start_time, end_time, duration, is_idle, subject_id, created_at, updated_at
--
-- This migration only renames the table. Column changes would require data migration
-- which should be done carefully to avoid data loss.