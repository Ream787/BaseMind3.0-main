-- =====================
-- SETUP FIRST ADMIN USER (OPTIONAL)
-- =====================
-- Run this AFTER deploying migration 002_setup_auth.sql
-- Replace 'admin@scouts.org' and 'Admin Name' with your actual values

-- Step 1: Create auth user in Supabase Auth (must be done via Supabase UI or SDK)
-- Go to: Supabase Dashboard → Authentication → Users → Add User
-- Create user with email: admin@scouts.org, password: your-secure-password

-- Step 2: After auth user is created, run this query to create their profile
-- Replace 'USER_ID' with the ID from auth.users table
-- Replace 'admin@scouts.org' with the actual email

INSERT INTO users (id, email, name, phone, role, status)
VALUES (
  'USER_ID_FROM_AUTH_USERS', -- Replace this with actual UUID from auth.users
  'admin@scouts.org',
  'Admin User',
  '0400000000',
  'Admin',
  'Active'
);

-- Step 3: Verify the user was created
SELECT id, email, name, role, status FROM users WHERE email = 'admin@scouts.org';

-- Step 4: You can now login with:
-- Email: admin@scouts.org
-- Password: [whatever password you set in Step 1]
