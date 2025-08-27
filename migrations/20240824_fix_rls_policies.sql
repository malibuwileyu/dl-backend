-- Fix RLS policies for Phase 1 dual-write
-- Since we're using service role key for now, we need to adjust policies

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Users can view own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can create own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can update own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can delete own activities" ON public.activities;

-- Temporarily disable RLS for Phase 1 testing
-- This allows writes using the anon key
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities DISABLE ROW LEVEL SECURITY;

-- Note: In production, you would use proper RLS policies like:
-- CREATE POLICY "Service role can do anything" ON public.users
--   FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
-- 
-- CREATE POLICY "Service role can do anything" ON public.activities
--   FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
--
-- Or better yet, create policies that check the user_id matches