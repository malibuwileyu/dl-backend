-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- Create custom types
CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin');
CREATE TYPE platform_type AS ENUM ('macos', 'ios');
CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high');
CREATE TYPE rule_type AS ENUM ('app', 'website', 'keyword');