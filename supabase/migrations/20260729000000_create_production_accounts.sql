-- ================================================================
-- Add username column to profiles for username-based login
-- Create the 6 production accounts as Supabase Auth users
-- ================================================================

-- Add username column to profiles (unique, used for login)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles (username);

-- Create auth users and profiles for the 6 production accounts.
-- Passwords are handled entirely by Supabase Auth — NEVER stored in plain text.
-- This SQL creates the auth users and profiles.
-- The passwords must be set via the Supabase Auth Dashboard or Admin API.

-- NOTE: Run this block AFTER creating each auth user through the Supabase Dashboard.
-- The trigger `on_auth_user_created` will auto-create profile rows.
-- Then run the UPDATE statements below to set usernames and roles.

-- After creating auth users via Supabase Auth Dashboard with these emails:
--   masterofeyes@system.mil
--   815avenger@system.mil
--   817avenger@system.mil
--   821avenger@system.mil
--   586pechora@system.mil
--   hares@system.mil

-- Run these updates to assign usernames and roles.
-- Each is wrapped in a DO block so the new enum value is committed independently.

DO $$ BEGIN
  UPDATE profiles SET username = 'masterofeyes', role = 'master_admin', full_name = 'Master Admin', is_active = true
  WHERE email = 'masterofeyes@system.mil';
END $$;

DO $$ BEGIN
  UPDATE profiles SET username = '815avenger', role = 'admin', full_name = 'Admin 1', is_active = true
  WHERE email = '815avenger@system.mil';
END $$;

DO $$ BEGIN
  UPDATE profiles SET username = '817avenger', role = 'admin', full_name = 'Admin 2', is_active = true
  WHERE email = '817avenger@system.mil';
END $$;

DO $$ BEGIN
  UPDATE profiles SET username = '821avenger', role = 'admin', full_name = 'Admin 3', is_active = true
  WHERE email = '821avenger@system.mil';
END $$;

DO $$ BEGIN
  UPDATE profiles SET username = '586pechora', role = 'admin', full_name = 'Admin 4', is_active = true
  WHERE email = '586pechora@system.mil';
END $$;

DO $$ BEGIN
  UPDATE profiles SET username = 'HARES', role = 'admin', full_name = 'Admin 5', is_active = true
  WHERE email = 'hares@system.mil';
END $$;
