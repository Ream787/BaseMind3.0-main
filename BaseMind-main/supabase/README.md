# Supabase Setup Guide

## Quick Start

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Copy your project URL and anon key
3. Add them to `.env.local`:
   ```
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

## Database Setup

Run the SQL migration to create all tables:

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Create a new query
4. Copy the contents of `supabase/migrations/001_initial_schema.sql`
5. Execute the query

## Environment Variables

```env
# Frontend (in .env.local)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Backend (in Supabase secrets)
SUPABASE_PROJECT_ID=your-project
SUPABASE_API_KEY=your-service-role-key
RESEND_API_KEY=your-resend-api-key
```

## Authentication

- Users are stored in the `users` table
- User-group relationships in `user_groups` table
- Passwords should be hashed using bcrypt (not stored as plain text)
- Role-based access control via `role` column

## API Functions

Deploy the Supabase functions from `supabase/functions/server/` to enable server-side utilities such as:
- Password reset emails
- Other server operations

## Security

- Enable RLS (Row Level Security) on all tables
- Set up proper auth policies for user access
- Keep API keys in environment variables
- Never commit `.env.local` to version control
