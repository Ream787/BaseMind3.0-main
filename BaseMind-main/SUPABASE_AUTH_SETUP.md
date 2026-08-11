# Supabase Auth Setup Guide

This guide will help you reset Supabase with proper authentication.

## ⚠️ Step 1: Delete All Data (One-Time)

Go to [Supabase Dashboard](https://supabase.com/dashboard) and delete your project data:

1. Go to **SQL Editor**
2. Run this query to drop all tables:

```sql
-- Drop all tables
DROP TABLE IF EXISTS files CASCADE;
DROP TABLE IF EXISTS folders CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS camp_plan_equipment CASCADE;
DROP TABLE IF EXISTS camp_plans CASCADE;
DROP TABLE IF EXISTS user_groups CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS camping_locations CASCADE;
DROP TABLE IF EXISTS equipment CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
```

## ✅ Step 2: Apply Migrations

Run these migrations in order in your Supabase SQL Editor:

### Migration 1: Initial Schema (if not done)
Run the content of `supabase/migrations/001_initial_schema.sql`

### Migration 2: Auth Setup
Run the content of `supabase/migrations/002_setup_auth.sql`

This will:
- Create `users` table linked to `auth.users`
- Enable Row Level Security (RLS) policies
- Set up automatic triggers

## 🔐 Step 3: Create First Admin User

### Option A: Using Supabase UI (Easiest)

1. Go to **Authentication** → **Users** → **Add User**
2. Fill in:
   - **Email**: `admin@scouts.org`
   - **Password**: Create a strong password (e.g., `MySecurePass123!`)
   - Click **Add User**
3. Copy the **User ID** (UUID format)

### Option B: Using SQL (Advanced)

Use the `supabase/migrations/003_setup_first_admin.sql` file:

1. Go to **SQL Editor** → **New Query**
2. Copy the content from `003_setup_first_admin.sql`
3. Replace `USER_ID_FROM_AUTH_USERS` with the UUID from auth.users table
4. Replace `admin@scouts.org` with your admin email
5. Run the query

## 📝 Step 4: Create Admin User Profile in Database

After creating the auth user, create their profile:

```sql
-- Get the user ID from auth.users
SELECT id, email FROM auth.users WHERE email = 'admin@scouts.org';

-- Copy that ID and run this (replace USER_ID):
INSERT INTO users (id, email, name, phone, role, status)
VALUES (
  'USER_ID',  -- UUID from the query above
  'admin@scouts.org',
  'Admin User',
  '0400000000',
  'Admin',
  'Active'
);
```

## 🧪 Step 5: Test Login

1. Go to your app's login page
2. Enter:
   - **Email**: `admin@scouts.org`
   - **Password**: The password you set in Step 3
3. Click **Login**

You should now be logged in!

## 📱 Step 6: Create Additional Users

You can now create users in the app via:

1. **Registration page** (if enabled) - Creates user with "Pending" status
2. **Admin dashboard** - Admins can create and approve users
3. **SQL** - Create directly in database

### Via SQL:

```sql
-- First, create auth user
-- (Go to Authentication → Users → Add User)
-- Then create profile:

INSERT INTO users (id, email, name, phone, role, status)
VALUES (
  'USER_UUID',
  'newuser@scouts.org',
  'New User Name',
  '0400000000',
  'Member',  -- or 'Admin', 'Group Manager', 'Viewer'
  'Active'   -- or 'Pending', 'Rejected'
);
```

## 🔑 Environment Variables

Your existing Vercel environment variables are already correct:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

No changes needed!

## ✨ What Changed

| Aspect | Before | After |
|--------|--------|-------|
| Passwords | Stored in plain text | Encrypted by Supabase Auth |
| Login | Custom database query | Supabase Auth with session |
| Registration | Manual insertion | Supabase Auth signup |
| Security | Vulnerable | Industry standard (bcrypt) |
| Session | localStorage only | Supabase session management |

## 🚀 Next Steps

1. **Deploy the code** - Push the updated AuthContext and RegisterPage
2. **Run migrations** - Apply 002 and 003 in Supabase SQL Editor
3. **Create admin** - Follow Step 3 above
4. **Create groups** - Use the app to create groups
5. **Invite users** - Use registration or admin panel

## 🆘 Troubleshooting

### "Failed to query database" on login
- Ensure `users` table has RLS policies enabled
- Check that user profile exists in `users` table
- Verify email matches

### "Invalid email or password"
- Confirm auth user was created (check in auth.users)
- Verify user profile exists in `users` table
- Check password is correct

### "Your account is pending approval"
- Admin needs to change status to "Active" via SQL or admin dashboard

### Can't see migration changes
- Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache
- Verify migrations ran without errors

## 📚 Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth/overview)
- [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security)
- [Reset your database](https://supabase.com/docs/guides/database/basics#resetting-your-database)
